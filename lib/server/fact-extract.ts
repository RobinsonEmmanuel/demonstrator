import 'server-only';

import type { SpanFact } from '@/types/fact-check';
import { generateJson } from '@/lib/server/openai-client';

export interface ExtractedFact {
  id: string;
  verbatim: string;
}

/**
 * OpenAI : liste les faits avec verbatims exacts (copie du texte assistant).
 */
export async function extractFactsFromText(assistantText: string): Promise<ExtractedFact[]> {
  const quoted = JSON.stringify(assistantText);

  const prompt = `Extrais les énoncés factuels vérifiables du texte suivant : dates, chiffres, statistiques, faits historiques ou scientifiques vérifiables, affirmations précises sur des lieux, bâtiments, personnalités, classements officiels.

Règles strictes :
- Chaque "verbatim" doit être une copie EXACTE d'un passage du texte (mêmes caractères, mêmes espaces, même ponctuation).
- Préfère des passages courts (une phrase ou une proposition), sans chevauchement entre deux entrées.
- Maximum 35 faits. Si le texte est court, moins.

Texte (chaîne JSON — extrais les verbatims depuis le contenu décodé de cette chaîne) :
${quoted}

Réponds UNIQUEMENT en JSON : { "facts": [ { "id": "f1", "verbatim": "…" } ] }`;

  const raw = (await generateJson(prompt, 10_000)) as { facts?: ExtractedFact[] };
  const facts = (raw.facts ?? []).filter((f) => f?.id && typeof f.verbatim === 'string');
  return facts.map((f) => ({
    id: String(f.id),
    verbatim: f.verbatim,
  }));
}

/**
 * Associe chaque verbatim à une plage de caractères dans le texte complet (première occurrence non chevauchante).
 */
export function attachSpans(fullText: string, facts: ExtractedFact[]): SpanFact[] {
  const used: Array<{ start: number; end: number }> = [];

  function overlaps(start: number, end: number): boolean {
    return used.some((u) => start < u.end && u.start < end);
  }

  const out: SpanFact[] = [];

  for (const f of facts) {
    const needle = f.verbatim;
    if (!needle) continue;

    let pos = 0;
    let chosen = -1;
    while (pos < fullText.length) {
      const j = fullText.indexOf(needle, pos);
      if (j === -1) break;
      const end = j + needle.length;
      if (!overlaps(j, end)) {
        chosen = j;
        break;
      }
      pos = j + 1;
    }

    if (chosen === -1) continue;

    used.push({ start: chosen, end: chosen + needle.length });
    out.push({
      id: f.id,
      verbatim: needle,
      start: chosen,
      end: chosen + needle.length,
    });
  }

  out.sort((a, b) => a.start - b.start);
  return out;
}
