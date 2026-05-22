'use client';

import type { AnalyzedImageResult } from '@/types/image-classify';
import { ComplianceBadge } from '@/components/image-classify/CompliancePanel';

const SCENE_LABELS: Record<string, string> = {
  exterior: 'Extérieur',
  interior: 'Intérieur',
  detail: 'Détail',
  food: 'Gastronomie',
  panorama: 'Panorama',
  night: 'Nuit',
  people: 'Personnes',
  other: 'Autre',
};

export function ImageCard({
  image,
  previewUrl,
  selected,
  onSelect,
  badges,
}: {
  image: AnalyzedImageResult;
  previewUrl: string;
  selected?: boolean;
  onSelect: () => void;
  badges?: React.ReactNode;
}) {
  const a = image.analysis;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-lg border overflow-hidden bg-white transition-shadow hover:shadow-md ${
        selected ? 'ring-2 ring-orange-500 border-orange-300' : 'border-gray-200'
      }`}
    >
      <div className="relative aspect-[4/3] bg-gray-100">
        <img src={previewUrl} alt={image.name} className="w-full h-full object-cover" />
        {image.isRecommendedInGroup && image.duplicateGroupId && (
          <span className="absolute top-2 left-2 text-[10px] font-bold uppercase bg-orange-500 text-white px-1.5 py-0.5 rounded">
            Recommandée
          </span>
        )}
        <span className="absolute bottom-2 right-2 text-xs font-bold bg-white/90 text-gray-900 px-1.5 py-0.5 rounded">
          {a.aesthetic.overall}/10
        </span>
      </div>
      <div className="p-2 space-y-1">
        <p className="text-xs font-medium text-gray-900 truncate">{image.name}</p>
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] px-1.5 py-px rounded bg-slate-100 text-slate-600">
            {SCENE_LABELS[a.sceneType] ?? a.sceneType}
          </span>
          <ComplianceBadge status={a.compliance.status} />
        </div>
        <p className="text-[11px] text-gray-500 line-clamp-2">{a.shortDescription}</p>
        {badges}
      </div>
    </button>
  );
}
