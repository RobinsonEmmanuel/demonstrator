'use client';

import { useEffect, useState } from 'react';
import type { AnalyzedImageResult } from '@/types/image-classify';
import { CompliancePanel } from '@/components/image-classify/CompliancePanel';
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

const AESTHETIC_LABELS: Record<string, string> = {
  composition: 'Composition',
  lighting: 'Lumière',
  editorialImpact: 'Impact éditorial',
  subjectRelevance: 'Pertinence',
};

const REGION_LABELS: Record<string, string> = {
  'avant-plan': 'Avant-plan',
  centre: 'Centre',
  'arrière-plan': 'Arrière-plan',
};

/** Titres de section */
const sectionTitle = 'text-xs font-semibold uppercase tracking-wide text-slate-600';

function IndexSubBlock({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-800">{title}</p>
      {hint ? <p className="mb-1.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
      {children}
    </div>
  );
}

function SectionCard({
  title,
  children,
  className = '',
  fill = false,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  fill?: boolean;
}) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-3 ${
        fill ? 'h-full min-h-0' : ''
      } ${className}`}
    >
      <p className={`mb-2 shrink-0 ${sectionTitle}`}>{title}</p>
      <div className={fill ? 'min-h-0 flex-1 overflow-y-auto' : ''}>{children}</div>
    </section>
  );
}

type TextKey = 'alt' | 'caption' | 'description';

const TEXT_TABS: Array<{ key: TextKey; label: string; usage: string }> = [
  {
    key: 'description',
    label: 'Description',
    usage: 'Ce que l\'IA voit, en détail — pour classer et retrouver la photo.',
  },
  {
    key: 'alt',
    label: 'Texte alternatif',
    usage: 'Lu à voix haute aux personnes malvoyantes, utile aussi pour le référencement.',
  },
  { key: 'caption', label: 'Légende', usage: 'Affichée sous la photo, pour le lecteur.' },
];

function GeneratedTexts({
  alt,
  caption,
  description,
  issues,
}: {
  alt: string;
  caption?: string;
  description: string;
  issues: string[];
}) {
  const [tab, setTab] = useState<TextKey>('description');

  const tabs = TEXT_TABS.filter((t) => t.key !== 'caption' || caption);
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  const text =
    current.key === 'alt' ? alt : current.key === 'caption' ? (caption ?? '') : description;

  return (
    <div className="shrink-0 rounded-lg border border-orange-200/70 bg-orange-50/90 p-2.5">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-800">
        Textes rédigés par l&apos;IA
      </p>
      <div className="mb-2 flex gap-1 rounded-lg bg-orange-100/70 p-0.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${
              current.key === t.key
                ? 'bg-white text-orange-700 shadow-sm'
                : 'text-orange-900/70 hover:text-orange-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-snug text-slate-500">{current.usage}</p>
      <p className="mt-1.5 max-h-24 overflow-y-auto text-sm leading-snug text-slate-800">{text}</p>
      {current.key === 'description' && issues.length > 0 && (
        <p className="mt-1.5 text-xs leading-snug text-amber-800">
          Technique : {issues.join(' · ')}
        </p>
      )}
      {current.key === 'alt' && (
        <p className="mt-2 text-[11px] text-orange-800/80">{text.length}/125 caractères</p>
      )}
    </div>
  );
}

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
  const altText = a.altText || a.shortDescription || image.name;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        aria-label="Fermer"
        onClick={onClose}
      />

      <div
        className="relative flex aspect-video w-[min(100%,72rem,calc(90vh*16/9))] max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-700">
              Analyse image
            </p>
            <h2
              id="image-detail-title"
              className="truncate text-base font-semibold text-slate-900"
            >
              {image.name}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {image.isRecommendedInGroup && image.duplicateGroupId && (
              <span className="rounded-full bg-orange-600 px-2.5 py-0.5 text-xs font-bold uppercase text-white">
                Recommandée
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {SCENE_LABELS[a.sceneType] ?? a.sceneType}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 hover:bg-slate-50"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[34%_minmax(0,1fr)]">
          {/* Colonne gauche : image prioritaire, légende compacte en bas */}
          <div className="grid min-h-0 grid-rows-[1fr_auto] gap-3 border-b border-slate-200 bg-slate-50 p-3 sm:border-b-0 sm:border-r sm:p-4">
            <div className="flex min-h-0 items-center justify-center">
              <div className="w-full max-w-[280px]">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md ring-1 ring-orange-100/80">
                  <img
                    src={previewUrl}
                    alt={altText}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>

            <GeneratedTexts
              alt={altText}
              caption={a.suggestedCaption}
              description={a.fullDescription}
              issues={a.technical.issues}
            />
          </div>

          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2.5 bg-slate-50/50 p-3">
            {/* Score */}
            <div className="flex shrink-0 items-center gap-4 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
              <div className="shrink-0 text-center">
                <p className={sectionTitle}>Score global</p>
                <p className="text-4xl font-bold leading-none tabular-nums text-slate-900">
                  {a.aesthetic.overall}
                  <span className="text-lg font-medium text-slate-400">/10</span>
                </p>
              </div>
              <div className="hidden h-10 w-px shrink-0 bg-slate-200 sm:block" />
              <div className="min-w-0 flex-1 space-y-1.5">
                {(
                  ['composition', 'lighting', 'editorialImpact', 'subjectRelevance'] as const
                ).map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-[5.5rem] shrink-0 truncate text-xs text-slate-700 sm:w-[6.5rem]">
                      {AESTHETIC_LABELS[key]}
                    </span>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-orange-600"
                        style={{ width: `${a.aesthetic[key] * 10}%` }}
                      />
                    </div>
                    <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-800">
                      {a.aesthetic[key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid min-h-0 grid-cols-2 gap-2.5">
              <SectionCard title="Conformité" fill>
                <ComplianceBadge status={a.compliance.status} />
                <div className="mt-2">
                  <CompliancePanel compliance={a.compliance} hideHeader compact />
                </div>
              </SectionCard>

              <SectionCard title="Indexation" fill>
                <div className="space-y-3">
                  <IndexSubBlock title="Mots-clés" hint="Recherche et classement">
                    {a.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {a.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-slate-800 ring-1 ring-orange-200/80"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Aucun mot-clé</p>
                    )}
                  </IndexSubBlock>

                  {a.notablePoints.length > 0 && (
                    <IndexSubBlock title="Éléments visibles" hint="Repérés dans la photo">
                      <ul className="space-y-1.5 border-t border-slate-100 pt-2.5 text-xs leading-snug text-slate-800">
                        {a.notablePoints.map((p, i) => (
                          <li key={i} className="flex items-start justify-between gap-2">
                            <span className="min-w-0">{p.label}</span>
                            {p.region ? (
                              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                {REGION_LABELS[p.region] ?? p.region}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </IndexSubBlock>
                  )}
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
