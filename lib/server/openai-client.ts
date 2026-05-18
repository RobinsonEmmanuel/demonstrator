import 'server-only';

import OpenAI from 'openai';

export function supportsReasoning(model: string): boolean {
  return (
    model.startsWith('gpt-5') ||
    model.startsWith('o1') ||
    model.startsWith('o3') ||
    model.startsWith('o4')
  );
}

export function createOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY manquante');
  return new OpenAI({ apiKey: key, timeout: 120_000 });
}

export function defaultModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini';
}

function extractResponseText(response: { output?: Array<{ content?: Array<{ type: string; text?: string }> }> }): string {
  const out = response.output ?? [];
  return out
    .flatMap((item) => item.content || [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text)
    .join('\n');
}

/**
 * Réponse libre (prose) — modèles reasoning : API Responses.
 */
export async function generateProse(userPrompt: string): Promise<string> {
  const client = createOpenAI();
  const model = defaultModel();
  if (!supportsReasoning(model)) {
    const r = await client.chat.completions.create({
      model,
      max_tokens: 16_000,
      messages: [{ role: 'user', content: userPrompt }],
    });
    return r.choices[0]?.message?.content ?? '';
  }

  const response = await client.responses.create({
    model,
    reasoning: { effort: 'medium' },
    max_output_tokens: 16_000,
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text: userPrompt }],
      },
    ],
  } as Parameters<typeof client.responses.create>[0]);

  const text = extractResponseText(response as any);
  if (!text) throw new Error('Réponse OpenAI vide');
  return text;
}

function cleanJsonBlock(s: string): string {
  let c = s.trim();
  if (c.startsWith('```json')) c = c.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '');
  else if (c.startsWith('```')) c = c.replace(/^```\s*/i, '').replace(/\s*```\s*$/i, '');
  return c.trim();
}

/**
 * JSON structuré — instruction JSON forcée (comme redactor-guide OpenAIService.generateJSON).
 */
export async function generateJson(prompt: string, maxOutput = 12_000): Promise<unknown> {
  const client = createOpenAI();
  const model = defaultModel();
  const jsonInstruction =
    'Tu es un assistant qui répond UNIQUEMENT en JSON valide, sans markdown, sans balises, sans texte avant ou après.';

  if (!supportsReasoning(model)) {
    const r = await client.chat.completions.create({
      model,
      max_tokens: maxOutput,
      messages: [{ role: 'user', content: `${jsonInstruction}\n\n${prompt}` }],
    });
    const content = r.choices[0]?.message?.content ?? '';
    return JSON.parse(cleanJsonBlock(content));
  }

  const effectiveMax = Math.max(maxOutput, 8000);
  const response = await client.responses.create({
    model,
    reasoning: { effort: 'low' },
    max_output_tokens: effectiveMax,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: `${jsonInstruction}\n\n${prompt}` },
        ],
      },
    ],
  } as Parameters<typeof client.responses.create>[0]);

  const content = extractResponseText(response as any);
  if (!content) throw new Error('Réponse JSON OpenAI vide');
  return JSON.parse(cleanJsonBlock(content));
}
