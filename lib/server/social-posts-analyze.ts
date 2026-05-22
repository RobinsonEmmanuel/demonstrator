import 'server-only';

import { generateJson } from '@/lib/server/openai-client';
import type { SitPoiSnapshot, SitReferentialField } from '@/lib/sit-draft-fields';
import type {
  SocialPost,
  SocialPostPick,
  SitDbUpdateSuggestion,
} from '@/types/social-watch';

type LlmEngagementOutput = {
  picks?: Array<{
    postId?: string;
    reaction?: string;
    justification?: string;
    suggestedComment?: string;
  }>;
};

type LlmDbUpdateItem = {
  poiId?: string;
  poiName?: string;
  postId?: string;
  blockId?: string;
  sectionId?: string;
  fieldId?: string;
  currentValue?: string;
  suggestedValue?: string;
  justification?: string;
};

type LlmDbUpdatesOutput = {
  dbUpdates?: LlmDbUpdateItem[];
};

export type SocialPostsAnalysisResult = {
  picks: SocialPostPick[];
  dbUpdates: SitDbUpdateSuggestion[];
};

function normalizePicks(
  raw: LlmEngagementOutput,
  posts: SocialPost[]
): SocialPostPick[] {
  const picks = Array.isArray(raw.picks) ? raw.picks : [];
  const validIds = new Set(posts.map((p) => p.id));
  const normalized: SocialPostPick[] = [];

  for (const pick of picks) {
    if (!pick.postId || !validIds.has(pick.postId)) continue;
    const reaction =
      pick.reaction === 'comment' || pick.reaction === 'like'
        ? pick.reaction
        : 'like';
    const justification =
      typeof pick.justification === 'string' ? pick.justification.trim() : '';
    if (!justification) continue;

    const item: SocialPostPick = {
      postId: pick.postId,
      reaction,
      justification,
    };
    if (reaction === 'comment' && typeof pick.suggestedComment === 'string') {
      const c = pick.suggestedComment.trim();
      if (c) item.suggestedComment = c;
    }
    normalized.push(item);
    if (normalized.length >= 10) break;
  }

  return normalized;
}

function fieldKey(
  poiId: string,
  blockId: string,
  sectionId: string,
  fieldId: string
): string {
  return `${poiId}|${blockId}|${sectionId}|${fieldId}`;
}

function normalizeComparableValue(s: string): string {
  const t = s.trim();
  if (!t) return '';
  if ((t.startsWith('[') || t.startsWith('{')) && t.length > 1) {
    try {
      return JSON.stringify(JSON.parse(t));
    } catch {
      /* brut */
    }
  }
  return t.replace(/\s+/g, ' ');
}

function valuesDiffer(current: string, suggested: string): boolean {
  const a = normalizeComparableValue(current);
  const b = normalizeComparableValue(suggested);
  if (!a || a === '—') return true;
  return a !== b;
}

function resolvePost(
  posts: SocialPost[],
  postId?: string,
  poiName?: string
): SocialPost | undefined {
  if (postId?.trim()) {
    const id = postId.trim();
    const exact = posts.find((p) => p.id === id);
    if (exact) return exact;
    const partial = posts.find(
      (p) => p.id.includes(id) || id.includes(p.id)
    );
    if (partial) return partial;
    const byUrl = posts.find(
      (p) => p.postUrl === id || (p.postUrl && p.postUrl.includes(id))
    );
    if (byUrl) return byUrl;
  }

  if (poiName?.trim()) {
    const n = poiName.trim().toLowerCase();
    return posts.find((p) => {
      const pn = p.poiName?.toLowerCase() ?? '';
      return pn.includes(n) || n.includes(pn);
    });
  }

  return undefined;
}

function resolvePoiId(
  referential: SitPoiSnapshot[],
  poiId?: string,
  poiName?: string,
  postPoiId?: string
): string | undefined {
  if (poiId && referential.some((r) => r.poiId === poiId)) return poiId;
  if (postPoiId && referential.some((r) => r.poiId === postPoiId)) return postPoiId;

  if (poiName?.trim()) {
    const n = poiName.trim().toLowerCase();
    const match = referential.find((r) => {
      const rn = r.poiName.toLowerCase();
      return rn.includes(n) || n.includes(rn);
    });
    return match?.poiId;
  }

  return undefined;
}

function resolveReferentialField(
  ref: SitPoiSnapshot,
  blockId: string,
  sectionId: string,
  fieldId: string
): SitReferentialField | undefined {
  const exact = ref.fields.find(
    (f) =>
      f.blockId === blockId &&
      f.sectionId === sectionId &&
      f.fieldId === fieldId
  );
  if (exact) return exact;

  return ref.fields.find((f) => f.fieldId === fieldId);
}

function parseDbUpdatesRaw(raw: unknown): LlmDbUpdateItem[] {
  if (Array.isArray(raw)) return raw as LlmDbUpdateItem[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as LlmDbUpdatesOutput).dbUpdates)) {
    return (raw as LlmDbUpdatesOutput).dbUpdates!;
  }
  return [];
}

function buildFieldCatalog(referential: SitPoiSnapshot[]): string {
  return referential
    .map((poi) => {
      const paths = poi.fields.map(
        (f) => `${f.blockId} / ${f.sectionId} / ${f.fieldId}`
      );
      return `POI ${poi.poiId} (${poi.poiName}):\n${paths.join('\n')}`;
    })
    .join('\n\n');
}

