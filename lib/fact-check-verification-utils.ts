import type { FactStatus, FactVerificationResult } from '@/types/fact-check';

export type VerificationPanelKind = 'invalid' | 'uncertain' | 'valid' | 'unknown';

export function getVerificationPanelKind(v?: FactVerificationResult): VerificationPanelKind {
  if (!v) return 'unknown';
  const hasInv = (v.invalid_points?.length ?? 0) > 0;
  if (hasInv || v.status === 'invalid') return 'invalid';
  if (v.status === 'uncertain') return 'uncertain';
  return 'valid';
}

const KIND_RANK: Record<VerificationPanelKind, number> = {
  unknown: 0,
  valid: 1,
  uncertain: 2,
  invalid: 3,
};

/** Retient le statut le plus sévère (pour surlignage combiné). */
export function mergeVerificationKinds(
  ...kinds: VerificationPanelKind[]
): VerificationPanelKind {
  return kinds.reduce<VerificationPanelKind>(
    (worst, k) => (KIND_RANK[k] > KIND_RANK[worst] ? k : worst),
    'unknown'
  );
}

export function combineVerificationKinds(
  database?: FactVerificationResult,
  web?: FactVerificationResult
): VerificationPanelKind {
  return mergeVerificationKinds(
    getVerificationPanelKind(database),
    getVerificationPanelKind(web)
  );
}

export function statusBadgeFromKind(kind: VerificationPanelKind): {
  text: string;
  className: string;
} {
  switch (kind) {
    case 'invalid':
      return { text: 'Non validé', className: 'bg-red-100 text-red-800' };
    case 'uncertain':
      return { text: 'Incertain', className: 'bg-amber-100 text-amber-800' };
    case 'valid':
      return { text: 'Validé', className: 'bg-emerald-100 text-emerald-800' };
    default:
      return { text: '—', className: 'bg-slate-100 text-slate-600' };
  }
}

export function statusBadge(v?: FactVerificationResult): { text: string; className: string } {
  return statusBadgeFromKind(getVerificationPanelKind(v));
}

export function highlightClassFromKind(kind: VerificationPanelKind): string {
  if (kind === 'invalid') return 'border-b-2 border-red-500 bg-red-50/95';
  if (kind === 'uncertain') return 'border-b-2 border-amber-500 bg-amber-50/95';
  if (kind === 'valid') return 'border-b-2 border-emerald-500 bg-emerald-50/95';
  return 'border-b-2 border-dashed border-slate-400 bg-slate-50/90';
}

export function highlightClass(v?: FactVerificationResult): string {
  return highlightClassFromKind(getVerificationPanelKind(v));
}

export function highlightClassDual(
  database?: FactVerificationResult,
  web?: FactVerificationResult
): string {
  return highlightClassFromKind(combineVerificationKinds(database, web));
}
