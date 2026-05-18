import 'server-only';

import { analyzeImageWithVision } from '@/lib/server/image-vision';
import { clusterBySimilarity, embedTexts } from '@/lib/server/image-embeddings';
import { buildGroupRecommendationRationale } from '@/lib/server/image-duplicate-rationale';
import type {
  AnalyzedImageResult,
  DuplicateGroup,
  ImageClassifyContext,
  ImageClassifyResponse,
  UploadedImageInput,
} from '@/types/image-classify';

/** Seuil principal ; pont scène/tags à 0,78 pour regrouper des vues quasi identiques malgré des descriptions différentes. */
const DUPLICATE_THRESHOLD = 0.84;
const BRIDGE_THRESHOLD = 0.78;
const MIN_TAG_OVERLAP = 2;
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

export async function runImageClassificationPipeline(
  images: UploadedImageInput[],
  context?: ImageClassifyContext
): Promise<ImageClassifyResponse> {
  const analyzed = await mapPool(images, ANALYZE_CONCURRENCY, async (img) => {
    const analysis = await analyzeImageWithVision(img.dataUrl, context);
    return { id: img.id, name: img.name, analysis };
  });

  const embedInputs = analyzed.map(
    (a) =>
      `[${a.analysis.sceneType}] ${a.analysis.shortDescription} | ${a.analysis.tags.slice(0, 10).join(', ')}`
  );
  const embeddings = await embedTexts(embedInputs);
  const idOrder = analyzed.map((a) => a.id);
  const clusters = clusterBySimilarity(idOrder, embeddings, {
    threshold: DUPLICATE_THRESHOLD,
    bridgeThreshold: BRIDGE_THRESHOLD,
    minTagOverlap: MIN_TAG_OVERLAP,
    sceneTypes: analyzed.map((a) => a.analysis.sceneType),
    tagsByIndex: analyzed.map((a) => a.analysis.tags),
  });

  const imageToGroup = new Map<string, string>();
  const duplicateGroups: DuplicateGroup[] = [];

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

    duplicateGroups.push({
      id: groupId,
      imageIds: memberIds,
      recommendedImageId: recommended,
      similarityNote: `${memberIds.length} visuels très proches (similarité ≥ ${Math.round(DUPLICATE_THRESHOLD * 100)} % ou même scène + tags communs ≥ ${Math.round(BRIDGE_THRESHOLD * 100)} %)`,
      recommendationReason,
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
  const heroImageId = rankedImageIds[0] ?? null;

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
    heroImageId,
    context,
  };
}
