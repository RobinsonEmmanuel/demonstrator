import 'server-only';

import type { PlaceContext } from '@/lib/server/place-context';
import { pickEstablishmentDomain } from '@/lib/server/citation-ranking';
import { isBlockedSourceUrl, normalizeHost } from '@/lib/server/source-quality';

const DENYLIST = [
  '-datatourisme.fr',
  '-datatourisme.com',
  '-untourism.int',
  '-wikipedia.org',
  '-tripadvisor.com',
];

/**
 * Trouve les domaines du site officiel du lieu + OT (indication dans le prompt, pas filtre de recherche).
 */
export async function discoverOfficialDomains(
  place: PlaceContext,
  apiKey: string
): Promise<string[]> {
  const prompt = `Pour le lieu touristique suivant, identifie les domaines web OFFICIELS à utiliser pour vérifier des faits (horaires, accessibilité, tarifs, équipements).

Lieu : ${place.nomPoi}
Destination : ${place.destination}

Réponds UNIQUEMENT en JSON :
{
  "domains": [
    "domaine-du-site-officiel-de-l-etablissement.fr",
    "office-de-tourisme-local.fr"
  ]
}

Règles :
- Le premier domaine doit être le site de l'établissement lui-même (musée, monument…), pas une base de données tierce.
- Pas datatourisme.fr, pas Wikipedia, pas TripAdvisor.
- Maximum 5 domaines.`;

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
      search_domain_filter: DENYLIST,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) return [];

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: string[];
  };

  const raw = data.choices?.[0]?.message?.content || '';
  const fromJson: string[] = [];
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { domains?: string[] };
      for (const d of parsed.domains ?? []) {
        const host = normalizeHost(d.startsWith('http') ? d : `https://${d}`);
        if (host && !isBlockedSourceUrl(`https://${host}`)) fromJson.push(host);
      }
    } catch {
      /* ignore */
    }
  }

  const fromCitations = (data.citations ?? [])
    .map((u) => normalizeHost(u))
    .filter((h) => h && !isBlockedSourceUrl(`https://${h}`));

  const merged = [...new Set([...fromJson, ...fromCitations])].slice(0, 8);
  if (merged.length === 0) return merged;

  const establishment = pickEstablishmentDomain(merged, place);
  if (!establishment) return merged;
  return [establishment, ...merged.filter((d) => d !== establishment)];
}
