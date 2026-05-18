import 'server-only';

import type { ConsultedSource, FactVerificationResult } from '@/types/fact-check';
import { inferSourceTypeFromUrl, isBlockedSourceUrl, normalizeHost } from '@/lib/server/source-quality';

const TYPE_ORDER: Record<string, number> = {
  official: 0,
  institutional: 1,
  media_high: 2,
  media_local: 3,
  commercial: 4,
  ugc: 5,
};

const TYPE_LABELS: Record<string, string> = {
  official: 'Officiel',
  institutional: 'Institutionnel',
  media_high: 'Presse inter.',
  media_local: 'Presse locale',
  commercial: 'Commercial',
  ugc: 'Avis / forum',
};

function collectUrlsFromResults(results: FactVerificationResult[]): string[] {
  const urls: string[] = [];
  for (const r of results) {
    for (const p of [...(r.validated_points ?? []), ...(r.invalid_points ?? [])]) {
      if (p.source_url && !isBlockedSourceUrl(p.source_url)) {
        urls.push(p.source_url);
      }
    }
  }
  return urls;
}

/**
 * Liste dédupliquée des sites/URLs consultés (citations Perplexity + sources des points).
 */
export function buildConsultedSources(
  perplexityCitations: string[],
  results: FactVerificationResult[]
): ConsultedSource[] {
  const allUrls = [
    ...perplexityCitations.filter((u) => u && !isBlockedSourceUrl(u)),
    ...collectUrlsFromResults(results),
  ];

  const byHost = new Map<
    string,
    { uri: string; source_type: string; count: number }
  >();

  for (const url of allUrls) {
    const host = normalizeHost(url);
    if (!host) continue;

    const source_type = inferSourceTypeFromUrl(url) ?? 'commercial';
    const existing = byHost.get(host);

    if (!existing) {
      byHost.set(host, { uri: url, source_type, count: 1 });
      continue;
    }

    existing.count += 1;
    const currentScore = TYPE_ORDER[existing.source_type] ?? 9;
    const newScore = TYPE_ORDER[source_type] ?? 9;
    if (newScore < currentScore) {
      existing.uri = url;
      existing.source_type = source_type;
    }
  }

  const list: ConsultedSource[] = [...byHost.entries()].map(([host, v]) => ({
    host,
    uri: v.uri,
    display_name: host,
    source_type: v.source_type,
    source_type_label: TYPE_LABELS[v.source_type] ?? v.source_type,
    citation_count: v.count,
  }));

  list.sort((a, b) => {
    const ta = TYPE_ORDER[a.source_type] ?? 9;
    const tb = TYPE_ORDER[b.source_type] ?? 9;
    if (ta !== tb) return ta - tb;
    return a.display_name.localeCompare(b.display_name);
  });

  return list;
}
