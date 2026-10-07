import 'server-only';

import { createHash } from 'crypto';

const DEFAULT_MODEL = 'google/siglip-base-patch16-224';
const DEFAULT_DIMS = 768;

export interface SiglipEmbedResult {
  embedding: number[];
  model: string;
  dims: number;
  mocked?: boolean;
}

function normalizeVector(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

/** Mock déterministe — branchement uniquement ; ne reflète pas la similarité visuelle. */
function mockEmbeddingFromDataUrl(dataUrl: string, dims = DEFAULT_DIMS): number[] {
  const hash = createHash('sha256').update(dataUrl).digest();
  const v: number[] = [];
  for (let i = 0; i < dims; i++) {
    const b = hash[i % hash.length];
    v.push((b / 255) * 2 - 1);
  }
  return normalizeVector(v);
}

/** RunPod Serverless (même endpoint que visior) : POST /runsync puis polling /status. */
async function embedViaRunpod(dataUrl: string): Promise<SiglipEmbedResult> {
  const endpointId = process.env.RUNPOD_SIGLIP_ENDPOINT_ID!.trim();
  const apiKey = process.env.RUNPOD_API_KEY?.trim();
  if (!apiKey) throw new Error('RUNPOD_API_KEY manquant');

  const base = `https://api.runpod.ai/v2/${endpointId}`;
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  // Clé applicative contrôlée par le handler du worker (SIGLIP_API_KEY dans visior).
  const siglipApiKey = process.env.SIGLIP_API_KEY?.trim();

  const res = await fetch(`${base}/runsync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      input: {
        operation: 'embed_image',
        image_base64: b64,
        ...(siglipApiKey ? { api_key: siglipApiKey } : {}),
      },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  let data = (await res.json()) as {
    id?: string;
    status?: string;
    error?: string;
    output?: { embedding?: number[]; model?: string };
  };

  // Cold start : runsync peut renvoyer IN_QUEUE / IN_PROGRESS -> polling
  const deadline = Date.now() + 170_000;
  while (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS') {
    if (!data.id || Date.now() > deadline) throw new Error('RunPod : job non terminé (timeout)');
    await new Promise((r) => setTimeout(r, 2000));
    const pr = await fetch(`${base}/status/${data.id}`, { headers, signal: AbortSignal.timeout(10_000) });
    data = await pr.json();
  }
  if (data.status === 'FAILED' || data.error) {
    throw new Error(`RunPod : ${data.error ?? 'job failed'}`);
  }
  const emb = data.output?.embedding;
  if (!Array.isArray(emb) || emb.length === 0) {
    throw new Error('Réponse RunPod invalide (embedding manquant)');
  }
  return {
    embedding: normalizeVector(emb),
    model: data.output?.model || 'runpod-siglip',
    dims: emb.length,
  };
}

export async function embedImageFromDataUrl(dataUrl: string): Promise<SiglipEmbedResult> {
  if (process.env.RUNPOD_SIGLIP_ENDPOINT_ID?.trim()) {
    return embedViaRunpod(dataUrl);
  }

  const baseUrl = process.env.SIGLIP_SERVICE_URL?.trim();
  const allowMock = process.env.SIGLIP_MOCK === 'true';

  if (!baseUrl) {
    if (!allowMock) {
      throw new Error(
        'SIGLIP_SERVICE_URL manquant. Lancez le service Python (services/siglip-embed) ou définissez SIGLIP_MOCK=true pour un mock de test.'
      );
    }
    return {
      embedding: mockEmbeddingFromDataUrl(dataUrl),
      model: 'mock-hash',
      dims: DEFAULT_DIMS,
      mocked: true,
    };
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: dataUrl }),
    // Premier appel : chargement du modèle sur CPU (peut dépasser 1 min)
    signal: AbortSignal.timeout(180_000),
  });

  const rawBody = await res.text();
  if (!res.ok) {
    try {
      const errJson = JSON.parse(rawBody) as { detail?: string; type?: string };
      const msg = errJson.detail ?? rawBody;
      throw new Error(
        `SigLIP /embed : ${msg}${errJson.type ? ` (${errJson.type})` : ''}`
      );
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('SigLIP')) throw e;
      throw new Error(`SigLIP /embed : ${rawBody || res.statusText}`);
    }
  }

  const data = JSON.parse(rawBody) as {
    embedding?: number[];
    model?: string;
    dims?: number;
  };

  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('Réponse SigLIP invalide (embedding manquant)');
  }

  return {
    embedding: normalizeVector(data.embedding),
    model: data.model || DEFAULT_MODEL,
    dims: data.dims ?? data.embedding.length,
  };
}
