import 'server-only';

import { analyzeImageWithVision } from '@/lib/server/image-vision';
import { clusterBySimilarity, duplicateSimilarityThreshold } from '@/lib/server/image-embeddings';
import { judgeDuplicateGroup } from '@/lib/server/image-group-judge';
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

function groupScore(analysis: AnalyzedImageResult['analysis']): number[] {
  const a = analysis.aesthetic;
  return [
    analysis.compliance.status === 'fail' ? 0 : 1,
    a.overall,
    a.composition + a.lighting + a.editorialImpact + a.subjectRelevance,
    -analysis.technical.issues.length,
    analysis.technical.sharpnessOk ? 1 : 0,
  ];
}

/** Départage par scores : conformité, global, somme des critères, défauts techniques, netteté. */
function pickBestInGroup(
  imageIds: string[],
  byId: Map<string, { analysis: AnalyzedImageResult['analysis'] }>
): string {
  const beats = (a: number[], b: number[]): boolean => {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
  };

  let best = imageIds[0];
  let bestKey: number[] | null = null;
  for (const id of imageIds) {
    const img = byId.get(id);
    if (!img) continue;
    const key = groupScore(img.analysis);
    if (!bestKey || beats(key, bestKey)) {
      best = id;
      bestKey = key;
    }
  }
  return best;
}

function buildClustersFromEmbeddings(
  idOrder: string[],
  embeddings: number[][]
): string[][] {
  return clusterBySimilarity(idOrder, embeddings, {
    threshold: duplicateSimilarityThreshold(),
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
  const thresholdPct = Math.round(duplicateSimilarityThreshold() * 100);
  const similarityNoteBase = siglipMocked
    ? `${thresholdPct} % (mock SigLIP — configurez SIGLIP_SERVICE_URL pour la similarité visuelle réelle)`
    : `${thresholdPct} % (similarité visuelle SigLIP)`;

  const imagesById = new Map(images.map((i) => [i.id, i]));
  const analyzedById = new Map(
    analyzed.map((a) => [a.id, { id: a.id, name: a.name, analysis: a.analysis }])
  );

  clusters.forEach((memberIds, idx) => {
    const groupId = `g${idx + 1}`;
    memberIds.forEach((id) => imageToGroup.set(id, groupId));
  });

  // Jugement comparatif (vision) de chaque groupe de doublons, en parallèle.
  const groupClusters = clusters
    .map((memberIds, idx) => ({ memberIds, groupId: `g${idx + 1}` }))
    .filter((c) => c.memberIds.length >= 2);

  const groups = await Promise.all(
    groupClusters.map(async ({ memberIds, groupId }) => {
      const scoreWinner = pickBestInGroup(memberIds, analyzedById);
      // Les images non conformes ne sont jamais soumises : le jugement ne doit pas les élire.
      const compliant = memberIds.filter(
        (id) => analyzedById.get(id)?.analysis.compliance.status !== 'fail'
      );
      // Le jugement visuel ne fait que DÉPARTAGER les ex æquo : il ne peut pas contredire
      // le tableau de notes affiché (total des 4 critères). Seules les photos au meilleur
      // total sont soumises ; si une seule émerge, elle gagne sans appel au juge.
      const totalOf = (id: string): number => {
        const a = analyzedById.get(id)?.analysis.aesthetic;
        return a ? a.composition + a.lighting + a.editorialImpact + a.subjectRelevance : 0;
      };
      const bestTotal = Math.max(...compliant.map(totalOf));
      const candidates = compliant.filter((id) => totalOf(id) === bestTotal);
      const judged =
        candidates.length >= 2
          ? await judgeDuplicateGroup(
              candidates
                .map((id) => ({ id, dataUrl: imagesById.get(id)?.dataUrl ?? '' }))
                .filter((m) => m.dataUrl),
              context
            )
          : null;

      // Gagnante du jugement visuel ; à défaut, départage par scores.
      const recommended =
        judged ? judged.winnerId : candidates.length === 1 ? candidates[0] : scoreWinner;
      const recommendationReason = buildGroupRecommendationRationale(
        recommended,
        memberIds,
        analyzedById,
        judged
      );
      const comparison = buildDuplicateGroupComparison(
        memberIds,
        recommended,
        analyzedById,
        judged
      );

      return {
        id: groupId,
        imageIds: memberIds,
        recommendedImageId: recommended,
        similarityNote: `${memberIds.length} visuels très proches (≥ ${similarityNoteBase})`,
        recommendationReason,
        comparison: comparison ?? undefined,
      } satisfies DuplicateGroup;
    })
  );
  duplicateGroups.push(...groups);

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
