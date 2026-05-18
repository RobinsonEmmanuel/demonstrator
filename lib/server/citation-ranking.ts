import 'server-only';

import { isBlockedSourceUrl, normalizeHost } from '@/lib/server/source-quality';
import type { PlaceContext } from '@/lib/server/place-context';

/** Domaines agrégateurs / bases — ne remplacent jamais le site officiel. */
const AGGREGATOR_HOSTS = [
  'datatourisme',
  'ontology.adapted-tourism',
  'openstreetmap.org',
  'wikipedia.org',
  'wikidata.org',
];

const INSTITUTIONAL_HOST_RE =
  /metropole|seinemetropole|mairie|ville-|\.gouv\.fr|region\.|departement\./;

/**
 * Score une URL de citation (plus haut = meilleure preuve pour le POI).
 */
export function scoreCitationUrl(url: string, place: PlaceContext): number {
  if (!url || isBlockedSourceUrl(url)) return -1000;
  const host = normalizeHost(url);
  if (!host) return -1000;

  if (AGGREGATOR_HOSTS.some((a) => host.includes(a))) return 5;

  const poiTokens = place.nomPoi
    .toLowerCase()
    .split(/[\s,.'()-]+/)
    .filter((t) => t.length > 3);
  const destTokens = place.destination
    .toLowerCase()
    .split(/[\s,.'()-]+/)
    .filter((t) => t.length > 3);

  let score = 10;

  for (const t of poiTokens) {
    if (host.includes(t) || url.toLowerCase().includes(t)) score += 35;
  }
  for (const t of destTokens) {
    if (host.includes(t) || url.toLowerCase().includes(t)) score += 15;
  }

  if (/musee|museum|muze|muma|monument|chateau|parc-national/.test(host)) score += 45;
  if (/\.gouv\.fr$|mairie|metropole|ville-/.test(host)) score += 20;
  if (/tourisme|tourism|visit|office-de-tourisme|ot-/.test(host) && !host.includes('datatourisme')) {
    score += 25;
  }
  if (host.endsWith('.fr') && score < 40) score += 10;

  const path = url.toLowerCase();
  if (
    /\/accessib|\/pmr|\/handicap|\/visite|\/infos-pratiques|\/preparer|\/equipement|\/tarif|\/horaire/.test(
      path
    )
  ) {
    score += 45;
  }
  if (/\/collection|\/oeuvre|\/artiste|\/exposition|\/permanent|\/decouvrir/.test(path)) {
    score += 50;
  }
  if (/\/en\/?$|\/en\//.test(path) && /france|havre|musee|muma/i.test(place.destination + place.nomPoi)) {
    score -= 15;
  }
  if (path.match(/\/(fr)(\/|$)/)) score += 20;
  if (path === '/' || path.match(/^https?:\/\/[^/]+\/?$/)) score -= 15;

  return score;
}

/** Score une URL pour un point précis (nom d'artiste, type de collection…). */
export function scoreCitationForPoint(
  url: string,
  pointText: string,
  place: PlaceContext,
  fieldName?: string
): number {
  let score = scoreCitationUrl(url, place);
  const point = pointText.toLowerCase();
  const path = url.toLowerCase();
  const field = (fieldName ?? '').toLowerCase();

  const isCollectionField = /collection|oeuvre|artiste|exposition|fonds|impression|fauve/.test(
    field + ' ' + point
  );

  if (isCollectionField && /\/collection|\/oeuvre|\/exposition|\/artiste|\/decouvrir|\/permanent/.test(path)) {
    score += 40;
  }

  const artistTokens = [
    'monet',
    'renoir',
    'pissarro',
    'sisley',
    'boudin',
    'matisse',
    'derain',
    'vlaminck',
    'cezanne',
    'degas',
  ];
  for (const artist of artistTokens) {
    if (point.includes(artist) && (path.includes(artist) || path.includes('collection'))) {
      score += 30;
    }
  }

  if (isCollectionField && INSTITUTIONAL_HOST_RE.test(path) && !path.includes('musee') && !path.includes('muma')) {
    score -= 25;
  }

  const isPracticalField = /transport|acces|parking|duree|service|photo|pratique|horaire|visite/.test(
    field + ' ' + point
  );
  if (isPracticalField) {
    if (INSTITUTIONAL_HOST_RE.test(path) || /tourisme|visit|office-de-tourisme|ot-/.test(path)) {
      score += 35;
    }
    if (/petitfute|lonelyplanet|routard|lefigaro|france24/.test(path)) {
      score += 25;
    }
  }

  return score;
}

/** Choisit la meilleure citation dans la liste (1-based ref). */
export function bestCitationRef(
  citations: string[],
  place: PlaceContext,
  minScore = 45
): number | undefined {
  let bestIdx = -1;
  let bestScore = minScore - 1;
  citations.forEach((url, i) => {
    const s = scoreCitationUrl(url, place);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  });
  return bestIdx >= 0 ? bestIdx + 1 : undefined;
}

/** Meilleure citation pour un point donné (évite que tout point cite [1]). */
export function bestCitationRefForPoint(
  citations: string[],
  pointText: string,
  place: PlaceContext,
  fieldName?: string,
  minScore = 35
): number | undefined {
  let bestIdx = -1;
  let bestScore = minScore - 1;
  citations.forEach((url, i) => {
    const s = scoreCitationForPoint(url, pointText, place, fieldName);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  });
  return bestIdx >= 0 ? bestIdx + 1 : undefined;
}

/** Domaine du site de l'établissement (musée…) plutôt que métropole / mairie. */
export function pickEstablishmentDomain(
  domains: string[],
  place: PlaceContext
): string | undefined {
  const poiTokens = place.nomPoi
    .toLowerCase()
    .split(/[\s,.'()-]+/)
    .filter((t) => t.length > 3);

  const scored = domains.map((d) => {
    let s = 0;
    const h = d.toLowerCase();
    if (/musee|museum|muma|muze/.test(h)) s += 100;
    for (const t of poiTokens) {
      if (h.includes(t)) s += 50;
    }
    if (INSTITUTIONAL_HOST_RE.test(h)) s -= 40;
    return { d, s };
  });

  scored.sort((a, b) => b.s - a.s);
  return scored[0]?.s > 0 ? scored[0].d : domains[0];
}
