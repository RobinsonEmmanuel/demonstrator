'use client';

import type { FactVerificationResult } from '@/types/fact-check';

const SOURCE_TYPE_CFG: Record<string, { label: string; color: string }> = {
  official: { label: 'Officiel', color: 'bg-emerald-100 text-emerald-700' },
  institutional: { label: 'Institutionnel', color: 'bg-teal-100 text-teal-700' },
  media_high: { label: 'Presse inter.', color: 'bg-blue-100 text-blue-700' },
  media_local: { label: 'Presse locale', color: 'bg-sky-100 text-sky-700' },
  commercial: { label: 'Commercial', color: 'bg-amber-100 text-amber-700' },
  ugc: { label: 'Avis/forum', color: 'bg-gray-100 text-gray-500' },
};

function SourceTypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const cfg = SOURCE_TYPE_CFG[type];
  if (!cfg) return null;
  return (
    <span className={`ml-1 text-[10px] font-medium px-1 py-px rounded ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

type ValidPoint = NonNullable<FactVerificationResult['validated_points']>[number];
type InvalidPoint = NonNullable<FactVerificationResult['invalid_points']>[number];

function PointLine({
  p,
  kind,
}: {
  p: ValidPoint | InvalidPoint;
  kind: 'valid' | 'invalid';
}) {
  const color = kind === 'valid' ? 'text-emerald-700' : 'text-red-700';
  const icon = kind === 'valid' ? '✓' : '✗';

  return (
    <div className={`flex items-start gap-1.5 ${color} leading-snug`}>
      <span className="shrink-0 font-bold mt-0.5">{icon}</span>
      <span className="flex-1">
        {p.point}
        {kind === 'invalid' && 'correction' in p && p.correction && (
          <span className="ml-1">
            <span className="text-gray-500">→</span>
            <span className="ml-1 font-semibold text-red-800">{p.correction}</span>
          </span>
        )}
        <SourceTypeBadge type={p.source_type} />
        {p.source_display &&
          (p.source_url ? (
            <a
              href={p.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-gray-400 hover:text-blue-500 hover:underline"
            >
              {p.source_display}
            </a>
          ) : (
            <span className="ml-1 text-gray-400">{p.source_display}</span>
          ))}
      </span>
    </div>
  );
}

/** Bloc de validation par champ — même présentation que redactor-guide. */
export function FieldValidationBlock({
  verification: v,
}: {
  verification?: FactVerificationResult;
}) {
  if (!v) return null;

  const hasInvalid = (v.invalid_points?.length ?? 0) > 0;
  const hasValidated = (v.validated_points?.length ?? 0) > 0;

  const borderColor = hasInvalid
    ? 'border-l-red-400'
    : v.status === 'uncertain'
      ? 'border-l-amber-400'
      : 'border-l-emerald-400';

  return (
    <div className={`mt-2 border-l-2 pl-3 py-1 text-xs space-y-1.5 ${borderColor}`}>
      {hasValidated &&
        v.validated_points!.map((p, i) => <PointLine key={`v-${i}`} p={p} kind="valid" />)}

      {hasInvalid &&
        v.invalid_points!.map((p, i) => <PointLine key={`i-${i}`} p={p} kind="invalid" />)}

      {!hasValidated && !hasInvalid && v.comment && (
        <p className="text-gray-500 leading-snug">{v.comment}</p>
      )}
    </div>
  );
}
