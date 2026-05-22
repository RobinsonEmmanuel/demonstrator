'use client';

import { useMemo } from 'react';
import {
  parseSitDraftForDisplay,
  pickSitDraftSummary,
  type SitDisplayBlock,
  type SitDisplayField,
  type SitDisplaySection,
} from '@/lib/sit-draft-display';

function FieldRow({ field }: { field: SitDisplayField }) {
  return (
    <div className="grid gap-1 border-b border-gray-100 py-2 last:border-0 sm:grid-cols-[minmax(7rem,28%)_1fr] sm:gap-3">
      <dt className="font-mono text-xs text-gray-600 break-all">{field.id}</dt>
      <dd className="text-sm leading-relaxed text-gray-900 whitespace-pre-wrap break-words">
        {field.value}
      </dd>
    </div>
  );
}

function SectionAccordion({
  section,
  defaultOpen,
}: {
  section: SitDisplaySection;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="rounded-md border border-gray-200 bg-gray-50/80 group"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-3 py-2 font-mono text-xs font-medium text-gray-800 hover:bg-gray-100/80 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span
            className="text-[10px] text-gray-400 transition-transform group-open:rotate-90"
            aria-hidden
          >
            ▶
          </span>
          {section.id}
        </span>
      </summary>
      <dl className="border-t border-gray-200 bg-white px-3">
        {section.fields.map((field) => (
          <FieldRow key={field.id} field={field} />
        ))}
      </dl>
    </details>
  );
}

function BlockAccordion({
  block,
  defaultOpen,
}: {
  block: SitDisplayBlock;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="rounded-lg border border-gray-200 bg-white group"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none border-b border-transparent px-3 py-2.5 font-mono text-sm font-semibold text-orange-900 hover:bg-orange-50/50 group-open:border-gray-100 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span
            className="text-[10px] text-orange-600/70 transition-transform group-open:rotate-90"
            aria-hidden
          >
            ▶
          </span>
          {block.id}
        </span>
      </summary>
      <div className="space-y-2 p-2">
        {block.sections.map((section, i) => (
          <SectionAccordion
            key={section.id}
            section={section}
            defaultOpen={defaultOpen && i === 0}
          />
        ))}
      </div>
    </details>
  );
}

export function SitDraftHumanView({ data }: { data: unknown }) {
  const blocks = useMemo(() => parseSitDraftForDisplay(data), [data]);
  const summary = useMemo(() => pickSitDraftSummary(data), [data]);

  if (!blocks || blocks.length === 0) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Aucun bloc <span className="font-mono">blocks[]</span> avec champs{' '}
        <span className="font-mono">field_id</span> / <span className="font-mono">value</span>{' '}
        détecté.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50">
      {(summary.title || summary.subtitle) && (
        <div className="border-b border-gray-200 bg-orange-50/60 px-4 py-3">
          {summary.title && (
            <p className="text-base font-semibold text-gray-900">{summary.title}</p>
          )}
          {summary.subtitle && (
            <p className="mt-0.5 text-sm text-gray-600">{summary.subtitle}</p>
          )}
        </div>
      )}
      <div className="max-h-[min(52vh,420px)] overflow-y-auto p-3 space-y-2">
        {blocks.map((block, i) => (
          <BlockAccordion key={block.id} block={block} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}
