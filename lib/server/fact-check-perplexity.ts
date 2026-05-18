import 'server-only';

import type { ExtractedField, FactVerificationResult, GroundingSource } from '@/types/fact-check';
import { buildConsultedSources } from '@/lib/server/consulted-sources';
import { buildRedactorStylePrompt } from '@/lib/server/fact-check-prompt';
import { discoverOfficialDomains } from '@/lib/server/discover-official-domains';
import { discoverOfficialPageUrls } from '@/lib/server/discover-official-page-urls';
import { extractPlaceContext, type PlaceContext } from '@/lib/server/place-context';
import {
  bestCitationRefForPoint,
  pickEstablishmentDomain,
  scoreCitationForPoint,
} from '@/lib/server/citation-ranking';
import {
  inferSourceTypeFromUrl,
  isBlockedSourceUrl,
  normalizeHost,
  sanitizeCitationList,
} from '@/lib/server/source-quality';

/** Filtre API Perplexity (denylist) — aligné redactor-guide. */
const SEARCH_DOMAIN_DENYLIST = [
  '-datatourisme.fr',
  '-datatourisme.com',
  '-ontology.adapted-tourism.org',
  '-untourism.int',
  '-unwto.org',
  '-world-tourism.org',
  '-semrush.com',
  '-ahrefs.com',
  '-moz.com',
  '-tripadvisor.com',
  '-wikipedia.org',
  '-wikidata.org',
  '-canarias-lovers.com',
];

function displayName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function resolveSourceRefForPoint(
  point: { source_ref?: number; source_url?: string; point?: string },
  citations: string[],
  place: PlaceContext,
  fieldName?: string
): number | undefined {
  const pointText = point.point ?? '';
  const explicit = point.source_url?.trim();

  if (explicit && !isBlockedSourceUrl(explicit)) {
    const idx = citations.findIndex(
      (c) => c === explicit || c.replace(/\/$/, '') === explicit.replace(/\/$/, '')
    );
    if (idx >= 0) return idx + 1;
  }

  const fromModel = point.source_ref;
  const modelUrl =
    explicit || (fromModel ? citations[fromModel - 1] : undefined);
  const modelScore = modelUrl
    ? scoreCitationForPoint(modelUrl, pointText, place, fieldName)
    : -999;

  const betterRef = bestCitationRefForPoint(citations, pointText, place, fieldName);
  if (betterRef) {
    const betterUrl = citations[betterRef - 1];
    const betterScore = scoreCitationForPoint(betterUrl, pointText, place, fieldName);
    if (!modelUrl || betterScore > modelScore + 8) {
      return betterRef;
    }
  }

  if (modelUrl && !isBlockedSourceUrl(modelUrl) && fromModel) {
    return fromModel;
  }

  return betterRef;
}

const COLLECTION_FIELD_RE =
  /collection|oeuvre|artiste|exposition|fonds|impression|fauve|impressionniste/i;

const PRACTICAL_FIELD_RE =
  /transport|acces|parking|voiture|duree|visite|service|photo|photographie|horaire|metro|bus|tram|pratique|consigne|boutique|café|restaurant/i;

function looksOverstrictInvalid(r: FactVerificationResult): boolean {
  if (r.status !== 'invalid') return false;
  if ((r.validated_points?.length ?? 0) > 0) return false;
  if ((r.invalid_points?.length ?? 0) === 0) return false;

  const labelField = `${r.field ?? ''} ${r.label ?? ''}`;
  if (PRACTICAL_FIELD_RE.test(labelField)) return true;

  return (r.invalid_points ?? []).every((p) =>
    /non confirm|non vérifi|non verifi|absent|introuvable|pas confirm/i.test(
      `${p.point} ${p.correction ?? ''}`
    )
  );
}

const INSTITUTIONAL_HOST_RE =
  /metropole|seinemetropole|mairie|ville-|\.gouv\.fr/;

function allPointsShareOneHost(r: FactVerificationResult): boolean {
  const urls = [...(r.validated_points ?? []), ...(r.invalid_points ?? [])]
    .map((p) => p.source_url)
    .filter(Boolean) as string[];
  if (urls.length < 2) return urls.length === 1;
  const hosts = new Set(urls.map((u) => normalizeHost(u)));
  return hosts.size === 1;
}

function pointsUseOnlyInstitutionalHost(r: FactVerificationResult): boolean {
  const urls = [...(r.validated_points ?? []), ...(r.invalid_points ?? [])]
    .map((p) => p.source_url)
    .filter(Boolean) as string[];
  if (urls.length === 0) return false;
  return urls.every((u) => INSTITUTIONAL_HOST_RE.test(normalizeHost(u)));
}

