import 'server-only';

/** Domaines à ne jamais afficher comme preuve (SEO, agrégateurs, voyages génériques hors OT). */
const BLOCKED_HOST_PATTERNS = [
  'semrush.com',
  'ahrefs.com',
  'moz.com',
  'similarweb.com',
  'ubersuggest.com',
  'canarias-lovers.com',
  'tripadvisor.',
  'booking.com',
  'expedia.',
  'viator.com',
  'getyourguide.',
  'wikipedia.org',
  'wikidata.org',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'pinterest.',
  'reddit.com',
  'quora.com',
  'yelp.',
  'trustpilot.',
  /** Bases agrégées — pas le site officiel du musée */
  'datatourisme.fr',
  'datatourisme.com',
  'ontology.adapted-tourism.org',
  /** Organismes internationaux génériques — pas de preuve pour un musée / POI précis */
  'untourism.int',
  'unwto.org',
  'world-tourism.org',
  'travel.state.gov',
  'lonelyplanet.com',
];

/** Le modèle ne doit pas pouvoir étiqueter ces domaines « official » ou « institutional ». */
const COMMERCIAL_OR_UGC_ONLY = [
  'semrush.com',
  'ahrefs.com',
  'moz.com',
  'similarweb.com',
  'tripadvisor.',
  'booking.com',
  'expedia.',
];

export function normalizeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function isBlockedSourceUrl(url: string | undefined): boolean {
  if (!url) return true;
  const host = normalizeHost(url);
  if (!host) return true;
  return BLOCKED_HOST_PATTERNS.some((p) => host.includes(p));
}

/**
 * Recalcule source_type à partir de l’URL quand le modèle se trompe (ex. Semrush → official).
 */
export function inferSourceTypeFromUrl(
  url: string,
  declared?: string
): string | undefined {
  const host = normalizeHost(url);
  if (!host) return declared;

  if (COMMERCIAL_OR_UGC_ONLY.some((p) => host.includes(p))) {
    return 'commercial';
  }

  if (/untourism\.int|unwto\.org|world-tourism\.org|datatourisme/.test(host)) {
    return 'commercial';
  }

  if (/\.gouv\.fr$|\.gov$|\.edu$|unesco\.org|europa\.eu/.test(host)) {
    return 'institutional';
  }

  if (
    /tourisme|tourism|office-de-tourisme|visit|ot-|mairie|metropole|ville-|\.fr$/.test(host) &&
    !host.includes('semrush') &&
    !host.includes('tripadvisor')
  ) {
    if (/mairie|ville-|metropole|gouv|prefecture|region\./.test(host)) {
      return 'institutional';
    }
    if (/tourisme|tourism|visit|ot-/.test(host)) {
      return 'institutional';
    }
  }

  if (declared === 'official' || declared === 'institutional') {
    const looksOfficial =
      !COMMERCIAL_OR_UGC_ONLY.some((p) => host.includes(p)) &&
      (host.includes('museum') ||
        host.includes('musee') ||
        host.includes('monument') ||
        host.includes('chateau') ||
        host.includes('parc-national') ||
        /\.(museum|org)$/.test(host) ||
        (!host.includes('blog') && !host.includes('wordpress') && host.split('.').length <= 3));

    if (!looksOfficial && declared === 'official') {
      return 'commercial';
    }
  }

  return declared;
}

export function sanitizeCitationList(citations: string[]): string[] {
  return citations.filter((u) => u && !isBlockedSourceUrl(u));
}
