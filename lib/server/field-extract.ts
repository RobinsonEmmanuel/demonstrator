import 'server-only';

import type { ExtractedField, SpanFact } from '@/types/fact-check';
import { generateJson } from '@/lib/server/openai-client';

/**
 * Découpe le texte en champs vérifiables (comme une fiche POI redactor-guide).
 */
export async function extractFieldsFromText(assistantText: string): Promise<ExtractedField[]> {
  const quoted = JSON.stringify(assistantText);

  const prompt = `Tu analyses un texte touristique sur un lieu (musée, monument, activité…).

Découpe-le en **champs structurés** distincts, comme sur une fiche éditoriale POI, pour une validation factuelle champ par champ.

Types de champs à utiliser quand l'information est présente (name en snake_case, label en français) :
- tarif, horaires, acces, accessibilite, equipements, contact, duree_visite, reservation
- presentation, historique, collections, conseils, photographie, langues, public
- autre information factuelle isolée (name court et explicite)

Règles :
- Chaque "value" = le contenu factuel à vérifier (phrase courte ou liste), max 400 caractères.
- Un seul thème par champ (ex. tarifs séparés des horaires).
- Si un paragraphe liste plusieurs équipements ou attractions, crée un champ **description** ou **equipements** dont la value regroupe la liste — la validation détaillera chaque point.
- "sourceSnippet" = copie EXACTE d'un passage du texte contenant cette value (pour surlignage), ou la value si elle apparaît telle quelle.
- Ne duplique pas le même fait dans plusieurs champs.
- Maximum 25 champs. Ignore les formules vagues sans fait vérifiable.

Texte (chaîne JSON) :
${quoted}

Réponds UNIQUEMENT en JSON :
{
  "fields": [
    { "name": "tarif", "label": "Tarif", "value": "…", "sourceSnippet": "…" }
  ]
}`;

  const raw = (await generateJson(prompt, 12_000)) as { fields?: ExtractedField[] };
  const fields = (raw.fields ?? []).filter(
    (f) => f?.name && f?.label && typeof f.value === 'string' && f.value.trim()
  );

  return fields.map((f, i) => ({
    name: String(f.name).trim().replace(/\s+/g, '_'),
    label: String(f.label).trim(),
    value: f.value.trim().slice(0, 400),
    sourceSnippet:
      typeof f.sourceSnippet === 'string' && f.sourceSnippet.trim()
        ? f.sourceSnippet.trim()
        : f.value.trim(),
    id: `f${i + 1}`,
  }));
}

/**
 * Relie chaque champ à une plage dans le texte (snippet ou value).
 */
export function attachFieldSpans(
  fullText: string,
  fields: ExtractedField[]
): SpanFact[] {
  const used: Array<{ start: number; end: number }> = [];

  function overlaps(start: number, end: number): boolean {
    return used.some((u) => start < u.end && u.start < end);
  }

  function findNeedle(needle: string): number {
    if (!needle) return -1;
    let pos = 0;
    while (pos < fullText.length) {
      const j = fullText.indexOf(needle, pos);
      if (j === -1) break;
      const end = j + needle.length;
      if (!overlaps(j, end)) return j;
      pos = j + 1;
    }
    return -1;
  }

  const out: SpanFact[] = [];

  for (const f of fields) {
    const needles = [f.sourceSnippet, f.value].filter(
      (n, i, arr) => n && arr.indexOf(n) === i
    );

    let chosen = -1;
    let needleUsed = '';

    for (const needle of needles) {
      const j = findNeedle(needle);
      if (j !== -1) {
        chosen = j;
        needleUsed = needle;
        break;
      }
    }

    if (chosen === -1) continue;

    const end = chosen + needleUsed.length;
    used.push({ start: chosen, end });
    out.push({
      id: f.id,
      field: f.name,
      label: f.label,
      value: f.value,
      verbatim: needleUsed,
      start: chosen,
      end,
    });
  }

  out.sort((a, b) => a.start - b.start);
  return out;
}
