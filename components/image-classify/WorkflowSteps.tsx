'use client';

export type WorkflowPhase = 'idle' | 'running' | 'done';

const STEPS = [
  { title: 'Empreinte visuelle', text: 'Retrouve les doublons, même retouchés' },
  { title: 'Lecture par l’IA', text: 'Comprend ce que montre la photo' },
  { title: 'Conformité', text: 'RGPD, droits, logos, filigranes' },
  { title: 'Notation éditoriale', text: 'Choisit la meilleure photo' },
  { title: 'Fiche prête à l’emploi', text: 'Textes et mots-clés en base' },
] as const;

export function WorkflowSteps({ phase }: { phase: WorkflowPhase }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Les étapes du traitement">
      {STEPS.map((step, i) => (
        <li
          key={step.title}
          className={`rounded-xl border p-3 transition-colors ${
            phase === 'done'
              ? 'border-emerald-200 bg-emerald-50/60'
              : phase === 'running'
                ? 'border-orange-200 bg-orange-50/70'
                : 'border-gray-200 bg-white'
          }`}
        >
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                phase === 'done'
                  ? 'bg-emerald-600 text-white'
                  : phase === 'running'
                    ? 'animate-pulse bg-orange-500 text-white'
                    : 'bg-gray-200 text-gray-600'
              }`}
            >
              {phase === 'done' ? '✓' : i + 1}
            </span>
            <p className="text-sm font-semibold leading-tight text-gray-900">{step.title}</p>
          </div>
          <p className="text-xs leading-snug text-gray-600">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