type PerplexityFieldResult = {
  field?: string;
  id?: string;
  label?: string;
  value?: string;
  status?: FactVerificationResult['status'];
  validated_points?: FactVerificationResult['validated_points'];
  invalid_points?: FactVerificationResult['invalid_points'];
  comment?: string | null;
};

/**
 * Vérification Perplexity Sonar — validation par champs (redactor-guide).
 */
export async function verifyFieldsWithSonar(
  fullText: string,
  fields: ExtractedField[]
): Promise<{
  results: FactVerificationResult[];
  grounding_sources: GroundingSource[];
  place: PlaceContext;
  officialDomains: string[];
  officialPageUrls: string[];
  consulted_sources: ReturnType<typeof buildConsultedSources>;
}> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY manquante');

  const place = await extractPlaceContext(fullText);
  const officialDomains = await discoverOfficialDomains(place, apiKey);
  const officialPageUrls = await discoverOfficialPageUrls(place, officialDomains, apiKey);
  const rendered = buildRedactorStylePrompt(
    place,
    fields,
    officialDomains,
    officialPageUrls
  );

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: rendered }],
      return_citations: true,
      temperature: 0.1,
      search_domain_filter: SEARCH_DOMAIN_DENYLIST,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Perplexity API ${response.status}: ${err}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: string[];
  };

  const rawContent = data.choices?.[0]?.message?.content || '';
  const allCitations: string[] = [...(data.citations || [])];

  const grounding_sources = sanitizeCitationList(allCitations).map((uri) => ({
    uri,
    title: displayName(uri),
    display_name: displayName(uri),
  }));

  let cleaned = rawContent
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Pas de JSON dans la réponse Perplexity: ${cleaned.slice(0, 400)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as { results: PerplexityFieldResult[] };
  const resultsIn = parsed.results ?? [];

  const mapPoints = <
    T extends {
      point?: string;
      source_ref?: number;
      source_url?: string;
      source_display?: string;
      source_type?: string;
    },
  >(
    points: T[] = [],
    fieldName?: string
  ): T[] =>
    points.map((p) => {
      const ref = resolveSourceRefForPoint(p, allCitations, place, fieldName);
      const raw =
        (p.source_url && !isBlockedSourceUrl(p.source_url) ? p.source_url : undefined) ||
        (ref ? allCitations[ref - 1] : undefined);

      if (!raw || isBlockedSourceUrl(raw)) {
        const { source_url: _u, source_display: _d, source_ref: _r, ...rest } = p;
        return {
          ...rest,
          source_url: undefined,
          source_display: undefined,
          source_ref: undefined,
        } as T;
      }

      return {
        ...p,
        source_ref: ref,
        source_url: raw,
        source_display: displayName(raw),
        source_type: inferSourceTypeFromUrl(raw, p.source_type),
      };
    });

  const results: FactVerificationResult[] = [];

  for (const f of fields) {
    const match = resultsIn.find(
      (r) =>
        r.field === f.name ||
        r.id === f.id ||
        (r.label && r.label.toLowerCase() === f.label.toLowerCase())
    );

    if (!match) {
      results.push({
        id: f.id,
        field: f.name,
        label: f.label,
        value: f.value,
        status: 'uncertain',
        comment: 'Pas de résultat retourné pour ce champ.',
      });
      continue;
    }

    results.push({
      id: f.id,
      field: f.name,
      label: match.label ?? f.label,
      value: match.value ?? f.value,
      status: match.status ?? 'uncertain',
      validated_points: mapPoints(match.validated_points ?? [], f.name),
      invalid_points: mapPoints(match.invalid_points ?? [], f.name),
      comment: match.comment,
    });
  }

  const needsOpenWebRefine = results.filter(looksOverstrictInvalid);
  if (needsOpenWebRefine.length > 0) {
    const { results: openRefined, citations: openCitations } = await runPerplexityFieldPass(
      place,
      needsOpenWebRefine,
      fields,
      apiKey,
      buildOpenWebRefinePrompt(place, needsOpenWebRefine, fields),
      SEARCH_DOMAIN_DENYLIST
    );
    allCitations.push(...openCitations);
    mergeFieldResults(results, openRefined);
  }

  const needsCollectionRefine = results.filter((r) => {
    const labelField = `${r.field ?? ''} ${r.label ?? ''}`;
    if (!COLLECTION_FIELD_RE.test(labelField)) return false;
    return pointsUseOnlyInstitutionalHost(r) || allPointsShareOneHost(r);
  });

  const museumDomain = pickEstablishmentDomain(officialDomains, place);
  if (needsCollectionRefine.length > 0 && museumDomain) {
    const { results: refinedCollections, citations: collCitations } =
      await refineCollectionsOnMuseumSite(
        place,
        needsCollectionRefine,
        fields,
        museumDomain,
        apiKey
      );
    allCitations.push(...collCitations);
    for (const r of refinedCollections) {
      const idx = results.findIndex((x) => x.id === r.id);
      if (idx >= 0) results[idx] = r;
    }
  }

  const needsRefine = results.filter(
    (r) =>
      r.status === 'uncertain' &&
      r.field &&
      /tarif|horaire|accessibil|billetterie|equipement/.test(r.field)
  );

  if (needsRefine.length > 0 && officialDomains.length > 0) {
    const { results: refined, citations: tarifCitations } = await refineFieldsOnOfficialSite(
      place,
      needsRefine,
      fields,
      officialDomains,
      officialPageUrls,
      apiKey
    );
    allCitations.push(...tarifCitations);
    for (const r of refined) {
      const idx = results.findIndex((x) => x.id === r.id);
      if (idx >= 0) results[idx] = r;
    }
  }

  const consulted_sources = buildConsultedSources(allCitations, results);

  return {
    results,
    grounding_sources,
    consulted_sources,
    place,
    officialDomains,
    officialPageUrls,
  };
}

