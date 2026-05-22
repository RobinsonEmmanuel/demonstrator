'use client';

import type {
  AnalyzedImageResult,
  DuplicateGroup,
  DuplicateGroupComparison,
} from '@/types/image-classify';

function photoLabel(index: number, name: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  const short = base.length > 24 ? `${base.slice(0, 24)}…` : base;
  return `Photo ${index + 1} — ${short}`;
}

export function DuplicateGroupComparisonPanel({
  group,
  comparison,
  imagesById,
  previewById,
}: {
  group: DuplicateGroup;
  comparison: DuplicateGroupComparison;
  imagesById: Map<string, AnalyzedImageResult>;
  previewById: Map<string, string>;
}) {
  const imageIds = group.imageIds;
  const maxTotal = comparison.criteria.length * 10;
  const gridCols = `minmax(7rem, 9rem) repeat(${imageIds.length}, minmax(0, 1fr))`;

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">Comparaison détaillée</h4>
        <p className="text-xs text-slate-600 mt-0.5">{comparison.headline}</p>
      </div>

      <div
        className="hidden lg:grid gap-2 mb-2"
        style={{ gridTemplateColumns: `8rem repeat(${imageIds.length}, minmax(0, 1fr))` }}
      >
        <div />
        {imageIds.map((id, idx) => {
          const img = imagesById.get(id);
          const url = previewById.get(id);
          const isRec = id === comparison.recommendedImageId;
          return (
            <div key={id} className="text-center">
              {url && (
                <img
                  src={url}
                  alt={img?.name ?? id}
                  className={`mx-auto h-14 w-full max-w-[88px] rounded object-cover border ${
                    isRec ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-200'
                  }`}
                />
              )}
              <p className="mt-1 text-[10px] font-medium text-slate-700 leading-tight line-clamp-2">
                {img ? photoLabel(idx, img.name) : `Photo ${idx + 1}`}
              </p>
              {isRec && (
                <span className="inline-block mt-0.5 text-[9px] font-bold uppercase text-orange-700">
                  Retenue
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div
          className="hidden sm:grid gap-px bg-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div className="bg-slate-50 px-3 py-2">Critères</div>
          {imageIds.map((id, idx) => {
            const img = imagesById.get(id);
            const isRec = id === comparison.recommendedImageId;
            return (
              <div
                key={id}
                className={`bg-slate-50 px-2 py-2 text-center truncate ${isRec ? 'text-orange-800' : ''}`}
                title={img?.name}
              >
                P{idx + 1}
              </div>
            );
          })}
        </div>

        {comparison.criteria.map((row) => (
          <details key={row.id} className="group border-t border-slate-100 first:border-t-0">
            <summary className="cursor-pointer list-none hover:bg-slate-50/80 [&::-webkit-details-marker]:hidden">
              <div className="grid gap-px bg-slate-100 items-stretch" style={{ gridTemplateColumns: gridCols }}>
                <div className="bg-white px-3 py-2.5 flex items-center gap-2">
                  <span className="text-slate-400 text-xs group-open:rotate-90 transition-transform">
                    ▸
                  </span>
                  <span className="text-xs font-medium text-slate-800">{row.label}</span>
                </div>
                {imageIds.map((id) => {
                  const score = row.scoresByImageId[id] ?? 0;
                  const isRec = id === comparison.recommendedImageId;
                  const best = Math.max(...imageIds.map((i) => row.scoresByImageId[i] ?? 0));
                  const isBest = score === best;
                  return (
                    <div
                      key={id}
                      className={`bg-white px-2 py-2.5 text-center text-sm font-semibold ${
                        isRec && isBest
                          ? 'text-orange-700 bg-orange-50/50'
                          : isBest
                            ? 'text-emerald-700'
                            : 'text-slate-800'
                      }`}
                    >
                      {score}/{row.maxScore}
                    </div>
                  );
                })}
              </div>
            </summary>
            <div className="border-t border-slate-100 bg-slate-50/40 px-3 py-2 space-y-2">
              {imageIds.map((id, idx) => {
                const img = imagesById.get(id);
                const justification = row.justificationsByImageId[id] ?? '—';
                const isRec = id === comparison.recommendedImageId;
                return (
                  <div key={id} className="text-xs leading-relaxed">
                    <span className={`font-semibold ${isRec ? 'text-orange-800' : 'text-slate-700'}`}>
                      {img ? photoLabel(idx, img.name) : `Photo ${idx + 1}`} :
                    </span>{' '}
                    <span className="text-slate-600">{justification}</span>
                  </div>
                );
              })}
            </div>
          </details>
        ))}

        <div className="grid gap-px bg-slate-200 border-t border-slate-200 font-semibold" style={{ gridTemplateColumns: gridCols }}>
          <div className="bg-slate-100 px-3 py-2.5 text-xs text-slate-800">TOTAL</div>
          {imageIds.map((id) => {
            const total = comparison.totalByImageId[id] ?? 0;
            const isRec = id === comparison.recommendedImageId;
            return (
              <div
                key={id}
                className={`bg-slate-100 px-2 py-2.5 text-center text-sm ${
                  isRec ? 'text-orange-800' : 'text-slate-900'
                }`}
              >
                {total}/{maxTotal}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
