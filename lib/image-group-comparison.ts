import type {
  CriterionComparisonRow,
  DuplicateGroupComparison,
  ImageAnalysis,
} from '@/types/image-classify';

export type { CriterionComparisonRow, DuplicateGroupComparison };

type ImageRow = { id: string; name: string; analysis: ImageAnalysis };

function combinedText(a: ImageAnalysis): string {
  return `${a.shortDescription} ${a.fullDescription} ${a.tags.join(' ')}`.toLowerCase();
}

function groupHasWaterContext(rows: ImageRow[]): boolean {
  return rows.some((r) => /eau|rivière|riviere|reflet|reflets|canal|fleuve|étang|etang/i.test(combinedText(r.analysis)));
}

function hasObstruction(a: ImageAnalysis): boolean {
  return /main|doigt|doigts|bras|téléphone|telephone|personne au premier|objet au premier|livre au premier/i.test(
    combinedText(a)
  );
}

function justifyComposition(row: ImageRow): string {
  const score = row.analysis.aesthetic.composition;
  if (hasObstruction(row.analysis)) {
    return 'Élément parasite au cadre (main, personne ou objet au premier plan).';
  }
  if (score >= 9) return 'Cadrage équilibré, sans élément gênant au premier plan.';
  if (score >= 7) return 'Bon cadrage, léger décalage ou angle légèrement moins favorable.';
  return 'Cadrage perfectible ou composition moins harmonieuse.';
}

function justifyLighting(row: ImageRow): string {
  const score = row.analysis.aesthetic.lighting;
  const issues = row.analysis.technical.issues.join(' ').toLowerCase();
  const text = combinedText(row.analysis);

  if (/surexpos|sous-expos|surexposition/i.test(issues)) {
    return 'Exposition inégale ou surexposition sur certaines zones.';
  }
  if (/nuageux|nuageuse|couvert|gris|brume/i.test(text) && score < 8) {
    return 'Lumière diffuse, ciel couvert, atmosphère moins expressive.';
  }
  if (/clair|ensoleill|lumineux|dégagé|degage/i.test(text) && score >= 8) {
    return 'Lumière douce et équilibrée, ciel expressif.';
  }
  if (score >= 8) return 'Bonne luminosité, contraste maîtrisé.';
  if (score >= 6) return 'Luminosité correcte, contraste un peu marqué.';
  return 'Lumière ou contraste moins favorables pour la publication.';
}

function scoreWaterReflections(row: ImageRow): number {
  const { lighting, composition } = row.analysis.aesthetic;
  let score = Math.round((lighting + composition) / 2);
  const text = combinedText(row.analysis);

  if (/reflet.*net|reflets nets|eau calme|reflet parfait|miroir/i.test(text)) {
    score = Math.min(10, score + 1);
  }
  if (/reflet.*moins|moins net|distorsion|eau agitée|agitee/i.test(text)) {
    score = Math.max(1, score - 1);
  }
  if (row.analysis.technical.sharpnessOk === false) {
    score = Math.max(1, score - 1);
  }
  return Math.min(10, Math.max(1, score));
}

function justifyWaterReflections(row: ImageRow): string {
  const text = combinedText(row.analysis);
  const score = scoreWaterReflections(row);

  if (/reflet.*net|reflets nets|eau calme|reflet parfait/i.test(text)) {
    return 'Reflet net et bien défini, eau calme.';
  }
  if (/reflet.*moins|moins net|moins défin|moins defin/i.test(text)) {
    return 'Reflet présent mais moins net ou moins homogène.';
  }
  if (/distorsion|deform/i.test(text)) {
    return 'Reflet correct avec légère distorsion.';
  }
  if (score >= 9) return 'Très bon rendu des reflets sur l\'eau.';
  if (score >= 7) return 'Reflets corrects, netteté légèrement inférieure.';
  return 'Reflets peu lisibles ou eau peu favorable.';
}