const OFFICIAL_REFINE_FIELDS = /tarif|horaire|accessibil|billetterie|equipement/;

function buildOpenWebRefinePrompt(
  place: PlaceContext,
  toRefine: FactVerificationResult[],
  allFields: ExtractedField[]
): string {
  const fieldsText = toRefine
    .map((r) => {
      const f = allFields.find((x) => x.id === r.id);
      return `- ${f?.label ?? r.label} (${r.field}) : "${f?.value ?? r.value}"`;
    })
    .join('\n');

  return `Tu revérifies des champs pour "${place.nomPoi}" (${place.destination}) avec une **recherche web élargie**.

Cherche sur : office de tourisme, métropole, guides touristiques (Petit Futé, Lonely Planet…), presse locale, ET site du musée si pertinent.

Ces infos pratiques ne sont souvent **pas** sur la page d'accueil du musée : valide-les si l'OT ou un guide les confirme (source_type institutional ou commercial).

Ne mets **invalid** que si contredit. Sinon **valid** ou **uncertain**.

JSON : {"results":[…]} avec validated_points / invalid_points et source_type adapté.

Champs :
${fieldsText}`;
}

function mergeFieldResults(
  target: FactVerificationResult[],
  refined: FactVerificationResult[]
): void {
  for (const r of refined) {
    const idx = target.findIndex((x) => x.id === r.id);
    if (idx >= 0) target[idx] = r;
  }
}

async function runPerplexityFieldPass(
  place: PlaceContext,
  toRefine: FactVerificationResult[],
  allFields: ExtractedField[],
  apiKey: string,
  prompt: string,
  domainFilter: string[] | undefined
): Promise<{ results: FactVerificationResult[]; citations: string[] }> {
  const body: Record<string, unknown> = {
    model: 'sonar',
    messages: [{ role: 'user', content: prompt }],
    return_citations: true,
    temperature: 0.15,
  };
  if (domainFilter?.length) {
    body.search_domain_filter = domainFilter;
  }

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) return { results: [], citations: [] };

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: string[];
  };

  const citationsRaw: string[] = data.citations ?? [];
  const raw = data.choices?.[0]?.message?.content || '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { results: [], citations: citationsRaw };

  let parsed: { results: PerplexityFieldResult[] };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { results: [], citations: citationsRaw };
  }

  return {
    results: mapPerplexityResultsToFields(
      parsed.results ?? [],
      toRefine,
      allFields,
      citationsRaw,
      place
    ),
    citations: citationsRaw,
  };
}

