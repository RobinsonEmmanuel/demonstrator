/** Document MongoDB — index visuel SigLIP */

export interface StoredImageRecord {
  imageId: string;
  name: string;
  mimeType: string;
  contentHash: string;
  batchId: string;
  poiId?: string;
  destination?: string;
  embedding: number[];
  embeddingModel: string;
  embeddingDims: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SimilarImageMatch {
  imageId: string;
  name: string;
  score: number;
  batchId?: string;
}

export interface UpsertImageInput {
  imageId: string;
  name: string;
  mimeType: string;
  contentHash: string;
  batchId: string;
  poiId?: string;
  destination?: string;
  embedding: number[];
  embeddingModel: string;
}
