'use client';

import type { ComplianceCheck, ComplianceStatus, ImageCompliance } from '@/types/image-classify';

const STATUS_STYLE: Record<ComplianceStatus, string> = {
  pass: 'text-emerald-700',
  warning: 'text-amber-700',
  fail: 'text-red-700',
};

const STATUS_STYLE_DARK: Record<ComplianceStatus, string> = {
  pass: 'text-emerald-300',
  warning: 'text-amber-300',
  fail: 'text-red-300',
};

const STATUS_ICON: Record<ComplianceStatus, string> = {
  pass: '✓',
  warning: '!',
  fail: '✗',
};

export function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  const labels = { pass: 'Conforme', warning: 'Attention', fail: 'Non conforme' };
  const colors = {
    pass: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    fail: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

export function CompliancePanel({
  compliance,
  variant = 'light',
  hideHeader = false,
  compact = false,
}: {
  compliance: ImageCompliance;
  variant?: 'light' | 'dark';
  hideHeader?: boolean;
  compact?: boolean;
}) {
  const isDark = variant === 'dark';
  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {!isDark && !hideHeader && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-800">Conformité</span>
          <ComplianceBadge status={compliance.status} />
        </div>
      )}
      <ul className={compact ? 'space-y-1.5 text-xs leading-relaxed' : 'space-y-1.5 text-xs'}>
        {compliance.checks.map((c) => (
          <ComplianceCheckRow key={c.id} check={c} variant={variant} />
        ))}
      </ul>
    </div>
  );
}

function ComplianceCheckRow({
  check,
  variant = 'light',
}: {
  check: ComplianceCheck;
  variant?: 'light' | 'dark';
}) {
  const style = variant === 'dark' ? STATUS_STYLE_DARK[check.status] : STATUS_STYLE[check.status];
  return (
    <li className={`flex gap-1.5 leading-snug ${style}`}>
      <span className="font-bold shrink-0">{STATUS_ICON[check.status]}</span>
      <span>
        <span className="font-medium">{check.label}</span>
        {check.detail && (
          <span className={variant === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
            {' '}
            — {check.detail}
          </span>
        )}
      </span>
    </li>
  );
}
