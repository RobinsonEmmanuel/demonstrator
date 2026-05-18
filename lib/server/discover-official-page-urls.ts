import 'server-only';

import type { PlaceContext } from '@/lib/server/place-context';
import { pickEstablishmentDomain } from '@/lib/server/citation-ranking';
import { isBlockedSourceUrl, normalizeHost } from '@/lib/server/source-quality';

const DENYLIST = [
  '-datatourisme.fr',
  '-calameo.com',
  '-tripadvisor.com',
  '-wikipedia.org',
];

/**
 * Trouve les URLs des pages officielles (tarifs, horaires, accessibilité…) via recherche ciblée.
 */
export async function discoverOfficialPageUrls(
  place: PlaceContext,
  officialDomains: string[],
  apiKey: string
): Promise<string[]> {
  if (officialDomains.length === 0) return [];

  const museumDomain = pickEstablishmentDomain(officialDomains, place) ?? officialDomains[0];
  const domainList = [museumDomain, ...officialDomains.filter((d) => d !== museumDomain)]
    .slice(0, 3)
    .join(', ');

  const prompt = `Pour "${place.nomPoi}" à ${place.destination}, trouve les URLs **françaises** des pages officielles.

Priorité absolue : le site du musée / établissement lui-même → **${museumDomain}** (pas seulement la métropole ou la mairie).

Domaines : ${domainList}

Rubriques recherchées (chemins typiques : /tarifs, /billetterie, /horaires, /collections, /oeuvres, /decouvrir, /accessibilite) :
- page des tarifs / billetterie
- collections permanentes / œuvres / artistes
- horaires d'ouverture
- accessibilité / PMR

Réponds UNIQUEMENT en JSON :
{ "urls": ["https://...", "https://..."] }

Règles :
- URLs complètes, pages intérieures (pas la home seule).
- Priorité au site de l'établissement (${officialDomains[0]}).
- Pas de brochure PDF hébergée sur calameo ou OT si le site du musée a une page dédiée.`;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      return_citations: true,
      temperature: 0.1,
      search_domain_filter: [museumDomain, ...officialDomains.filter((d) => d !== museumDomain)].slice(
        0,
        5
      ),
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) return [];

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: string[];
  };

  const urls = new Set<string>();

  const raw = data.choices?.[0]?.message?.content || '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { urls?: string[] };
      for (const u of parsed.urls ?? []) {
        if (u && !isBlockedSourceUrl(u)) urls.add(u);
      }
    } catch {
      /* ignore */
    }
  }

  for (const u of data.citations ?? []) {
    if (!u || isBlockedSourceUrl(u)) continue;
    const host = normalizeHost(u);
    if (officialDomains.some((d) => host === d || host.endsWith(`.${d}`))) {
      urls.add(u);
    }
  }

  return [...urls].slice(0, 8);
}