function mapPerplexityResultsToFields(
  resultsIn: PerplexityFieldResult[],
  originals: FactVerificationResult[],
  allFields: ExtractedField[],
  citationsRaw: string[],
  place: PlaceContext
): FactVerificationResult[] {
  const mapPoints = <
    T extends {
      point?: string;
      source_ref?: number;
      source_url?: string;
      source_display?: string;
      source_type?: string;
    },
  >(
    points: T[] = [],
    fieldName?: string
  ): T[] =>
    points.map((p) => {
      const ref = resolveSourceRefForPoint(p, citationsRaw, place, fieldName);
      const url =
        (p.source_url && !isBlockedSourceUrl(p.source_url) ? p.source_url : undefined) ||
        (ref ? citationsRaw[ref - 1] : undefined);
      if (!url || isBlockedSourceUrl(url)) {
        return { ...p, source_url: undefined, source_ref: undefined, source_display: undefined };
      }
      return {
        ...p,
        source_ref: ref,
        source_url: url,
        source_display: displayName(url),
        source_type: inferSourceTypeFromUrl(url, p.source_type),
      };
    });

  const out: FactVerificationResult[] = [];
  for (const orig of originals) {
    const match = resultsIn.find(
      (r) =>
        r.field === orig.field ||
        (r.label && orig.label && r.label.toLowerCase() === orig.label.toLowerCase())
    );
    if (!match) continue;

    const f = allFields.find((x) => x.id === orig.id);
    const fieldName = orig.field ?? f?.name;
    out.push({
      id: orig.id,
      field: fieldName,
      label: match.label ?? f?.label ?? orig.label,
      value: match.value ?? f?.value ?? orig.value,
      status: match.status ?? 'uncertain',
      validated_points: mapPoints(match.validated_points ?? [], fieldName),
      invalid_points: mapPoints(match.invalid_points ?? [], fieldName),
      comment: match.comment ?? orig.comment,
    });
  }
  return out;
}

async function refineCollectionsOnMuseumSite(
  place: PlaceContext,
  toRefine: FactVerificationResult[],
  allFields: ExtractedField[],
  museumDomain: string,
  apiKey: string
): Promise<{ results: FactVerificationResult[]; citations: string[] }> {
  const fieldsText = toRefine
    .map((r) => {
      const f = allFields.find((x) => x.id === r.id);
      return `- ${f?.label ?? r.label} (${r.field}) : "${f?.value ?? r.value}"`;
    })
    .join('\n');

  const prompt = `Tu vérifies des champs sur les **collections et artistes** de "${place.nomPoi}" (${place.destination}).

Consulte OBLIGATOIREMENT le site officiel du musée : **${museumDomain}**
Cherche les pages : collections permanentes, œuvres, découvrir le musée, impressionnisme, fauvisme, artistes.

Ne te limite PAS au site de la métropole ou de la mairie — uniquement le site du musée.

Pour chaque nom d'artiste cité dans le champ, indique s'il figure dans les collections du musée.
Décompose en plusieurs validated_points / invalid_points avec **source_ref différents** si les pages diffèrent.

JSON uniquement :
{"results":[{"field":"collections_impressionnistes","label":"…","value":"…","status":"valid|invalid|uncertain","validated_points":[{"point":"…","source_ref":1,"source_type":"official","source_url":"https://…"}],"invalid_points":[],"comment":"…"}]}

Champs :
${fieldsText}`;

  return runPerplexityFieldPass(
    place,
    toRefine,
    allFields,
    apiKey,
    prompt,
    [museumDomain]
  );
}

async function refineFieldsOnOfficialSite(
  place: PlaceContext,
  uncertainResults: FactVerificationResult[],
  allFields: ExtractedField[],
  officialDomains: string[],
  officialPageUrls: string[],
  apiKey: string
): Promise<{ results: FactVerificationResult[]; citations: string[] }> {
  const toRefine = uncertainResults.filter((r) => r.field && OFFICIAL_REFINE_FIELDS.test(r.field));
  if (toRefine.length === 0) return { results: [], citations: [] };

  const fieldsText = toRefine
    .map((r) => {
      const f = allFields.find((x) => x.id === r.id);
      return `- ${f?.label ?? r.label} (${r.field}) : "${f?.value ?? r.value}"`;
    })
    .join('\n');

  const urlsBlock =
    officialPageUrls.length > 0
      ? `\nPages à consulter :\n${officialPageUrls.map((u) => `- ${u}`).join('\n')}\n`
      : '';

  const prompt = `Tu revérifies des champs (tarifs, horaires, accessibilité, équipements) pour "${place.nomPoi}" (${place.destination}).
${urlsBlock}
Cherche sur le site du musée, l'OT, la métropole — pas uniquement une seule URL.
Valide avec official ou institutional selon la source.

Champs :
${fieldsText}

JSON : {"results":[…]}`;

  return runPerplexityFieldPass(
    place,
    toRefine,
    allFields,
    apiKey,
    prompt,
    SEARCH_DOMAIN_DENYLIST
  );
}
