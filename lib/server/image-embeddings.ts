import 'server-only';

import { createOpenAI } from '@/lib/server/openai-client';

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = createOpenAI();
  const res = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function countSharedTags(a: string[], b: string[]): number {
  const norm = (t: string) => t.toLowerCase().trim();
  const setB = new Set(b.map(norm));
  let n = 0;
  for (const t of a) {
    if (setB.has(norm(t))) n++;
  }
  return n;
}

export interface ClusterBySimilarityOptions {
  /** Seuil principal (similarité cosinus sur les embeddings). */
  threshold?: number;
  /** Même scène + tags communs : seuil plus bas pour relier des vues très proches malgré des descriptions différentes. */
  bridgeThreshold?: number;
  minTagOverlap?: number;
  sceneTypes?: string[];
  tagsByIndex?: string[][];
}

/** Regroupe les images par similarité sémantique (descriptions + pont scène/tags). */
export function clusterBySimilarity(
  ids: string[],
  embeddings: number[][],
  thresholdOrOptions: number | ClusterBySimilarityOptions = 0.84
): string[][] {
  const opts: ClusterBySimilarityOptions =
    typeof thresholdOrOptions === 'number'
      ? { threshold: thresholdOrOptions }
      : thresholdOrOptions;

  const threshold = opts.threshold ?? 0.84;
  const bridgeThreshold = opts.bridgeThreshold ?? 0.78;
  const minTagOverlap = opts.minTagOverlap ?? 2;
  const sceneTypes = opts.sceneTypes;
  const tagsByIndex = opts.tagsByIndex;

  const n = ids.length;
  if (n === 0) return [];
  const parent = ids.map((_, i) => i);

  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }

  function union(i: number, j: number) {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[rj] = ri;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      if (sim >= threshold) {
        union(i, j);
        continue;
      }

      const sameScene =
        sceneTypes &&
        sceneTypes[i] &&
        sceneTypes[i] === sceneTypes[j] &&
        sceneTypes[i] !== 'other';
      const tagsI = tagsByIndex?.[i];
      const tagsJ = tagsByIndex?.[j];
      const sharedTags =
        tagsI && tagsJ ? countSharedTags(tagsI, tagsJ) : 0;

      if (
        sameScene &&
        sharedTags >= minTagOverlap &&
        sim >= bridgeThreshold
      ) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, string[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(ids[i]);
    groups.set(root, list);
  }

  return [...groups.values()].filter((g) => g.length > 0);
}
