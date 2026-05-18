'use client';

import type { ExtractedField, FactVerificationResult } from '@/types/fact-check';
import { FieldValidationBlock } from '@/components/fact-check/FieldValidationBlock';

function statusBadge(v?: FactVerificationResult): { text: string; className: string } {
  if (!v) return { text: '—', className: 'bg-slate-100 text-slate-600' };
  const hasInv = (v.invalid_points?.length ?? 0) > 0;
  if (hasInv || v.status === 'invalid')
    return { text: 'Non validé', className: 'bg-red-100 text-red-800' };
  if (v.status === 'uncertain')
    return { text: 'Incertain', className: 'bg-amber-100 text-amber-800' };
  return { text: 'Validé', className: 'bg-emerald-100 text-emerald-800' };
}

export function FieldValidationList({
  fields,
  verificationById,
}: {
  fields: ExtractedField[];
  verificationById: Record<string, FactVerificationResult>;
}) {
  return (
    <ul className="space-y-4 mb-4" aria-label="Validation par champ">
      {fields.map((f) => {
        const v = verificationById[f.id];
        const badge = statusBadge(v);
        return (
          <li
            key={f.id}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${badge.className}`}
              >
                {badge.text}
              </span>
              <p className="text-sm font-medium text-gray-900">{f.label}</p>
            </div>
            <p className="text-sm text-gray-700 mt-1 leading-snug border-l-2 border-gray-200 pl-2">
              {f.value}
            </p>
            <FieldValidationBlock verification={v} />
          </li>
        );
      })}
    </ul>
  );
}
