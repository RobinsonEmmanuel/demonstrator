import 'server-only';

/** POI de test — retirer le filtre avec SOCIAL_WATCH_POI_IDS=all dans .env.local */
export const SOCIAL_WATCH_DEMO_POI_IDS = [
  'museum_6e67acc1-1f88-4e85-8b46-191b8c20302c',
  'restaurant_bar_cafe_f53c0564-7b5e-4a8d-b3ef-a4cd2913ea35',
] as const;

/**
 * Filtre POI pour la veille sociale.
 * - non défini → mode démo (2 POI ci-dessus)
 * - `all` ou `*` → cluster entier
 * - liste séparée par des virgules → POI explicites
 */
export function getSocialWatchPoiFilter(): {
  ids: Set<string> | null;
  mode: 'demo' | 'custom' | 'all';
} {
  const raw = process.env.SOCIAL_WATCH_POI_IDS?.trim();

  if (!raw) {
    return { ids: new Set(SOCIAL_WATCH_DEMO_POI_IDS), mode: 'demo' };
  }

  if (raw === 'all' || raw === '*') {
    return { ids: null, mode: 'all' };
  }

  const ids = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );

  if (ids.size === 0) {
    return { ids: new Set(SOCIAL_WATCH_DEMO_POI_IDS), mode: 'demo' };
  }

  return { ids, mode: 'custom' };
}
