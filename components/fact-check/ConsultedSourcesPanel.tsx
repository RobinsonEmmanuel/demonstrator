'use client';

import type { ConsultedSource } from '@/types/fact-check';

const BADGE_CLASS: Record<string, string> = {
  official: 'bg-emerald-100 text-emerald-700',
  institutional: 'bg-teal-100 text-teal-700',
  media_high: 'bg-blue-100 text-blue-700',
  media_local: 'bg-sky-100 text-sky-700',
  commercial: 'bg-amber-100 text-amber-700',
  ugc: 'bg-gray-100 text-gray-500',
};

export function ConsultedSourcesPanel({ sources }: { sources: ConsultedSource[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <h3 className="text-sm font-semibold text-slate-800 mb-2">
        Sites de confiance interrogés ({sources.length})
      </h3>
      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
        {sources.map((s) => (
          <li
            key={s.host}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-snug"
          >
            <span
              className={`shrink-0 font-medium px-1.5 py-0.5 rounded ${BADGE_CLASS[s.source_type] ?? BADGE_CLASS.commercial}`}
            >
              {s.source_type_label}
            </span>
            <a
              href={s.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 hover:underline"
              title={s.uri}
            >
              {s.display_name}
            </a>
            {s.citation_count > 1 && (
              <span className="text-slate-400">({s.citation_count} pages)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