function justifyArchitectural(row: ImageRow): string {
  const score = row.analysis.aesthetic.subjectRelevance;
  const tech = row.analysis.technical;

  if (!tech.sharpnessOk) {
    return 'Netteté insuffisante sur certains détails architecturaux.';
  }
  if (tech.issues.some((i) => /flou|basse résolution|basse resolution/i.test(i))) {
    return 'Détails un peu flous ou résolution limitée.';
  }
  if (score >= 9) return 'Tous les détails sont nets et bien visibles.';
  if (score >= 7) return 'Bonne netteté d\'ensemble sur l\'architecture.';
  return 'Détails architecturaux moins lisibles ou sujet moins mis en valeur.';
}

function justifyCompliance(row: ImageRow): string {
  const { status, checks } = row.analysis.compliance;
  const failed = checks.filter((c) => c.status === 'fail');
  const warned = checks.filter((c) => c.status === 'warning');

  if (status === 'pass') return 'Aucune alerte de conformité éditoriale ou RGPD.';
  if (failed.length > 0) {
    return `Non conforme : ${failed.map((c) => c.label).slice(0, 2).join(', ')}.`;
  }
  if (warned.length > 0) {
    return `Alerte : ${warned.map((c) => c.label).slice(0, 2).join(', ')}.`;
  }
  return 'Conformité à vérifier.';
}

function complianceScore(status: ImageAnalysis['compliance']['status']): number {
  if (status === 'pass') return 10;
  if (status === 'warning') return 6;
  return 3;
}

export function buildDuplicateGroupComparison(
  memberIds: string[],
  recommendedImageId: string,
  byId: Map<string, ImageRow>
): DuplicateGroupComparison | null {
  const rows = memberIds.map((id) => byId.get(id)).filter((x): x is ImageRow => !!x);
  if (rows.length < 2) return null;

  const withWater = groupHasWaterContext(rows);

  const criterionDefs: Array<{
    id: string;
    label: string;
    score: (row: ImageRow) => number;
    justify: (row: ImageRow) => string;
  }> = [
    {
      id: 'composition',
      label: 'Composition',
      score: (r) => r.analysis.aesthetic.composition,
      justify: justifyComposition,
    },
    {
      id: 'lighting',
      label: 'Lumière et atmosphère',
      score: (r) => r.analysis.aesthetic.lighting,
      justify: justifyLighting,
    },
    ...(withWater
      ? [
          {
            id: 'water_reflections',
            label: 'Reflets dans l\'eau',
            score: scoreWaterReflections,
            justify: justifyWaterReflections,
          },
        ]
      : [
          {
            id: 'editorial_impact',
            label: 'Impact éditorial',
            score: (r: ImageRow) => r.analysis.aesthetic.editorialImpact,
            justify: (r: ImageRow) => {
              const s = r.analysis.aesthetic.editorialImpact;
              if (s >= 9) return 'Très percutante pour une publication guide.';
              if (s >= 7) return 'Bonne attractivité éditoriale.';
              return 'Impact visuel plus faible pour une mise en avant.';
            },
          },
        ]),
    {
      id: 'architectural',
      label: 'Détails architecturaux',
      score: (r) => r.analysis.aesthetic.subjectRelevance,
      justify: justifyArchitectural,
    },
    {
      id: 'compliance',
      label: 'Conformité éditoriale',
      score: (r) => complianceScore(r.analysis.compliance.status),
      justify: justifyCompliance,
    },
  ];

  const criteria: CriterionComparisonRow[] = criterionDefs.map((def) => {
    const scoresByImageId: Record<string, number> = {};
    const justificationsByImageId: Record<string, string> = {};
    for (const row of rows) {
      scoresByImageId[row.id] = def.score(row);
      justificationsByImageId[row.id] = def.justify(row);
    }
    return {
      id: def.id,
      label: def.label,
      maxScore: 10,
      scoresByImageId,
      justificationsByImageId,
    };
  });

  const totalByImageId: Record<string, number> = {};
  for (const row of rows) {
    totalByImageId[row.id] = criteria.reduce(
      (sum, c) => sum + (c.scoresByImageId[row.id] ?? 0),
      0
    );
  }

  const maxTotal = criteria.length * 10;
  const recName = byId.get(recommendedImageId)?.name ?? 'Image recommandée';
  const recTotal = totalByImageId[recommendedImageId] ?? 0;

  return {
    criteria,
    totalByImageId,
    recommendedImageId,
    headline: `${recName} — ${recTotal}/${maxTotal} (meilleur total du groupe)`,
  };
}
