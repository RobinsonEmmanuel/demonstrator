import 'server-only';

import type { ExtractedField, FactVerificationResult } from '@/types/fact-check';
import { generateJson } from '@/lib/server/openai-client';

const MAX_DB_JSON_CHARS = 90_000;

type DbFieldResult = {
  field: string;
  label?: string;
  value?: string;
  status: 'valid' | 'invalid' | 'uncertain';
  validated_points?: Array<{
    point: string;
    source_display?: string;
    source_type?: string;
  }>;
  invalid_points?: Array<{
    point: string;
    correction?: string;
    source_display?: string;
    source_type?: string;
  }>;
  comment?: string | null;
};

function truncateDatabaseJson(raw: string): { text: string; truncated: boolean } {
  if (raw.length <= MAX_DB_JSON_CHARS) return { text: raw, truncated: false };
  return {
    text: `${raw.slice(0, MAX_DB_JSON_CHARS)}\n… [JSON tronqué pour l'analyse]`,
    truncated: true,
  };
}

function mapDbResults(
  results: DbFieldResult[],
  fields: ExtractedField[]
): FactVerificationResult[] {
  return fields.map((f) => {
    const match =
      results.find((r) => r.field === f.name) ??
      results.find((r) => r.label === f.label);

    const validated_points = (match?.validated_points ?? []).map((p) => ({
      point: p.point,
      source_display: p.source_display ?? 'Base de données',
      source_type: 'database',
    }));

    const invalid_points = (match?.invalid_points ?? []).map((p) => ({
      point: p.point,
      correction: p.correction,
      source_display: p.source_display ?? 'Base de données',
      source_type: 'database',
    }));

    return {
      id: f.id,
      field: f.name,
      label: f.label,
      value: f.value,
      status: match?.status ?? 'uncertain',
      comment:
        match?.comment ??
        (match ? null : 'Aucune correspondance trouvée dans le référentiel JSON.'),
      validated_points,
      invalid_points,
    };
  });
}

/**
 * Niveau 1 — compare chaque champ extrait au JSON fourni par l'utilisateur.
 */
export async function verifyFieldsAgainstDatabase(
  fields: ExtractedField[],
  databaseJson: unknown
): Promise<FactVerificationResult[]> {
  if (fields.length === 0) return [];

  const dbString = JSON.stringify(databaseJson, null, 2);
  const { text: dbForPrompt, truncated } = truncateDatabaseJson(dbString);

  const fieldsBlock = fields
    .map(
      (f) =>
        `- field="${f.name}" label="${f.label}" value=${JSON.stringify(f.value)}`
    )
    .join('\n');

  const prompt = `Tu es un contrôleur qualité éditorial. Tu compares des faits extraits d'un texte touristique avec un **export JSON** de base de données (référentiel interne POI / CMS).

Pour **chaque champ** listé ci-dessous :
- status "valid" : le texte est cohérent avec la base (même sens, valeurs équivalentes ou plus précises dans le texte).
- status "invalid" : contradiction claire avec la base — indique la correction attendue depuis la BDD.
- status "uncertain" : information absente, ambiguë ou non vérifiable dans le JSON fourni.

Règles :
- Cherche dans tout le JSON (chemins imbriqués, tableaux, variantes de libellés).
- validated_points : ce qui confirme le champ, avec source_display = chemin JSON court (ex. "horaires.ouverture" ou "tarifs[0].prix").
- invalid_points : contradictions uniquement, avec correction issue de la BDD si possible.
- source_type = "database" pour tous les points.
- Ne invente pas de données absentes du JSON.
- Un champ peut avoir plusieurs validated_points si plusieurs sous-faits sont confirmés.

${truncated ? '⚠️ Le JSON a été tronqué — signale dans comment si une vérification est incomplète pour ce motif.\n\n' : ''}JSON base de données :
${dbForPrompt}

Champs à vérifier :
${fieldsBlock}

Réponds UNIQUEMENT en JSON :
{
  "results": [
    {
      "field": "tarif",
      "label": "Tarif",
      "value": "…",
      "status": "valid|invalid|uncertain",
      "validated_points": [{ "point": "…", "source_display": "chemin.json" }],
      "invalid_points": [{ "point": "…", "correction": "…", "source_display": "chemin.json" }],
      "comment": "…"
    }
  ]
}`;

  const raw = (await generateJson(prompt, 16_000)) as { results?: DbFieldResult[] };
  return mapDbResults(raw.results ?? [], fields);
}

export function parseDatabaseJsonInput(input: unknown): {
  ok: true;
  data: unknown;
} | {
  ok: false;
  error: string;
} {
  if (input === null || input === undefined) {
    return { ok: false, error: 'JSON de base de données manquant.' };
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, error: 'JSON de base de données vide.' };
    try {
      return { ok: true, data: JSON.parse(trimmed) };
    } catch {
      return { ok: false, error: 'JSON invalide — vérifiez la syntaxe.' };
    }
  }

  if (typeof input === 'object') {
    return { ok: true, data: input };
  }

  return { ok: false, error: 'Format JSON non reconnu.' };
}
