import 'server-only';

import type { Collection } from 'mongodb';
import { cosineSimilarity } from '@/lib/server/image-embeddings';
import { getMongoDb } from '@/lib/server/mongodb';
import type {
  SimilarImageMatch,
  StoredImageRecord,
  UpsertImageInput,
} from '@/types/image-store';

const COLLECTION = 'images';

async function collection(): Promise<Collection<StoredImageRecord>> {
  const db = await getMongoDb();
  const col = db.collection<StoredImageRecord>(COLLECTION);
  await col.createIndex({ imageId: 1 }, { unique: true });
  await col.createIndex({ contentHash: 1 });
  await col.createIndex({ batchId: 1 });
  await col.createIndex({ poiId: 1 });
  return col;
}

export async function findByContentHash(contentHash: string): Promise<StoredImageRecord | null> {
  const col = await collection();
  return col.findOne({ contentHash });
}

export async function findByImageId(imageId: string): Promise<StoredImageRecord | null> {
  const col = await collection();
  return col.findOne({ imageId });
}

export async function upsertImageRecord(input: UpsertImageInput): Promise<StoredImageRecord> {
  const col = await collection();
  const now = new Date();
  const doc: StoredImageRecord = {
    imageId: input.imageId,
    name: input.name,
    mimeType: input.mimeType,
    contentHash: input.contentHash,
    batchId: input.batchId,
    poiId: input.poiId,
    destination: input.destination,
    embedding: input.embedding,
    embeddingModel: input.embeddingModel,
    embeddingDims: input.embedding.length,
    createdAt: now,
    updatedAt: now,
  };

  await col.updateOne(
    { imageId: input.imageId },
    {
      $set: {
        name: doc.name,
        mimeType: doc.mimeType,
        contentHash: doc.contentHash,
        batchId: doc.batchId,
        poiId: doc.poiId,
        destination: doc.destination,
        embedding: doc.embedding,
        embeddingModel: doc.embeddingModel,
        embeddingDims: doc.embeddingDims,
        updatedAt: now,
      },
      $setOnInsert: {
        imageId: doc.imageId,
        createdAt: now,
      },
    },
    { upsert: true }
  );

  return (await col.findOne({ imageId: input.imageId }))!;
}

export interface FindSimilarOptions {
  topK?: number;
  minScore?: number;
  excludeImageId?: string;
  batchId?: string;
  poiId?: string;
  /** Limiter la recherche aux imageId de ce lot (ex. upload courant). */
  scopeImageIds?: string[];
}

/** Recherche par cosinus en mémoire — adapté aux petits catalogues (< ~500 images). */
export async function findSimilarImages(
  queryEmbedding: number[],
  options: FindSimilarOptions = {}
): Promise<SimilarImageMatch[]> {
  const {
    topK = 20,
    minScore = 0.82,
    excludeImageId,
    batchId,
    poiId,
    scopeImageIds,
  } = options;

  const col = await collection();
  const filter: Record<string, unknown> = {};
  if (batchId) filter.batchId = batchId;
  if (poiId) filter.poiId = poiId;
  if (scopeImageIds?.length) filter.imageId = { $in: scopeImageIds };

  const candidates = await col.find(filter).toArray();
  const matches: SimilarImageMatch[] = [];

  for (const doc of candidates) {
    if (excludeImageId && doc.imageId === excludeImageId) continue;
    const score = cosineSimilarity(queryEmbedding, doc.embedding);
    if (score < minScore) continue;
    matches.push({
      imageId: doc.imageId,
      name: doc.name,
      score,
      batchId: doc.batchId,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, topK);
}

export async function listEmbeddingsForScope(
  scopeImageIds: string[]
): Promise<Array<{ imageId: string; embedding: number[] }>> {
  if (scopeImageIds.length === 0) return [];
  const col = await collection();
  const docs = await col
    .find({ imageId: { $in: scopeImageIds } }, { projection: { imageId: 1, embedding: 1 } })
    .toArray();
  return docs.map((d) => ({ imageId: d.imageId, embedding: d.embedding }));
}
