import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/request-auth';
import {
  REGION_LOVERS_API_URL,
  normalizePoiDraftId,
  requireRegionLoversApiKey,
} from '@/lib/server/region-lovers-api';

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    const poiIdRaw = request.nextUrl.searchParams.get('poiId') ?? '';
    const poiId = normalizePoiDraftId(poiIdRaw);
    const apiKey = requireRegionLoversApiKey();

    const url = `${REGION_LOVERS_API_URL}/place-instance-drafts/${encodeURIComponent(poiId)}`;
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
      if (response.status === 404) {
        return NextResponse.json(
          { error: `POI introuvable : ${poiId}` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          error:
            errText ||
            `Region Lovers API ${response.status} — impossible de récupérer le brouillon.`,
        },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 }
      );
    }

    const data: unknown = await response.json();

    return NextResponse.json({
      poiId,
      data,
    });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[fact-check/sit-draft]', e);
    const message = e instanceof Error ? e.message : 'Erreur SIT';
    const status = message.includes('API_REGION_LOVERS') ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
