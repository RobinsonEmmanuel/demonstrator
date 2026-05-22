import 'server-only';

export const REGION_LOVERS_API_URL = 'https://api-prod.regionlovers.ai';

export function getRegionLoversApiKey(): string | undefined {
  return process.env.API_REGION_LOVERS?.trim() || undefined;
}

export function requireRegionLoversApiKey(): string {
  const key = getRegionLoversApiKey();
  if (!key) {
    throw new Error(
      'API_REGION_LOVERS manquante — ajoutez-la dans .env.local puis redémarrez le serveur.'
    );
  }
  return key;
}

/** Identifiant place-instance-draft (ex. museum_6e67acc1-…). */
export function normalizePoiDraftId(raw: string): string {
  const id = raw.trim();
  if (!id) throw new Error('Identifiant POI requis.');
  if (id.length > 120) throw new Error('Identifiant POI trop long.');
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(
      'Identifiant POI invalide — utilisez lettres, chiffres, tirets et underscores.'
    );
  }
  return id;
}
