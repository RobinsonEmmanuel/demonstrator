/**
 * URL d'images d'un élément Apify (post Facebook ou Instagram).
 * Même logique que veilleur (app/medias.py) : descente récursive, champs de contenu
 * seulement — jamais les avatars (`profilePic`, `ownerProfilePicUrl`…).
 */
const IMAGE_FIELDS = new Set(['imageUrl', 'displayUrl', 'thumbnail']);
const IMAGE_LIST_FIELDS = new Set(['images']);
const MAX_URLS = 10;

export function extractImageUrls(item: unknown): string[] {
  const found: string[] = [];

  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        if (IMAGE_FIELDS.has(key) && typeof inner === 'string' && inner.trim()) {
          found.push(inner.trim());
        } else if (IMAGE_LIST_FIELDS.has(key) && Array.isArray(inner)) {
          for (const u of inner) if (typeof u === 'string' && u.trim()) found.push(u.trim());
        } else {
          walk(inner);
        }
      }
    }
  };

  walk(item);
  return [...new Set(found)].slice(0, MAX_URLS);
}
