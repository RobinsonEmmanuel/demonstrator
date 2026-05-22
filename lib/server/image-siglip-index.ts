import 'server-only';

import { randomUUID } from 'crypto';
import { hashImageDataUrl, slugifyPoiId } from '@/lib/server/image-hash';
import { embedImageFromDataUrl } from '@/lib/server/siglip-client';
import {
  findByContentHash,
  findSimilarImages,
  listEmbeddingsForScope,
  upsertImageRecord,
} from '@/lib/server/image-store';
import { isMongoConfigured } from '@/lib/server/mongodb';
import type { SimilarImageMatch } from '@/types/image-store';
import type { ImageClassifyContext, UploadedImageInput } from '@/types/image-classify';

export interface IndexedImageResult {
  imageId: string;
  contentHash: string;
  embedding: number[];
  embeddingModel: string;
  exactDuplicateOf?: string;
  similar: SimilarImageMatch[];
  mocked?: boolean;
}

export interface BatchIndexResult {
  batchId: string;
  indexed: IndexedImageResult[];
  useMongo: boolean;
}

const EMBED_CONCURRENCY = 2;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

/**
 * Indexe un lot d'images : SigLIP → Mongo (si configuré) → top similaires.
 */
export async function indexImageBatch(
  images: UploadedImageInput[],
  context?: ImageClassifyContext
): Promise<BatchIndexResult> {
  const batchId = randomUUID();
  const poiId = slugifyPoiId(context?.poiName, context?.destination);
  const useMongo = isMongoConfigured();
  const scopeIds = images.map((i) => i.id);

  const indexed = await mapPool(images, EMBED_CONCURRENCY, async (img) => {
    const contentHash = hashImageDataUrl(img.dataUrl);
    const { embedding, model, mocked } = await embedImageFromDataUrl(img.dataUrl);

    let exactDuplicateOf: string | undefined;
    if (useMongo) {
      const existing = await findByContentHash(contentHash);
      if (existing && existing.imageId !== img.id) {
        exactDuplicateOf = existing.imageId;
      }

      await upsertImageRecord({
        imageId: img.id,
        name: img.name,
        mimeType: img.mimeType,
        contentHash,
        batchId,
        poiId,
        destination: context?.destination,
        embedding,
        embeddingModel: model,
      });
    }

    const similar = useMongo
      ? await findSimilarImages(embedding, {
          topK: 20,
          minScore: Number(process.env.SIMILARITY_MIN_SCORE ?? 0.82),
          excludeImageId: img.id,
          scopeImageIds: scopeIds,
        })
      : [];

    return {
      imageId: img.id,
      contentHash,
      embedding,
      embeddingModel: model,
      exactDuplicateOf,
      similar,
      mocked,
    };
  });

  return { batchId, indexed, useMongo };
}

export async function loadBatchEmbeddings(
  imageIds: string[]
): Promise<Array<{ imageId: string; embedding: number[] }>> {
  if (!isMongoConfigured()) return [];
  return listEmbeddingsForScope(imageIds);
}
