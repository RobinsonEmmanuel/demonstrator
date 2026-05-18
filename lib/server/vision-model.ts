import 'server-only';

/** Modèle vision (analyse d'images). */
export function visionModel(): string {
  return process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o';
}
