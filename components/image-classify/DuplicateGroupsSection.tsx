'use client';

import { useState } from 'react';
import type { AnalyzedImageResult, DuplicateGroup } from '@/types/image-classify';
import { buildDuplicateGroupComparison } from '@/lib/image-group-comparison';
import { ImageCard } from '@/components/image-classify/ImageCard';
import { DuplicateGroupComparisonPanel } from '@/components/image-classify/DuplicateGroupComparisonPanel';

function getComparison(
  group: DuplicateGroup,
  imagesById: Map<string, AnalyzedImageResult>
) {
  if (group.comparison) return group.comparison;
  const byId = new Map(
    group.imageIds
      .map((id) => {
        const img = imagesById.get(id);
        return img ? ([id, { id: img.id, name: img.name, analysis: img.analysis }] as const) : null;
      })
      .filter(Boolean) as [string, { id: string; name: string; analysis: AnalyzedImageResult['analysis'] }][]
  );
  return buildDuplicateGroupComparison(group.imageIds, group.recommendedImageId, byId);
}

export function DuplicateGroupsSection({
  groups,
  imagesById,
  previewById,
  selectedId,
  onSelect,
}: {
  groups: DuplicateGroup[];
  imagesById: Map<string, AnalyzedImageResult>;
  previewById: Map<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [comparisonGroupId, setComparisonGroupId] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">Aucun doublon détecté dans ce lot.</p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const comparisonOpen = comparisonGroupId === g.id;
        const comparison = getComparison(g, imagesById);

        return (
          <div key={g.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-amber-900">{g.similarityNote}</p>
                <p className="text-xs text-amber-700 mt-1">
                  Image recommandée :{' '}
                  <strong>{imagesById.get(g.recommendedImageId)?.name ?? g.recommendedImageId}</strong>
                </p>
              </div>
              {comparison && (
                <button
                  type="button"
                  onClick={() => setComparisonGroupId(comparisonOpen ? null : g.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    comparisonOpen
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {comparisonOpen ? 'Masquer la comparaison' : 'Voir la comparaison détaillée'}
                </button>
              )}
            </div>

            {g.recommendationReason && !comparisonOpen && (
              <p className="text-xs text-slate-700 leading-relaxed mb-3 border-l-2 border-amber-400 pl-2.5">
                {g.recommendationReason.split(/\*\*(.+?)\*\*/g).map((part, i) =>
                  i % 2 === 1 ? (
                    <strong key={i} className="font-semibold text-slate-900">
                      {part}
                    </strong>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </p>
            )}

            {comparisonOpen && comparison ? (
              <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                <section className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Photos du groupe
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {g.imageIds.map((id) => {
                      const img = imagesById.get(id);
                      const url = previewById.get(id);
                      if (!img || !url) return null;
                      return (
                        <ImageCard
                          key={id}
                          image={img}
                          previewUrl={url}
                          selected={selectedId === id}
                          onSelect={() => onSelect(id)}
                        />
                      );
                    })}
                  </div>
                  {g.recommendationReason && (
                    <p className="text-xs text-slate-600 leading-relaxed border-l-2 border-amber-300 pl-2">
                      {g.recommendationReason.split(/\*\*(.+?)\*\*/g).map((part, i) =>
                        i % 2 === 1 ? (
                          <strong key={i} className="font-semibold text-slate-800">
                            {part}
                          </strong>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                    </p>
                  )}
                </section>

                <section className="min-w-0">
                  <DuplicateGroupComparisonPanel
                    group={g}
                    comparison={comparison}
                    imagesById={imagesById}
                    previewById={previewById}
                  />
                </section>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {g.imageIds.map((id) => {
                  const img = imagesById.get(id);
                  const url = previewById.get(id);
                  if (!img || !url) return null;
                  return (
                    <ImageCard
                      key={id}
                      image={img}
                      previewUrl={url}
                      selected={selectedId === id}
                      onSelect={() => onSelect(id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
