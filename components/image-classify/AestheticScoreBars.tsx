'use client';

import type { AestheticScores } from '@/types/image-classify';

const DIMS: Array<{ key: keyof Omit<AestheticScores, 'overall'>; label: string }> = [
  { key: 'composition', label: 'Composition' },
  { key: 'lighting', label: 'Lumière' },
  { key: 'editorialImpact', label: 'Impact éditorial' },
  { key: 'subjectRelevance', label: 'Pertinence sujet' },
];

export function AestheticScoreBars({ scores }: { scores: AestheticScores }) {
  return (
    <ul className="space-y-2 list-none m-0 p-0">
      {DIMS.map(({ key, label }) => (
        <li key={key}>
          <div className="flex justify-between text-[11px] text-gray-600 mb-0.5">
            <span>{label}</span>
            <span className="font-medium text-gray-800">{scores[key]}/10</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden" role="presentation">
            <div
              className="h-full bg-orange-500 rounded-full"
              style={{ width: `${scores[key] * 10}%` }}
            />
          </div>
        </li>
      ))}
      <li className="text-xs font-semibold text-gray-800 pt-1 border-t border-gray-100">
        Score global : {scores.overall}/10
      </li>
    </ul>
  );
}
