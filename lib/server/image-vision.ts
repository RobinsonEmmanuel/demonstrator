import 'server-only';

import { createOpenAI } from '@/lib/server/openai-client';
import { visionModel } from '@/lib/server/vision-model';
import type {
  CompositionType,
  ImageAnalysis,
  ImageClassifyContext,
} from '@/types/image-classify';

const VALID_COMPOSITION_TYPES: CompositionType[] = [
  'wide_exterior',
  'framed_view',
  'architectural_detail',
  'interior_scene',
  'panorama',
  'people_focus',
  'other',
];

function normalizeCompositionType(raw: unknown): CompositionType {
  const v = String(raw ?? '').trim() as CompositionType;
  return VALID_COMPOSITION_TYPES.includes(v) ? v : 'other';
}

function cleanJson(s: string): string {
  let c = s.trim();
  if (c.startsWith('```json')) c = c.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '');
  else if (c.startsWith('```')) c = c.replace(/^```\s*/i, '').replace(/\s*```\s*$/i, '');
  return c.trim();
}

function buildVisionPrompt(context?: ImageClassifyContext): string {
  const place =
    context?.poiName && context?.destination
      ? `Le lieu illustré est **${context.poiName}** (${context.destination}).`
      : context?.poiName
        ? `Le lieu illustré est **${context.poiName}**.`
        : '';

  return `Tu es un expert en photo éditoriale tourisme et en conformité des visuels pour guides de voyage.

${place}

Analyse cette image et réponds UNIQUEMENT en JSON valide (sans markdown).

**Description**
- shortDescription : 1 phrase normalisée pour détecter les doublons — indique TOUJOURS le sujet principal, le cadrage (ex. « vue frontale château au-dessus de l'eau »), la météo/lumière, et tout élément gênant au premier plan (main, personne, objet). Deux photos du même lieu au même angle doivent avoir des descriptions très proches.
- fullDescription : description détaillée 3–6 phrases
- sceneType : exterior | interior | detail | food | panorama | night | people | other
- compositionType : type de cadrage pour la détection de doublons (choisir UNE valeur) :
  - wide_exterior : vue large du lieu (monument + environnement, rivière, parc, façade entière)
  - framed_view : sujet vu à travers un cadre (fenêtre, porte, arcade, arche) — NE PAS confondre avec wide_exterior
  - architectural_detail : gros plan sur un élément (statue, rosace, escalier, détail de façade)
  - interior_scene : intérieur (salle, galerie, hall)
  - panorama : panorama très large / format paysage étendu
  - people_focus : personnes clairement au centre de la composition
  - other : si aucune catégorie ne convient
- tags : 5–12 tags courts (français), type fiche POI (façade, salle, vue, accès PMR…)
- suggestedCaption : légende éditoriale courte
- notablePoints : [{ "label": "élément visible", "region": "avant-plan|centre|arrière-plan" }]

**Qualité technique** (technical)
- resolutionOk, sharpnessOk, horizonLevel : booléens
- issues : liste de problèmes ("flou", "sous-exposition", "basse résolution"…)

**Score esthétique** (aesthetic) — notes entières 1–10 :
- composition : cadrage, équilibre
- lighting : lumière, exposition
- editorialImpact : attractivité pour publication guide
- subjectRelevance : pertinence pour illustrer le lieu${context?.poiName ? ` (${context.poiName})` : ''}
- overall : moyenne pondérée (subjectRelevance ×1.5, le reste ×1)

**Conformité** (compliance) — mode éditorial / RGPD light :
- status global : pass | warning | fail
- checks : tableau avec EXACTEMENT ces id (un par ligne) :
  - faces_identifiable : visages clairement identifiables (RGPD)
  - minors_without_context : mineurs mis en avant sans contexte éditorial clair
  - logos_trademarks : logos ou marques tiers dominants
  - watermark_or_stock : filigrane, watermark, look banque d'images
  - text_overlay_heavy : texte incrusté gênant ou illisible
  - inappropriate_content : contenu choquant, offensant, trompeur
  - misleading_place : photo ne correspondant manifestement pas au lieu annoncé

Pour chaque check : { "id", "label" (français court), "status": pass|warning|fail, "detail" (1 phrase) }
- fail si problème grave ; warning si doute ou mineur ; pass sinon.

Format :
{
  "shortDescription": "...",
  "fullDescription": "...",
  "sceneType": "exterior",
  "compositionType": "wide_exterior",
  "tags": ["..."],
  "suggestedCaption": "...",
  "notablePoints": [],
  "technical": { "resolutionOk": true, "sharpnessOk": true, "horizonLevel": true, "issues": [] },
  "aesthetic": { "composition": 8, "lighting": 7, "editorialImpact": 8, "subjectRelevance": 9, "overall": 8 },
  "compliance": { "status": "pass", "checks": [{ "id": "faces_identifiable", "label": "...", "status": "pass", "detail": "..." }] }
}`;
}

