import 'server-only';

import { createOpenAI } from '@/lib/server/openai-client';
import { visionModel } from '@/lib/server/vision-model';
import type {
  GroupJudgement,
  GroupJudgementCriterion,
  ImageClassifyContext,
} from '@/types/image-classify';

/** Au-delà, on ne soumet que les meilleures candidates (coût et lisibilité). */
const MAX_IMAGES_JUDGED = 6;

const CRITERIA: GroupJudgementCriterion[] = [
  'composition',
  'lighting',
  'editorial_impact',
  'subject_relevance',
  'technical',
];

function buildPrompt(count: number, context?: ImageClassifyContext): string {
  const place = context?.poiName
    ? `Le lieu illustré est ${context.poiName}${context.destination ? ` (${context.destination})` : ''}.`
    : '';
  return `Tu es éditeur photo pour un guide de voyage. ${place}
Voici ${count} photos quasi identiques d'un même lieu (numérotées « Photo 1 » à « Photo ${count} »).
Compare-les ENTRE ELLES et désigne celle à publier. Ne note pas chaque photo isolément : cherche ce qui les DISTINGUE vraiment (ciel, lumière, reflets, cadrage, éléments gênants, netteté, présence de personnes).

Réponds UNIQUEMENT en JSON :
{
  "winner": numéro de la meilleure photo (1 à ${count}),
  "equivalent": true si aucune différence éditoriale réelle, sinon false,
  "decidingCriterion": "composition" | "lighting" | "editorial_impact" | "subject_relevance" | "technical",
  "summary": "UNE phrase : pourquoi la gagnante l'emporte sur les autres, en citant le fait visuel précis (ex. « ciel dégagé et reflet net, là où les autres ont un ciel couvert »)",
  "photos": [ { "index": numéro, "tag": "3 à 5 mots sur ce qui distingue CETTE photo (ex. « ciel dégagé, reflet net », « ciel couvert », « main au premier plan »)" } ]
}
Sois factuel : n'invente aucun détail absent des images. Si les photos sont vraiment équivalentes, mets equivalent à true.`;
}

/**
 * Jugement comparatif d'un groupe de doublons : une seule requête vision avec toutes les
 * images, pour départager ce que des notes individuelles (toutes à 8/10) ne distinguent pas.
 * Renvoie null en cas d'échec — l'appelant retombe alors sur le départage par scores.
 */
export async function judgeDuplicateGroup(
  members: { id: string; dataUrl: string }[],
  context?: ImageClassifyContext
): Promise<GroupJudgement | null> {
  const judged = members.slice(0, MAX_IMAGES_JUDGED);
  if (judged.length < 2) return null;

  try {
    const client = createOpenAI();
    const content: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail: 'low' } }
    > = [{ type: 'text', text: buildPrompt(judged.length, context) }];
    judged.forEach((m, i) => {
      content.push({ type: 'text', text: `Photo ${i + 1} :` });
      content.push({ type: 'image_url', image_url: { url: m.dataUrl, detail: 'low' } });
    });

    const response = await client.chat.completions.create({
      model: visionModel(),
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    });

    const raw = JSON.parse(response.choices[0]?.message?.content ?? '{}') as Record<
      string,
      unknown
    >;
    const winnerIdx = Number(raw.winner);
    if (!Number.isInteger(winnerIdx) || winnerIdx < 1 || winnerIdx > judged.length) return null;

    const criterion = CRITERIA.includes(raw.decidingCriterion as GroupJudgementCriterion)
      ? (raw.decidingCriterion as GroupJudgementCriterion)
      : null;

    const tagsByImageId: Record<string, string> = {};
    if (Array.isArray(raw.photos)) {
      for (const p of raw.photos as Array<Record<string, unknown>>) {
        const idx = Number(p.index);
        const tag = typeof p.tag === 'string' ? p.tag.trim() : '';
        if (Number.isInteger(idx) && idx >= 1 && idx <= judged.length && tag) {
          tagsByImageId[judged[idx - 1].id] = tag;
        }
      }
    }

    return {
      winnerId: judged[winnerIdx - 1].id,
      equivalent: raw.equivalent === true,
      decidingCriterion: criterion,
      summary: typeof raw.summary === 'string' ? raw.summary.trim() : '',
      tagsByImageId,
    };
  } catch (e) {
    console.warn('[image-group-judge]', e instanceof Error ? e.message : e);
    return null;
  }
}
