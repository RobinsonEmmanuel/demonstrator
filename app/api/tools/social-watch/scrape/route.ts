import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/request-auth';
import { scrapeFacebookPosts } from '@/lib/server/apify-facebook';
import { fetchClusterDraftsRaw } from '@/lib/server/sit-cluster-fetch';
import {
  extractClusterSocialAccounts,
  filterDraftsByPoiIds,
} from '@/lib/sit-online-presence';
import { getSocialWatchPoiFilter } from '@/lib/server/social-watch-config';
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

    if (!facebookPages?.length) {
      const { ids: poiFilter } = getSocialWatchPoiFilter();
      const { drafts } = await fetchClusterDraftsRaw();
      const filteredDrafts = filterDraftsByPoiIds(drafts, poiFilter);
      const accounts = extractClusterSocialAccounts(filteredDrafts);
      facebookPages = accounts
        .filter((a) => a.platform === 'facebook')
        .map((a) => ({ url: a.url, poiId: a.poiId, poiName: a.poiName }));
    }

    if (facebookPages.length === 0) {
      return NextResponse.json(
        { error: 'Aucune page Facebook trouvée dans le référentiel SIT.' },
        { status: 400 }
      );
    }

    const posts = await scrapeFacebookPosts(facebookPages);

    const payload: SocialScrapeResponse = {
      posts,
      scrapedAt: new Date().toISOString(),
      facebookPagesScraped: facebookPages.length,
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
