import 'server-only';

import type { SocialPost } from '@/types/social-watch';

const ACTOR_ID = 'apify~facebook-posts-scraper';
const BATCH_SIZE = 6;

export function getApifyToken(): string {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) throw new Error('APIFY_API_TOKEN manquante');
  return token;
}

export function postsNewerThanSevenDays(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

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

function pageUrlFromItem(item: Record<string, unknown>): string {
  return (
    pickString(item, ['facebookUrl', 'pageUrl', 'inputUrl']) ??
    pickString(item, ['url']) ??
    ''
  );
}

function normalizePost(
  item: unknown,
  meta: Map<string, { poiId: string; poiName: string }>
): SocialPost | null {
  if (!isPlainObject(item)) return null;

  const postUrl = pickString(item, ['url', 'postUrl', 'link']);
  const pageUrl = pageUrlFromItem(item);
  const pageKeys = facebookUrlKeys(pageUrl);
  let linked: { poiId: string; poiName: string } | undefined;
  for (const key of pageKeys) {
    linked = meta.get(key);
    if (linked) break;
  }

  let publishedAt =
    pickString(item, ['time', 'publishedAt', 'date']) ?? '';
  if (!publishedAt && typeof item.timestamp === 'number') {
    publishedAt = new Date(item.timestamp * 1000).toISOString();
  }

  const text = pickString(item, ['text', 'caption', 'message']) ?? '';
  const id = postUrl || `${pageKeys[0] ?? pageUrl}-${item.timestamp ?? text.slice(0, 40)}`;

  return {
    id,
    postUrl: postUrl ?? '',
    pageUrl,
    poiId: linked?.poiId,
    poiName: linked?.poiName ?? pickString(item, ['pageName', 'title']),
    text,
    publishedAt,
    likes: pickNumber(item, ['likes', 'likesCount', 'reactions']),
    comments: pickNumber(item, ['comments', 'commentsCount']),
    shares: pickNumber(item, ['shares', 'sharesCount']),
  };
}

function facebookUrlKeys(url: string): string[] {
  const keys = new Set<string>();
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const path = u.pathname.replace(/\/$/, '').toLowerCase();
    keys.add(`${u.hostname}${path}`.toLowerCase());
    keys.add(path);
    keys.add(url.replace(/\/$/, '').toLowerCase());
  } catch {
    keys.add(url.replace(/\/$/, '').toLowerCase());
  }
  return [...keys];
}

function buildPageMeta(
  facebookUrls: { url: string; poiId: string; poiName: string }[]
): Map<string, { poiId: string; poiName: string }> {
  const meta = new Map<string, { poiId: string; poiName: string }>();
  for (const { url, poiId, poiName } of facebookUrls) {
    for (const key of facebookUrlKeys(url)) {
      meta.set(key, { poiId, poiName });
    }
  }
  return meta;
}

async function runApifyBatch(
  startUrls: string[],
  onlyPostsNewerThan: string
): Promise<unknown[]> {
  const token = getApifyToken();
  const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=300`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      captionText: false,
      onlyPostsNewerThan,
      resultsLimit: 5,
      startUrls: startUrls.map((u) => ({ url: u })),
    }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      errText.trim() || `Apify ${response.status} — échec collecte Facebook`
    );
  }

  const data: unknown = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function scrapeFacebookPosts(
  facebookPages: { url: string; poiId: string; poiName: string }[]
): Promise<SocialPost[]> {
  if (facebookPages.length === 0) return [];

  const onlyPostsNewerThan = postsNewerThanSevenDays();
  const meta = buildPageMeta(facebookPages);
  const urls = facebookPages.map((p) => p.url);
  const allItems: unknown[] = [];

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const items = await runApifyBatch(batch, onlyPostsNewerThan);
    allItems.push(...items);
  }

  const posts = allItems
    .map((item) => normalizePost(item, meta))
    .filter((p): p is SocialPost => p !== null && Boolean(p.text || p.postUrl));

  const byId = new Map<string, SocialPost>();
  for (const post of posts) {
    if (!byId.has(post.id)) byId.set(post.id, post);
  }

  return [...byId.values()].sort(
    (a, b) =>
      new Date(b.publishedAt || 0).getTime() -
      new Date(a.publishedAt || 0).getTime()
  );
}
