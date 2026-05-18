'use client';

import type { FactVerificationResult, SpanFact } from '@/types/fact-check';
import { FactSpanWithTooltip } from '@/components/fact-check/FactSpanWithPortalTooltip';

type Seg =
  | { t: 'plain'; text: string }
  | { t: 'fact'; text: string; id: string; v?: FactVerificationResult };

function buildSegments(
  fullText: string,
  spans: SpanFact[],
  verificationById: Record<string, FactVerificationResult>
): Seg[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: Seg[] = [];
  let cursor = 0;

  for (const s of sorted) {
    if (s.start < cursor) continue;
    if (s.start > fullText.length) break;

    if (s.start > cursor) {
      out.push({ t: 'plain', text: fullText.slice(cursor, s.start) });
    }

    const end = Math.min(s.end, fullText.length);
    const slice = fullText.slice(s.start, end);
    out.push({
      t: 'fact',
      text: slice,
      id: s.id,
      v: verificationById[s.id],
    });
    cursor = end;
  }

  if (cursor < fullText.length) {
    out.push({ t: 'plain', text: fullText.slice(cursor) });
  }

  return out;
}

export function HighlightedAssistantResponse({
  text,
  spans,
  verificationById,
}: {
  text: string;
  spans: SpanFact[];
  verificationById: Record<string, FactVerificationResult>;
}) {
  const segs = buildSegments(text, spans, verificationById);

  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900">
      {segs.map((s, i) => {
        if (s.t === 'plain') {
          return <span key={i}>{s.text}</span>;
        }
        return (
          <FactSpanWithTooltip key={`${s.id}-${i}`} verification={s.v}>
            {s.text}
          </FactSpanWithTooltip>
        );
      })}
    </div>
  );
}
