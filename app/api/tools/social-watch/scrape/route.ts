import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/request-auth';
import { scrapeFacebookPosts } from '@/lib/server/apify-facebook';
import { scrapeInstagramPosts } from '@/lib/server/apify-instagram';
import { readPostImages } from '@/lib/server/social-image-reader';
import { fetchClusterDraftsRaw } from '@/lib/server/sit-cluster-fetch';
import {
  extractClusterSocialAccounts,
  filterDraftsByPoiIds,
} from '@/lib/sit-online-presence';
import { getSocialWatchPoiFilter } from '@/lib/server/social-watch-config';
import { getDemoSocialAccounts, useDemoSocialAccounts } from '@/lib/server/social-watch-demo';
import type { SocialScrapeResponse } from '@/types/social-watch';

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);

    let body: { facebookUrls?: { url: string; poiId: string; poiName: string }[] } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    let facebookPages = body.facebookUrls;
    let instagramProfiles: { url: string; poiId: string; poiName: string }[] = [];

    if (!facebookPages?.length && useDemoSocialAccounts()) {
      const demo = getDemoSocialAccounts();
      const toPage = (a: (typeof demo)[number]) => ({
        url: a.url,
        poiId: a.poiId,
        poiName: a.poiName,
      });
      facebookPages = demo.filter((a) => a.platform === 'facebook').map(toPage);
      instagramProfiles = demo.filter((a) => a.platform === 'instagram').map(toPage);
    }

    if (!facebookPages?.length) {
      const { ids: poiFilter } = getSocialWatchPoiFilter();
      const { drafts } = await fetchClusterDraftsRaw();
      const filteredDrafts = filterDraftsByPoiIds(drafts, poiFilter);
      const accounts = extractClusterSocialAccounts(filteredDrafts);
      const toPage = (a: (typeof accounts)[number]) => ({
        url: a.url,
        poiId: a.poiId,
        poiName: a.poiName,
      });
      facebookPages = accounts.filter((a) => a.platform === 'facebook').map(toPage);
      instagramProfiles = accounts.filter((a) => a.platform === 'instagram').map(toPage);
    }

    if (facebookPages.length === 0 && instagramProfiles.length === 0) {
      return NextResponse.json(
        { error: 'Aucun compte Facebook ou Instagram trouvé.' },
        { status: 400 }
      );
    }

    const [fbPosts, igPosts] = await Promise.all([
      facebookPages.length ? scrapeFacebookPosts(facebookPages) : Promise.resolve([]),
      instagramProfiles.length ? scrapeInstagramPosts(instagramProfiles) : Promise.resolve([]),
    ]);
    const posts = [...fbPosts, ...igPosts].sort(
      (a, b) =>
        new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
    );

    // Lecture des images (affiches, menus, photos) — non bloquante : sans clé OpenAI ou en cas
    // d'échec, les posts restent exploitables avec leur seul texte.
    const imageReport = process.env.OPENAI_API_KEY?.trim()
      ? await readPostImages(posts).catch(() => null)
      : null;

    const payload: SocialScrapeResponse = {
      posts,
      scrapedAt: new Date().toISOString(),
      facebookPagesScraped: facebookPages.length,
      instagramProfilesScraped: instagramProfiles.length,
      imagesRead: imageReport?.read,
      imagesFailed: imageReport?.failed,
    };

    return NextResponse.json(payload);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[social-watch/scrape]', e);
    const message = e instanceof Error ? e.message : 'Erreur collecte posts';
    const status =
      message.includes('APIFY_API_TOKEN') || message.includes('Apify') ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
