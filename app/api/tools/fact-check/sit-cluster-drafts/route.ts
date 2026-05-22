import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/request-auth';
import {
  REGION_LOVERS_API_URL,
  requireRegionLoversApiKey,
} from '@/lib/server/region-lovers-api';
import {
  getSitClusterId,
  normalizeClusterDraftsResponse,
} from '@/lib/server/sit-cluster-drafts';
import type { SitClusterDraftsResponse } from '@/types/sit';

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);
    const apiKey = requireRegionLoversApiKey();
    const clusterId = getSitClusterId();

    const url = `${REGION_LOVERS_API_URL}/place-instance-drafts/cluster/${encodeURIComponent(clusterId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: '*/*',
        'X-API-Key': apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errText = (await response.text()).trim();
      return NextResponse.json(
        {
          error:
            errText ||
            `Region Lovers API ${response.status} — impossible de charger la liste des POI.`,
        },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 }
      );
    }

    const data: unknown = await response.json();
    const items = normalizeClusterDraftsResponse(data);

    const payload: SitClusterDraftsResponse = {
      clusterId,
      items,
    };

    return NextResponse.json(payload);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[fact-check/sit-cluster-drafts]', e);
    const message = e instanceof Error ? e.message : 'Erreur liste POI';
    const status = message.includes('API_REGION_LOVERS') ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
