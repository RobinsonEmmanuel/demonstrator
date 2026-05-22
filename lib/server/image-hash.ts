import 'server-only';

import { createHash } from 'crypto';

/** Empreinte SHA-256 du contenu image (data URL) pour détecter les doublons exacts. */
export function hashImageDataUrl(dataUrl: string): string {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1]! : dataUrl;
  return createHash('sha256').update(base64).digest('hex');
}

export function slugifyPoiId(poiName?: string, destination?: string): string | undefined {
  const parts = [poiName, destination].filter(Boolean).join('-');
  if (!parts) return undefined;
  return parts
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
