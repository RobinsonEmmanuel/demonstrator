import 'server-only';

import { getApifyToken, postsNewerThanSevenDays } from '@/lib/server/apify-facebook';
import type { SocialPost } from '@/types/social-watch';

/** Même actor que veilleur (app/apify.py → ACTOR_POSTS_IG), forme d'entrée éprouvée là-bas. */
const ACTOR_ID = 'apify~instagram-post-scraper';
const RESULTS_LIMIT_PER_PROFILE = 5;

type IgAccount = { url: string; poiId: string; poiName: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

/** https://www.instagram.com/lepatiodeauville?hl=fr → lepatiodeauville */
export function instagramUsername(url: string): string | null {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)[0];
    return seg ? seg.replace(/^@/, '').toLowerCase() : null;
  } catch {
    return null;
  }
}

function toIso(item: Record<string, unknown>): string {
  const raw = item.timestamp ?? item.takenAt ?? item.publishedAt;
  if (typeof raw === 'string' && raw) return raw;
  if (typeof raw === 'number') {
    return new Date(raw > 32_503_680_000 ? raw : raw * 1000).toISOString();
  }
  return '';
}

export async function scrapeInstagramPosts(accounts: IgAccount[]): Promise<SocialPost[]> {
  const byUser = new Map<string, IgAccount>();
  for (const a of accounts) {
    const user = instagramUsername(a.url);
    if (user) byUser.set(user, a);
  }
  if (byUser.size === 0) return [];

  const token = getApifyToken();
  const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=300`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: [...byUser.keys()],
      resultsLimit: RESULTS_LIMIT_PER_PROFILE,
      onlyPostsNewerThan: postsNewerThanSevenDays(),
    }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText.trim() || `Apify ${response.status} — échec collecte Instagram`);
  }

  const data: unknown = await response.json();
  const items = Array.isArray(data) ? data : [];
  const posts: SocialPost[] = [];

  for (const item of items) {
    if (!isPlainObject(item)) continue;
    const owner = (pickString(item, ['ownerUsername', 'username']) ?? '').toLowerCase();
    const linked = byUser.get(owner) ?? (byUser.size === 1 ? [...byUser.values()][0] : undefined);
    const postUrl = pickString(item, ['url', 'postUrl']) ?? '';
    const shortCode = pickString(item, ['shortCode', 'id']);
    const text = pickString(item, ['caption', 'text']) ?? '';
    if (!text && !postUrl) continue;

    posts.push({
      id: postUrl || `instagram-${shortCode ?? owner}-${toIso(item)}`,
      platform: 'instagram',
      postUrl,
      pageUrl: owner ? `https://www.instagram.com/${owner}` : '',
      poiId: linked?.poiId,
      poiName: linked?.poiName ?? owner,
      text,
      publishedAt: toIso(item),
      likes: pickNumber(item, ['likesCount', 'likes']),
      comments: pickNumber(item, ['commentsCount', 'comments']),
    });
  }

  return posts;
}
