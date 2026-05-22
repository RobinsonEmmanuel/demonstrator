import 'server-only';

import {
  REGION_LOVERS_API_URL,
  requireRegionLoversApiKey,
} from '@/lib/server/region-lovers-api';
import { getSitClusterId } from '@/lib/server/sit-cluster-drafts';
import { draftsArrayFromClusterResponse } from '@/lib/sit-online-presence';

export async function fetchClusterDraftsRaw(): Promise<{
  clusterId: string;
  drafts: unknown[];
}> {
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
    throw new Error(
      errText ||
        `Region Lovers API ${response.status} — impossible de charger le cluster.`
    );
  }

  const data: unknown = await response.json();
  return {
    clusterId,
    drafts: draftsArrayFromClusterResponse(data),
  };
}
