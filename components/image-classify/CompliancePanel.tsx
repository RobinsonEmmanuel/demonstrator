'use client';

import type { ComplianceCheck, ComplianceStatus, ImageCompliance } from '@/types/image-classify';

const STATUS_STYLE: Record<ComplianceStatus, string> = {
  pass: 'text-emerald-700',
  warning: 'text-amber-700',
  fail: 'text-red-700',
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
    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

export function CompliancePanel({ compliance }: { compliance: ImageCompliance }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-800">Conformité</span>
        <ComplianceBadge status={compliance.status} />
      </div>
      <ul className="space-y-1.5 text-xs">
        {compliance.checks.map((c) => (
          <ComplianceCheckRow key={c.id} check={c} />
        ))}
      </ul>
    </div>
  );
}

function ComplianceCheckRow({ check }: { check: ComplianceCheck }) {
  return (
    <li className={`flex gap-1.5 leading-snug ${STATUS_STYLE[check.status]}`}>
      <span className="font-bold shrink-0">{STATUS_ICON[check.status]}</span>
      <span>
        <span className="font-medium">{check.label}</span>
        {check.detail && <span className="text-gray-500"> — {check.detail}</span>}
      </span>
    </li>
  );
}
