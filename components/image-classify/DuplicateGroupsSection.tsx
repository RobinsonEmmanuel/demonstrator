'use client';

import type { AnalyzedImageResult, DuplicateGroup } from '@/types/image-classify';
import { ImageCard } from '@/components/image-classify/ImageCard';

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
  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">Aucun doublon détecté dans ce lot.</p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
          <p className="text-sm font-medium text-amber-900 mb-1">{g.similarityNote}</p>
          <p className="text-xs text-amber-700 mb-2">
            Image recommandée dans le groupe :{' '}
            <strong>{imagesById.get(g.recommendedImageId)?.name ?? g.recommendedImageId}</strong>
          </p>
          {g.recommendationReason && (
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
        </div>
      ))}
    </div>
  );
}