function normalizeAnalysis(raw: Record<string, unknown>): ImageAnalysis {
  const aesthetic = (raw.aesthetic as Record<string, number>) ?? {};
  const comp = raw.compliance as Record<string, unknown> | undefined;
  const checks = Array.isArray(comp?.checks) ? comp!.checks : [];

  const clamp = (n: unknown, def = 5) => {
    const v = typeof n === 'number' ? Math.round(n) : def;
    return Math.min(10, Math.max(1, v));
  };

  const overall =
    typeof aesthetic.overall === 'number'
      ? clamp(aesthetic.overall)
      : Math.round(
          (clamp(aesthetic.composition) +
            clamp(aesthetic.lighting) +
            clamp(aesthetic.editorialImpact) +
            clamp(aesthetic.subjectRelevance) * 1.5) /
            4.5
        );

  return {
    shortDescription: String(raw.shortDescription ?? ''),
    fullDescription: String(raw.fullDescription ?? ''),
    sceneType: (raw.sceneType as ImageAnalysis['sceneType']) ?? 'other',
    compositionType: normalizeCompositionType(raw.compositionType),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    suggestedCaption: raw.suggestedCaption ? String(raw.suggestedCaption) : undefined,
    notablePoints: Array.isArray(raw.notablePoints)
      ? (raw.notablePoints as Array<{ label?: string; region?: string }>).map((p) => ({
          label: String(p.label ?? ''),
          region: p.region ? String(p.region) : undefined,
        }))
      : [],
    technical: {
      resolutionOk: !!(raw.technical as Record<string, boolean>)?.resolutionOk,
      sharpnessOk: !!(raw.technical as Record<string, boolean>)?.sharpnessOk,
      horizonLevel: !!(raw.technical as Record<string, boolean>)?.horizonLevel,
      issues: Array.isArray((raw.technical as Record<string, unknown>)?.issues)
        ? ((raw.technical as Record<string, unknown>).issues as unknown[]).map(String)
        : [],
    },
    aesthetic: {
      composition: clamp(aesthetic.composition),
      lighting: clamp(aesthetic.lighting),
      editorialImpact: clamp(aesthetic.editorialImpact),
      subjectRelevance: clamp(aesthetic.subjectRelevance),
      overall,
    },
    compliance: {
      status: (['pass', 'warning', 'fail'].includes(String(comp?.status))
        ? comp!.status
        : 'warning') as ImageAnalysis['compliance']['status'],
      checks: checks.map((c: Record<string, unknown>) => ({
        id: String(c.id ?? 'unknown'),
        label: String(c.label ?? c.id ?? 'Contrôle'),
        status: (['pass', 'warning', 'fail'].includes(String(c.status))
          ? c.status
          : 'warning') as ImageAnalysis['compliance']['checks'][0]['status'],
        detail: String(c.detail ?? ''),
      })),
    },
  };
}

export async function analyzeImageWithVision(
  dataUrl: string,
  context?: ImageClassifyContext
): Promise<ImageAnalysis> {
  const client = createOpenAI();
  const model = visionModel();

  const response = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildVisionPrompt(context) },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Réponse vision vide');

  const parsed = JSON.parse(cleanJson(content)) as Record<string, unknown>;
  return normalizeAnalysis(parsed);
}
