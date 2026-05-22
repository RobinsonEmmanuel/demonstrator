'use client';

import type { ExtractedField, FactVerificationResult } from '@/types/fact-check';
import { DualLevelFieldValidation } from '@/components/fact-check/VerificationLevelSection';
import {
  combineVerificationKinds,
  getVerificationPanelKind,
  statusBadgeFromKind,
} from '@/lib/fact-check-verification-utils';

function LevelPills({
  databaseVerification,
  webVerification,
  showDatabase,
}: {
  databaseVerification?: FactVerificationResult;
  webVerification?: FactVerificationResult;
  showDatabase: boolean;
}) {
  const dbBadge = statusBadgeFromKind(
    showDatabase ? getVerificationPanelKind(databaseVerification) : 'unknown'
  );
  const webBadge = statusBadgeFromKind(getVerificationPanelKind(webVerification));

  return (
    <span className="flex flex-wrap items-center gap-1">
      {showDatabase && (
        <span
          className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-px rounded ${dbBadge.className}`}
          title="Niveau 1 — base de données"
        >
          BDD
        </span>
      )}
      <span
        className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-px rounded ${webBadge.className}`}
        title="Niveau 2 — web"
      >
        Web
      </span>
    </span>
  );
}

export function FieldValidationList({
  fields,
  verificationById,
  databaseVerificationById,
  hasDatabaseCheck = false,
  fieldNumberById,
}: {
  fields: ExtractedField[];
  verificationById: Record<string, FactVerificationResult>;
  databaseVerificationById?: Record<string, FactVerificationResult>;
  hasDatabaseCheck?: boolean;
  fieldNumberById?: Record<string, number>;
}) {
  return (
    <ul className="space-y-3" aria-label="Validation par champ">
      {fields.map((f) => {
        const web = verificationById[f.id];
        const db = databaseVerificationById?.[f.id];
        const fieldNumber = fieldNumberById?.[f.id];
        const combinedKind = combineVerificationKinds(
          hasDatabaseCheck ? db : undefined,
          web
        );
        const combinedBadge = statusBadgeFromKind(combinedKind);

        return (
          <li
            key={f.id}
            className="rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-2.5">
                {fieldNumber && (
                  <span className="mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 px-1.5 text-xs font-semibold text-white">
                    {fieldNumber}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${combinedBadge.className}`}
                    >
                      {combinedBadge.text}
                    </span>
                    <LevelPills
                      databaseVerification={db}
                      webVerification={web}
                      showDatabase={hasDatabaseCheck}
                    />
                    <span className="text-sm font-medium text-gray-900">{f.label}</span>
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-gray-700">
                    {f.value}
                  </span>
                </span>
                <span className="mt-1 text-xs font-medium text-slate-500 group-open:hidden">
                  Détail
                </span>
                <span className="mt-1 hidden text-xs font-medium text-slate-500 group-open:inline">
                  Masquer
                </span>
              </summary>
              <div className="border-t border-gray-100 px-3 pb-3 pt-2">
                <DualLevelFieldValidation
                  showDatabase={hasDatabaseCheck}
                  databaseVerification={db}
                  webVerification={web}
                />
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
