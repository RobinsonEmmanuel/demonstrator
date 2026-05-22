'use client';

export function FactCheckLevelLegend({ hasDatabaseCheck }: { hasDatabaseCheck: boolean }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {hasDatabaseCheck && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-900">
          <span className="h-2 w-2 rounded-full bg-violet-500" aria-hidden />
          <span>
            <strong>Niveau 1</strong> — Base de données (JSON)
          </span>
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-900">
        <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />
        <span>
          <strong>Niveau {hasDatabaseCheck ? '2' : '1'}</strong> — Sources web (Perplexity)
        </span>
      </span>
    </div>
  );
}
