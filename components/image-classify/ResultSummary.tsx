'use client';

import type { ImageClassifyResponse } from '@/types/image-classify';

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const color = {
    neutral: 'text-gray-900',
    good: 'text-emerald-700',
    warn: 'text-amber-700',
    bad: 'text-red-700',
  }[tone];
  return (
    <div className="min-w-[7rem] flex-1">
      <p className={`text-3xl font-bold tabular-nums leading-none ${color}`}>{value}</p>
      <p className="mt-1 text-xs leading-snug text-gray-600">{label}</p>
    </div>
  );
}

export function ResultSummary({ result }: { result: ImageClassifyResponse }) {
  const total = result.images.length;
  const count = (s: 'pass' | 'warning' | 'fail') =>
    result.images.filter((i) => i.analysis.compliance.status === s).length;
  const toRemove = result.duplicateGroups.reduce((n, g) => n + g.imageIds.length - 1, 0);

  return (
    <section
      aria-label="Synthèse de l’analyse"
      className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
    >
      <p className="mb-3 text-sm font-semibold text-emerald-900">
        {total} photo{total > 1 ? 's' : ''} analysée{total > 1 ? 's' : ''}
        {' · '}
        {total} fiche{total > 1 ? 's' : ''} générée{total > 1 ? 's' : ''} et enregistrée
        {total > 1 ? 's' : ''}
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <Stat value={count('pass')} label="prêtes à publier" tone="good" />
        <Stat value={count('warning')} label="à vérifier" tone="warn" />
        <Stat value={count('fail')} label="à écarter" tone="bad" />
        <Stat
          value={result.duplicateGroups.length}
          label={`groupe${result.duplicateGroups.length > 1 ? 's' : ''} de doublons repéré${result.duplicateGroups.length > 1 ? 's' : ''}`}
          tone="neutral"
        />
        <Stat
          value={toRemove}
          label={`photo${toRemove > 1 ? 's' : ''} en double à retirer`}
          tone="neutral"
        />
      </div>
    </section>
  );
}
