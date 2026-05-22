'use client';

import type { FactVerificationResult } from '@/types/fact-check';
import { FieldValidationBlock } from '@/components/fact-check/FieldValidationBlock';
import { statusBadgeFromKind, getVerificationPanelKind } from '@/lib/fact-check-verification-utils';

const LEVEL_CONFIG = {
  database: {
    title: 'Niveau 1 · Base de données',
    subtitle: 'Référentiel JSON',
    header: 'bg-violet-100 text-violet-900 border-violet-200',
    body: 'border-violet-100 bg-violet-50/30',
    accent: 'border-l-violet-500',
  },
  web: {
    title: 'Niveau 2 · Sources web',
    subtitle: 'Perplexity Sonar',
    header: 'bg-sky-100 text-sky-900 border-sky-200',
    body: 'border-sky-100 bg-sky-50/30',
    accent: 'border-l-sky-600',
  },
} as const;

export function VerificationLevelSection({
  level,
  verification,
  emptyMessage,
}: {
  level: 'database' | 'web';
  verification?: FactVerificationResult;
  emptyMessage?: string;
}) {
  const cfg = LEVEL_CONFIG[level];
  const kind = getVerificationPanelKind(verification);
  const badge = statusBadgeFromKind(kind);

  return (
    <div className={`rounded-lg border overflow-hidden ${cfg.body}`}>
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-2.5 py-1.5 ${cfg.header}`}
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide">{cfg.title}</p>
          <p className="text-[10px] opacity-80">{cfg.subtitle}</p>
        </div>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${badge.className}`}
        >
          {badge.text}
        </span>
      </div>
      <div className={`px-2.5 py-2 border-l-2 ${cfg.accent}`}>
        {verification ? (
          <FieldValidationBlock verification={verification} />
        ) : (
          <p className="text-xs text-slate-500 leading-snug">
            {emptyMessage ?? 'Non vérifié à ce niveau.'}
          </p>
        )}
      </div>
    </div>
  );
}

export function DualLevelFieldValidation({
  databaseVerification,
  webVerification,
  showDatabase,
}: {
  databaseVerification?: FactVerificationResult;
  webVerification?: FactVerificationResult;
  showDatabase: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {showDatabase && (
        <VerificationLevelSection
          level="database"
          verification={databaseVerification}
          emptyMessage="Aucun résultat base de données pour ce champ."
        />
      )}
      <VerificationLevelSection
        level="web"
        verification={webVerification}
        emptyMessage="Aucun résultat web pour ce champ."
      />
    </div>
  );
}
