'use client';

export type WorkflowPhase = 'idle' | 'running' | 'done';

const STEPS = [
  {
    title: 'Empreinte visuelle',
    text: 'Chaque photo reçoit une signature enregistrée en base : les doublons sont retrouvés même recadrés ou retouchés.',
  },
  {
    title: 'Lecture par l’IA',
    text: 'Lieu, type de plan, éléments visibles : ce que la photo montre vraiment.',
  },
  {
    title: 'Contrôle de conformité',
    text: '7 vérifications : visages (RGPD), mineurs, logos, filigranes, texte incrusté, contenu inapproprié, cohérence avec le lieu.',
  },
  {
    title: 'Notation éditoriale',
    text: 'Composition, lumière, impact, pertinence, et choix argumenté de la meilleure photo parmi les doublons.',
  },
  {
    title: 'Fiche prête à l’emploi',
    text: 'Description, texte alternatif accessible, légende et mots-clés, enregistrés en base.',
  },
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
