import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/request-auth';
import { analyzeSocialPosts } from '@/lib/server/social-posts-analyze';
import { fetchClusterDraftsRaw } from '@/lib/server/sit-cluster-fetch';
import { getSocialWatchPoiFilter } from '@/lib/server/social-watch-config';
import {
  fetchSitSnapshotsForPoiIds,
  resolvePoiIdsForPosts,
} from '@/lib/server/sit-referential-fetch';
import { extractSitPoiInstanceId } from '@/lib/sit-poi-label';
import { filterDraftsByPoiIds } from '@/lib/sit-online-presence';
import type { SocialAnalyzeResponse, SocialPost } from '@/types/social-watch';

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const body = (await request.json()) as { posts?: SocialPost[] };

    if (!Array.isArray(body.posts) || body.posts.length === 0) {
      return NextResponse.json(
        { error: 'Aucun post à analyser. Lancez d’abord la collecte.' },
        { status: 400 }
      );
    }

    const { ids: poiFilter } = getSocialWatchPoiFilter();
    const { drafts } = await fetchClusterDraftsRaw();
    const filteredDrafts = filterDraftsByPoiIds(drafts, poiFilter);

    const targetPoiIds = new Set<string>();

    for (const id of poiFilter ?? []) {
      targetPoiIds.add(id);
    }

    for (const draft of filteredDrafts) {
      const id = extractSitPoiInstanceId(draft);
      if (id) targetPoiIds.add(id);
    }

    for (const id of resolvePoiIdsForPosts(body.posts, drafts)) {
      targetPoiIds.add(id);
    }

    for (const post of body.posts) {
      if (post.poiId) targetPoiIds.add(post.poiId);
    }

    const referential = await fetchSitSnapshotsForPoiIds(targetPoiIds);

    const { picks, dbUpdates } = await analyzeSocialPosts(body.posts, referential);
    const postsById = Object.fromEntries(body.posts.map((p) => [p.id, p]));

    const payload: SocialAnalyzeResponse = {
      picks,
      dbUpdates,
      postsById,
    };

    return NextResponse.json(payload);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[social-watch/analyze]', e);
    const message = e instanceof Error ? e.message : 'Erreur analyse IA';
    const status = message.includes('OPENAI') ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
