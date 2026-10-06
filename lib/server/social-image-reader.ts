import 'server-only';

import { createOpenAI } from '@/lib/server/openai-client';
import { visionModel } from '@/lib/server/vision-model';
import type { SocialPost } from '@/types/social-watch';

/** Images lues par post (les plus nombreuses : carrousels) — le coût suit ce plafond. */
const MAX_IMAGES_PER_POST = 2;
const MAX_BYTES = 8 * 1024 * 1024;
const CONCURRENCY = 4;
const NO_TEXT = 'AUCUN_TEXTE';

const PROMPT = `Tu lis l'image d'une publication de réseau social d'un acteur touristique (hôtel, restaurant, musée, casino…).
Réponds UNIQUEMENT par un objet JSON avec ces clés :
  "transcription" : tout le texte visible sur l'image (affiche, menu, prix, dates, horaires), ligne par ligne, exactement comme écrit. Ne traduis rien, ne reformule rien. Si aucun texte lisible : "${NO_TEXT}".
  "description" : UNE phrase sur ce que montre l'image (ex. « affiche du festival… », « plat de saison », « façade de l'hôtel au coucher du soleil »).
N'invente aucune date ni année qui ne figure pas sur l'image.`;

export type ImageReadReport = { read: number; failed: number; skipped: number };

async function downloadAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 demonstrator' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) {
    throw new Error(`type non image (${type || 'inconnu'})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('image trop lourde');
  return `data:${type};base64,${buf.toString('base64')}`;
}

function asText(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').join('\n').trim();
  return '';
}

async function readOneImage(url: string): Promise<string | null> {
  const dataUrl = await downloadAsDataUrl(url);
  const client = createOpenAI();
  const response = await client.chat.completions.create({
    model: visionModel(),
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'auto' } },
        ],
      },
    ],
  });
  const raw = response.choices[0]?.message?.content ?? '';
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return raw.trim() || null;
  }
  const transcription = asText(parsed.transcription);
  const description = asText(parsed.description);
  const parts = [
    transcription && transcription !== NO_TEXT ? `Texte : ${transcription}` : '',
    description ? `Image : ${description}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join('\n') : null;
}

/** Lit le texte des images de chaque post (en place). Un échec d'image n'interrompt rien. */
export async function readPostImages(posts: SocialPost[]): Promise<ImageReadReport> {
  const report: ImageReadReport = { read: 0, failed: 0, skipped: 0 };
  const jobs: { post: SocialPost; url: string }[] = [];
  for (const post of posts) {
    const urls = (post.imageUrls ?? []).slice(0, MAX_IMAGES_PER_POST);
    if (urls.length === 0) report.skipped += 1;
    for (const url of urls) jobs.push({ post, url });
  }

  const texts = new Map<SocialPost, string[]>();
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const { post, url } = jobs[next++];
      try {
        const text = await readOneImage(url);
        if (text) {
          texts.set(post, [...(texts.get(post) ?? []), text]);
          report.read += 1;
        }
      } catch (e) {
        report.failed += 1;
        console.warn('[social-image-reader]', e instanceof Error ? e.message : e);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

  for (const [post, list] of texts) post.imageText = list.join('\n---\n');
  return report;
}
