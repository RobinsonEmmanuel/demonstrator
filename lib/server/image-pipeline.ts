import 'server-only';

import { analyzeImageWithVision } from '@/lib/server/image-vision';
import { clusterBySimilarity } from '@/lib/server/image-embeddings';
import { buildGroupRecommendationRationale } from '@/lib/server/image-duplicate-rationale';
import { buildDuplicateGroupComparison } from '@/lib/image-group-comparison';
import { indexImageBatch, loadBatchEmbeddings } from '@/lib/server/image-siglip-index';
import { isMongoConfigured } from '@/lib/server/mongodb';
import type {
  AnalyzedImageResult,
  DuplicateGroup,
  ImageClassifyContext,
  ImageClassifyResponse,
  UploadedImageInput,
} from '@/types/image-classify';

/** Similarité visuelle SigLIP (cosinus) — seuil de regroupement. */
const SIGLIP_DUPLICATE_THRESHOLD = Number(process.env.SIMILARITY_MIN_SCORE ?? 0.82);
const ANALYZE_CONCURRENCY = 3;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

function pickBestInGroup(
  imageIds: string[],
  byId: Map<string, { analysis: AnalyzedImageResult['analysis'] }>
): string {
  let best = imageIds[0];
  let bestScore = -1;

  for (const id of imageIds) {
    const img = byId.get(id);
    if (!img) continue;
    const fail = img.analysis.compliance.status === 'fail';
    const score = fail ? -1000 + img.analysis.aesthetic.overall : img.analysis.aesthetic.overall;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

function buildClustersFromEmbeddings(
  idOrder: string[],
  embeddings: number[][]
): string[][] {
  return clusterBySimilarity(idOrder, embeddings, {
    threshold: SIGLIP_DUPLICATE_THRESHOLD,
  });
}

export async function runImageClassificationPipeline(
  images: UploadedImageInput[],
  context?: ImageClassifyContext
): Promise<ImageClassifyResponse> {
  const idOrder = images.map((i) => i.id);
  let batchId: string | undefined;
  let siglipMocked = false;

  // —— Phase 1 : SigLIP + Mongo + similarité visuelle ——
  const indexResult = await indexImageBatch(images, context);
  batchId = indexResult.batchId;
  siglipMocked = indexResult.indexed.some((r) => r.mocked);

  let embeddings: number[][];
  if (isMongoConfigured()) {
    const fromMongo = await loadBatchEmbeddings(idOrder);
    if (fromMongo.length === idOrder.length) {
      const byId = new Map(fromMongo.map((r) => [r.imageId, r.embedding]));
      embeddings = idOrder.map((id) => byId.get(id)!);
    } else {
      embeddings = indexResult.indexed.map((r) => r.embedding);
    }
  } else {
    embeddings = indexResult.indexed.map((r) => r.embedding);
  }

  const clusters = buildClustersFromEmbeddings(idOrder, embeddings);

  // —— Phase 2 : analyse vision (scores, conformité, tableau comparatif) ——
  const analyzed = await mapPool(images, ANALYZE_CONCURRENCY, async (img) => {
    const analysis = await analyzeImageWithVision(img.dataUrl, context);
    return { id: img.id, name: img.name, analysis };
  });

  const imageToGroup = new Map<string, string>();
  const duplicateGroups: DuplicateGroup[] = [];
  const thresholdPct = Math.round(SIGLIP_DUPLICATE_THRESHOLD * 100);
  const similarityNoteBase = siglipMocked
    ? `${thresholdPct} % (mock SigLIP — configurez SIGLIP_SERVICE_URL pour la similarité visuelle réelle)`
    : `${thresholdPct} % (similarité visuelle SigLIP)`;

  clusters.forEach((memberIds, idx) => {
    const groupId = `g${idx + 1}`;
    memberIds.forEach((id) => imageToGroup.set(id, groupId));

    if (memberIds.length < 2) return;

    const byId = new Map(
      analyzed.map((a) => [a.id, { id: a.id, name: a.name, analysis: a.analysis }])
    );
    const recommended = pickBestInGroup(memberIds, byId);
    const recommendationReason = buildGroupRecommendationRationale(
      recommended,
      memberIds,
      byId
    );
    const comparison = buildDuplicateGroupComparison(memberIds, recommended, byId);

    duplicateGroups.push({
      id: groupId,
      imageIds: memberIds,
      recommendedImageId: recommended,
      similarityNote: `${memberIds.length} visuels très proches (≥ ${similarityNoteBase})`,
      recommendationReason,
      comparison: comparison ?? undefined,
    });
  });

  const ranked = [...analyzed].sort((a, b) => {
    const failA = a.analysis.compliance.status === 'fail';
    const failB = b.analysis.compliance.status === 'fail';
    if (failA !== failB) return failA ? 1 : -1;
    if (a.analysis.compliance.status === 'warning' && b.analysis.compliance.status === 'pass')
      return 1;
    if (b.analysis.compliance.status === 'warning' && a.analysis.compliance.status === 'pass')
      return -1;
    return b.analysis.aesthetic.overall - a.analysis.aesthetic.overall;
  });

  const rankedImageIds = ranked.map((r) => r.id);

  const results: AnalyzedImageResult[] = analyzed.map((a) => {
    const groupId = imageToGroup.get(a.id) ?? null;
    const group = duplicateGroups.find((g) => g.id === groupId);
    const isRecommendedInGroup =
      groupId === null || group?.recommendedImageId === a.id;

    return {
      id: a.id,
      name: a.name,
      analysis: a.analysis,
      duplicateGroupId: groupId,
      isRecommendedInGroup,
      overallRank: rankedImageIds.indexOf(a.id) + 1,
    };
  });

  return {
    images: results,
    duplicateGroups,
    rankedImageIds,
    context,
    batchId,
    siglipMocked,
  };
}
