import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/request-auth';
import { fetchClusterDraftsRaw } from '@/lib/server/sit-cluster-fetch';
import {
  extractClusterSocialAccounts,
  filterDraftsByPoiIds,
} from '@/lib/sit-online-presence';
import { getSocialWatchPoiFilter } from '@/lib/server/social-watch-config';
import type { SocialAccountsResponse } from '@/types/social-watch';

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);
    const { ids: poiFilter, mode: filterMode } = getSocialWatchPoiFilter();
    const { clusterId, drafts } = await fetchClusterDraftsRaw();
    const filteredDrafts = filterDraftsByPoiIds(drafts, poiFilter);
    const accounts = extractClusterSocialAccounts(filteredDrafts);
    const facebookCount = accounts.filter((a) => a.platform === 'facebook').length;

    const payload: SocialAccountsResponse = {
      clusterId,
      accounts,
      facebookCount,
      filterMode,
      poiFilter: poiFilter ? [...poiFilter] : undefined,
    };

    return NextResponse.json(payload);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[social-watch/accounts]', e);
    const message = e instanceof Error ? e.message : 'Erreur comptes sociaux';
    const status = message.includes('API_REGION_LOVERS') ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
