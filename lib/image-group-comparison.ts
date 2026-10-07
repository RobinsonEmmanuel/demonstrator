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

function justifySubject(row: ImageRow): string {
  const score = row.analysis.aesthetic.subjectRelevance;
  const tech = row.analysis.technical;

  if (!tech.sharpnessOk) {
    return 'Netteté insuffisante sur le sujet principal.';
  }
  if (tech.issues.some((i) => /flou|basse résolution|basse resolution/i.test(i))) {
    return 'Sujet un peu flou ou résolution limitée.';
  }
  if (score >= 9) return 'Le lieu est clairement identifiable et mis en valeur.';
  if (score >= 7) return 'Sujet bien lisible et représentatif du lieu.';
  return 'Sujet moins lisible ou moins représentatif du lieu.';
}

function justifyEditorial(row: ImageRow): string {
  const s = row.analysis.aesthetic.editorialImpact;
  if (s >= 9) return 'Très percutante pour une publication guide.';
  if (s >= 7) return 'Bonne attractivité éditoriale.';
  return 'Impact visuel plus faible pour une mise en avant.';
}

export function buildDuplicateGroupComparison(
  memberIds: string[],
  recommendedImageId: string,
  byId: Map<string, ImageRow>
): DuplicateGroupComparison | null {
  const rows = memberIds.map((id) => byId.get(id)).filter((x): x is ImageRow => !!x);
  if (rows.length < 2) return null;

  // 4 critères génériques et fixes : comparables d'un groupe à l'autre, quel que soit le lieu.
  // La conformité éditoriale/RGPD n'est pas un critère de score : elle sert de filtre
  // (une image non conforme n'est jamais recommandée, cf. pickBestInGroup).
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
    {
      id: 'editorial_impact',
      label: 'Impact éditorial',
      score: (r) => r.analysis.aesthetic.editorialImpact,
      justify: justifyEditorial,
    },
    {
      id: 'subject_relevance',
      label: 'Pertinence du sujet',
      score: (r) => r.analysis.aesthetic.subjectRelevance,
      justify: justifySubject,
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
