'use client';

import type { AnalyzedImageResult } from '@/types/image-classify';
import { AestheticScoreBars } from '@/components/image-classify/AestheticScoreBars';
import { CompliancePanel } from '@/components/image-classify/CompliancePanel';

export function ImageDetailPanel({
  image,
  previewUrl,
  onClose,
}: {
  image: AnalyzedImageResult;
  previewUrl: string;
  onClose: () => void;
}) {
  const a = image.analysis;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900 truncate pr-2">{image.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-800 text-lg leading-none px-2"
          aria-label="Fermer"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <img
          src={previewUrl}
          alt={image.name}
          className="w-full rounded-lg border border-gray-200 object-contain max-h-56 bg-gray-50"
        />

        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Description</h4>
          <p className="text-sm text-gray-800 leading-relaxed">{a.fullDescription}</p>
          {a.suggestedCaption && (
            <p className="mt-2 text-sm italic text-gray-600 border-l-2 border-orange-300 pl-2">
              Légende suggérée : {a.suggestedCaption}
            </p>
          )}
        </section>

        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tags proposés</h4>
          <div className="flex flex-wrap gap-1.5">
            {a.tags.map((t) => (
              <span
                key={t}
                className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        {a.notablePoints.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Points notables dans la photo
            </h4>
            <ul className="text-sm text-gray-700 space-y-1">
              {a.notablePoints.map((p, i) => (
                <li key={i}>
                  <span className="font-medium">{p.label}</span>
                  {p.region && (
                    <span className="text-gray-400 text-xs ml-1">({p.region})</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Scores esthétiques</h4>
          <AestheticScoreBars scores={a.aesthetic} />
        </section>

        <section className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
          <CompliancePanel compliance={a.compliance} />
        </section>

        {a.technical.issues.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Technique</h4>
            <ul className="text-xs text-amber-800 list-disc pl-4">
              {a.technical.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
