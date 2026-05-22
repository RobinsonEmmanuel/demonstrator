import 'server-only';

import {
  REGION_LOVERS_API_URL,
  requireRegionLoversApiKey,
} from '@/lib/server/region-lovers-api';
import {
  buildSitPoiSnapshot,
  type SitPoiSnapshot,
} from '@/lib/sit-draft-fields';
import {
  extractSitPoiDisplayName,
  extractSitPoiInstanceId,
} from '@/lib/sit-poi-label';
import type { SocialPost } from '@/types/social-watch';

function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aTokens = a.split(/\s+/).filter((t) => t.length > 2);
  const bTokens = new Set(b.split(/\s+/).filter((t) => t.length > 2));
  return aTokens.filter((t) => bTokens.has(t)).length >= Math.min(2, aTokens.length);
}

/** POI des posts : id explicite + rapprochement par nom sur les brouillons cluster. */
export function resolvePoiIdsForPosts(
  posts: SocialPost[],
  clusterDrafts: unknown[]
): Set<string> {
  const ids = new Set<string>();

  for (const post of posts) {
    if (post.poiId) ids.add(post.poiId);
    if (!post.poiName) continue;

    const postName = normalizeName(post.poiName);
    for (const draft of clusterDrafts) {
      const poiId = extractSitPoiInstanceId(draft);
      const poiName = extractSitPoiDisplayName(draft);
      if (!poiId || !poiName) continue;
      if (namesMatch(postName, normalizeName(poiName))) {
        ids.add(poiId);
      }
    }
  }

  return ids;
}

/** Brouillon complet par POI (blocks/sections/fields) — plus fiable que le cluster seul. */
export async function fetchSitSnapshotsForPoiIds(
  poiIds: Iterable<string>
): Promise<SitPoiSnapshot[]> {
  const apiKey = requireRegionLoversApiKey();
  const snapshots: SitPoiSnapshot[] = [];

  for (const poiId of poiIds) {
    const url = `${REGION_LOVERS_API_URL}/place-instance-drafts/${encodeURIComponent(poiId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: '*/*',
        'X-API-Key': apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) continue;

    const data: unknown = await response.json();
    const snapshot = buildSitPoiSnapshot(data);
    if (snapshot) snapshots.push(snapshot);
  }

  return snapshots;
}
