import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/request-auth';
import { extractFieldsFromText, attachFieldSpans } from '@/lib/server/field-extract';
import { verifyFieldsWithSonar } from '@/lib/server/fact-check-perplexity';
import type { FactCheckAnalyzeResponse, FactVerificationResult } from '@/types/fact-check';

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const body = await request.json();
    const assistantText =
      typeof body.assistantText === 'string' ? body.assistantText : '';

    if (!assistantText.trim()) {
      return NextResponse.json({ error: 'Texte assistant vide' }, { status: 400 });
    }

    const fields = await extractFieldsFromText(assistantText);
    if (fields.length === 0) {
      const empty: FactCheckAnalyzeResponse = {
        fields: [],
        spans: [],
        verificationById: {},
        grounding_sources: [],
        consulted_sources: [],
        extractedCount: 0,
        placedCount: 0,
        unplacedIds: [],
      };
      return NextResponse.json(empty);
    }

    const {
      results: perplResults,
      grounding_sources,
      consulted_sources,
      place,
      officialDomains,
      officialPageUrls,
    } = await verifyFieldsWithSonar(assistantText, fields);

    const verificationById: Record<string, FactVerificationResult> = {};
    for (const r of perplResults) {
      if (r.id) verificationById[r.id] = r;
    }

    const spans = attachFieldSpans(assistantText, fields);
    const placedIds = new Set(spans.map((s) => s.id));
    const unplacedIds = fields.map((f) => f.id).filter((id) => !placedIds.has(id));

    const payload: FactCheckAnalyzeResponse = {
      fields,
      spans,
      verificationById,
      grounding_sources,
      consulted_sources,
      place: {
        nomPoi: place.nomPoi,
        destination: place.destination,
        clusterName: place.clusterName || undefined,
      },
      officialDomains,
      officialPageUrls,
      extractedCount: fields.length,
      placedCount: spans.length,
      unplacedIds,
    };

    return NextResponse.json(payload);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[fact-check/analyze]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur analyse' },
      { status: 500 }
    );
  }
}
