'use client';

import type { FactVerificationResult } from '@/types/fact-check';

const SOURCE_TYPE_CFG: Record<string, { label: string; color: string }> = {
  database: { label: 'Base de données', color: 'bg-violet-100 text-violet-800' },
  official: { label: 'Officiel', color: 'bg-emerald-100 text-emerald-700' },
  institutional: { label: 'Institutionnel', color: 'bg-teal-100 text-teal-700' },
  media_high: { label: 'Presse inter.', color: 'bg-blue-100 text-blue-700' },
  media_local: { label: 'Presse locale', color: 'bg-sky-100 text-sky-700' },
  commercial: { label: 'Commercial', color: 'bg-amber-100 text-amber-700' },
  ugc: { label: 'Avis / forum', color: 'bg-gray-100 text-gray-500' },
};

function SourceTypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const cfg = SOURCE_TYPE_CFG[type];
  if (!cfg) return null;
  return (
    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

type Point = NonNullable<FactVerificationResult['invalid_points']>[number];

function SourceLink({ url, display, type }: { url?: string; display?: string; type?: string }) {
  if (!url) {
    if (type) {
      return (
        <p className="mt-1 text-[10px] text-gray-400 italic">
          Source non affichée (lien filtré ou absent)
        </p>
      );
    }
    return null;
  }

  const label = display && display !== url ? display : undefined;

  return (
    <div className="mt-1.5 rounded border border-gray-100 bg-gray-50/80 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <SourceTypeBadge type={type} />
        {label && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-blue-700 hover:underline"
          >
            {label}
          </a>
        )}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-0.5 block text-[10px] leading-snug text-blue-600 break-all hover:underline"
        title={url}
      >
        {url}
      </a>
    </div>
  );
}

function InvalidPoint({ p }: { p: Point }) {
  return (
    <li className="rounded-md border border-red-200 bg-red-50/90 px-2.5 py-2 text-red-900">
      <p className="font-semibold text-[11px] uppercase tracking-wide text-red-700 mb-1">
        Non validé
      </p>
      <p className="leading-snug">{p.point}</p>
      {p.correction && (
        <p className="mt-1.5 rounded bg-white/70 px-2 py-1 text-red-800 border border-red-100">
          <span className="font-medium text-red-700">Correction : </span>
          <em>{p.correction}</em>
        </p>
      )}
      <SourceLink url={p.source_url} display={p.source_display} type={p.source_type} />
    </li>
  );
}

function ValidatedPoint({ p }: { p: Point }) {
  return (
    <li className="leading-snug text-emerald-800">
      <span className="font-bold text-emerald-600">✓ </span>
      {p.point}
      <SourceLink url={p.source_url} display={p.source_display} type={p.source_type} />
    </li>
  );
}

function getPanelKind(v?: FactVerificationResult): 'invalid' | 'uncertain' | 'valid' | 'unknown' {
  if (!v) return 'unknown';
  const hasInv = (v.invalid_points?.length ?? 0) > 0;
  if (hasInv || v.status === 'invalid') return 'invalid';
  if (v.status === 'uncertain') return 'uncertain';
  return 'valid';
}

const PANEL_HEADER: Record<
  ReturnType<typeof getPanelKind>,
  { label: string; bar: string; badge: string }
> = {
  invalid: {
    label: 'Non validé',
    bar: 'bg-red-500',
    badge: 'bg-red-100 text-red-800 border-red-200',
  },
  uncertain: {
    label: 'Incertain',
    bar: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  valid: {
    label: 'Validé',
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  unknown: {
    label: 'Non vérifié',
    bar: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export { highlightClass, highlightClassDual } from '@/lib/fact-check-verification-utils';

export function FactHoverCard({ verification: v }: { verification?: FactVerificationResult }) {
  const kind = getPanelKind(v);
  const header = PANEL_HEADER[kind];
  const fieldTitle =
    v?.label && v?.value ? `${v.label} : ${v.value}` : v?.label || v?.value;
  const invalidList = v?.invalid_points ?? [];
  const validatedList = v?.validated_points ?? [];
  const hasInvalid = invalidList.length > 0;
  const hasValidated = validatedList.length > 0;

  return (
    <div className="min-w-[18rem] max-w-full break-words text-xs">
      <div className={`flex gap-2 rounded-t-lg border px-2.5 py-2 ${header.badge}`}>
        <span className={`mt-1 h-8 w-1 shrink-0 rounded-full ${header.bar}`} aria-hidden />
        <div>
          <p className="text-sm font-bold leading-tight">{header.label}</p>
          {fieldTitle && (
            <p className="mt-1 text-[11px] text-gray-600 leading-snug line-clamp-3">{fieldTitle}</p>
          )}
          {v?.comment && kind !== 'invalid' && (
            <p className="mt-1 leading-snug text-gray-600">{v.comment}</p>
          )}
        </div>
      </div>

      <div className="rounded-b-lg border border-t-0 border-gray-200 bg-white p-2.5 space-y-2">
        {hasInvalid && (
          <ul className="space-y-2" aria-label="Points non validés">
            {invalidList.map((p, i) => (
              <InvalidPoint key={i} p={p} />
            ))}
          </ul>
        )}

        {kind === 'uncertain' && !hasInvalid && v?.comment && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900 leading-snug">
            {v.comment}
          </p>
        )}

        {hasValidated && (
          <details
            className={hasInvalid ? 'pt-1 border-t border-gray-100' : undefined}
            open={!hasInvalid}
          >
            <summary
              className={`cursor-pointer select-none font-medium ${
                hasInvalid ? 'text-gray-500 hover:text-gray-700' : 'text-emerald-700'
              }`}
            >
              {hasInvalid
                ? `Voir ce qui est confirmé (${validatedList.length})`
                : `Confirmé (${validatedList.length})`}
            </summary>
            <ul className="mt-2 space-y-2 pl-0.5">
              {validatedList.map((p, i) => (
                <ValidatedPoint key={i} p={p} />
              ))}
            </ul>
          </details>
        )}

        {!hasInvalid && !hasValidated && v?.comment && kind !== 'uncertain' && (
          <p className="text-gray-600 leading-snug">{v.comment}</p>
        )}
      </div>
    </div>
  );
}
