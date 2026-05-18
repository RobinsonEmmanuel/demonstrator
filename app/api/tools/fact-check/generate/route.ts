import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/request-auth';
import { generateProse } from '@/lib/server/openai-client';

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt vide' }, { status: 400 });
    }

    const content = await generateProse(prompt);
    return NextResponse.json({ content });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[fact-check/generate]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur génération' },
      { status: 500 }
    );
  }
}