function normalizeDbUpdates(
  raw: unknown,
  posts: SocialPost[],
  referential: SitPoiSnapshot[]
): SitDbUpdateSuggestion[] {
  const items = parseDbUpdatesRaw(raw);
  const normalized: SitDbUpdateSuggestion[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const u of items) {
    if (!u.blockId || !u.sectionId || !u.fieldId) {
      skipped++;
      continue;
    }

    const post = resolvePost(posts, u.postId, u.poiName);
    if (!post) {
      skipped++;
      continue;
    }

    const poiId = resolvePoiId(referential, u.poiId, u.poiName, post.poiId);
    if (!poiId) {
      skipped++;
      continue;
    }

    const refPoi = referential.find((r) => r.poiId === poiId);
    if (!refPoi) {
      skipped++;
      continue;
    }

    const refField = resolveReferentialField(
      refPoi,
      u.blockId,
      u.sectionId,
      u.fieldId
    );

    const blockId = refField?.blockId ?? u.blockId;
    const sectionId = refField?.sectionId ?? u.sectionId;
    const fieldId = refField?.fieldId ?? u.fieldId;

    const key = fieldKey(poiId, blockId, sectionId, fieldId);
    if (seen.has(key)) continue;

    const currentFromRef = refField?.value ?? '';
    const currentValue =
      (typeof u.currentValue === 'string' ? u.currentValue.trim() : '') ||
      currentFromRef ||
      '—';
    const suggestedValue =
      typeof u.suggestedValue === 'string' ? u.suggestedValue.trim() : '';
    const justification =
      typeof u.justification === 'string' ? u.justification.trim() : '';

    if (!suggestedValue || !justification) {
      skipped++;
      continue;
    }
    if (!valuesDiffer(currentValue, suggestedValue)) {
      skipped++;
      continue;
    }

    normalized.push({
      poiId,
      poiName:
        (typeof u.poiName === 'string' && u.poiName.trim()) || refPoi.poiName,
      postId: post.id,
      blockId,
      sectionId,
      fieldId,
      currentValue,
      suggestedValue,
      justification,
    });
    seen.add(key);
    if (normalized.length >= 15) break;
  }

  if (items.length > 0 && normalized.length === 0) {
    console.warn(
      `[social-watch] ${items.length} mise(s) à jour IA reçue(s), 0 retenue(s) (${skipped} filtrée(s))`
    );
  }

  return normalized;
}

export async function analyzeSocialPosts(
  posts: SocialPost[],
  referential: SitPoiSnapshot[]
): Promise<SocialPostsAnalysisResult> {
  if (posts.length === 0) {
    return { picks: [], dbUpdates: [] };
  }

  const compactPosts = posts.slice(0, 80).map((p) => ({
    id: p.id,
    poiId: p.poiId ?? null,
    poiName: p.poiName ?? '—',
    publishedAt: p.publishedAt,
    text: p.text.slice(0, 800),
    likes: p.likes ?? 0,
    comments: p.comments ?? 0,
    postUrl: p.postUrl,
  }));

  const engagementPrompt = `Tu es le community manager d'un office de tourisme (Le Havre et territoire).
Sélectionne AU MAXIMUM 10 posts pertinents pour réagir (like ou commentaire).

JSON attendu : { "picks": [ { "postId", "reaction": "like"|"comment", "justification", "suggestedComment"? } ] }

Posts :
${JSON.stringify(compactPosts)}`;

  const engagementRaw = (await generateJson(engagementPrompt, 8000)) as LlmEngagementOutput;
  const picks = normalizePicks(engagementRaw, posts);

  if (referential.length === 0) {
    return { picks, dbUpdates: [] };
  }

  const compactRef = referential.map((r) => ({
    poiId: r.poiId,
    poiName: r.poiName,
    fields: r.fields.map((f) => ({
      blockId: f.blockId,
      sectionId: f.sectionId,
      fieldId: f.fieldId,
      value: f.value,
    })),
  }));

  const fieldCatalog = buildFieldCatalog(referential);

  const dbPrompt = `Tu es responsable qualité des données touristiques (référentiel SIT Region Lovers).
Compare les publications Facebook avec le référentiel JSON ci-dessous (parcours blocks → sections → fields).

Pour chaque fait NOUVEAU dans un post qui contredit ou complète un champ existant, propose une entrée dbUpdates.
Utilise UNIQUEMENT des chemins blockId / sectionId / fieldId listés dans le catalogue (ou présents dans le JSON référentiel).
Reprends postId EXACTEMENT depuis la liste des posts (champ "id").
Reprends poiId EXACTEMENT depuis le référentiel.

Exemples : horaires, fermetures exceptionnelles, visites guidées, tarifs, événements datés.

Ne propose PAS : marketing vague, URLs déjà correctes, doublons identiques à la base.

JSON : { "dbUpdates": [ { "poiId", "poiName", "postId", "blockId", "sectionId", "fieldId", "currentValue", "suggestedValue", "justification" } ] }
Plusieurs champs possibles. Maximum 15. Sinon { "dbUpdates": [] }

=== Catalogue des champs (block / section / field) ===
${fieldCatalog}

=== Posts Facebook ===
${JSON.stringify(compactPosts)}

=== Référentiel SIT (valeurs actuelles) ===
${JSON.stringify(compactRef)}`;

  const dbRaw = await generateJson(dbPrompt, 12_000);
  const dbUpdates = normalizeDbUpdates(dbRaw, posts, referential);

  return { picks, dbUpdates };
}
