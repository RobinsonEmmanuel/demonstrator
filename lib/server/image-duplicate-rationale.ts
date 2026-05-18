import 'server-only';

import type { ImageAnalysis } from '@/types/image-classify';

const AESTHETIC_LABELS: Record<keyof ImageAnalysis['aesthetic'], string> = {
  composition: 'cadrage',
  lighting: 'lumière',
  editorialImpact: 'impact éditorial',
  subjectRelevance: 'pertinence du sujet',
  overall: 'score global',
};

type ImageRow = { id: string; name: string; analysis: ImageAnalysis };

function worstComplianceOthers(others: ImageRow[]): string | null {
  const fails = others.filter((o) => o.analysis.compliance.status === 'fail');
  if (fails.length > 0) {
    const names = fails.map((o) => o.name).slice(0, 2);
    return `certaines alternatives sont non conformes (${names.join(', ')}${fails.length > 2 ? '…' : ''})`;
  }
  const warnings = others.filter((o) => o.analysis.compliance.status === 'warning');
  if (warnings.length > 0 && warnings.length === others.length) {
    return 'les autres présentent au moins une alerte de conformité';
  }
  return null;
}

function technicalWeaknesses(others: ImageRow[]): string[] {
  const out: string[] = [];
  for (const o of others) {
    const issues = o.analysis.technical.issues;
    if (issues.length === 0) continue;
    const short = issues.slice(0, 2).join(', ');
    out.push(`${o.name} : ${short}`);
  }
  return out;
}

function strongestDimensions(rec: ImageAnalysis, others: ImageRow[]): string[] {
  const dims = ['lighting', 'composition', 'editorialImpact', 'subjectRelevance'] as const;
  const strengths: string[] = [];

  for (const dim of dims) {
    const recVal = rec.aesthetic[dim];
    const otherMax = Math.max(...others.map((o) => o.analysis.aesthetic[dim]), 0);
    if (recVal >= otherMax + 1) {
      strengths.push(
        `${AESTHETIC_LABELS[dim]} plus favorable (${recVal}/10 vs ${otherMax}/10)`
      );
    }
  }
  return strengths.slice(0, 2);
}

/**
 * Court texte expliquant pourquoi l'image recommandée est préférée dans un groupe de doublons.
 */
export function buildGroupRecommendationRationale(
  recommendedId: string,
  memberIds: string[],
  byId: Map<string, ImageRow>
): string {
  const rec = byId.get(recommendedId);
  if (!rec || memberIds.length < 2) return '';

  const others = memberIds
    .filter((id) => id !== recommendedId)
    .map((id) => byId.get(id))
    .filter((x): x is ImageRow => !!x);

  if (others.length === 0) return '';

  const recScore = rec.analysis.aesthetic.overall;
  const maxOtherScore = Math.max(...others.map((o) => o.analysis.aesthetic.overall));

  const positives: string[] = [];
  const negatives: string[] = [];

  if (recScore > maxOtherScore) {
    positives.push(`meilleur score global (${recScore}/10 contre ${maxOtherScore}/10 au maximum)`);
  }

  positives.push(...strongestDimensions(rec.analysis, others));

  if (rec.analysis.technical.issues.length === 0) {
    const othersWithIssues = others.filter((o) => o.analysis.technical.issues.length > 0);
    if (othersWithIssues.length > 0) {
      positives.push('aucun défaut technique signalé (les autres ont des réserves)');
    }
  }

  const complianceNote = worstComplianceOthers(others);
  if (complianceNote) positives.push(complianceNote);

  const techWeak = technicalWeaknesses(others);
  if (techWeak.length > 0) {
    negatives.push(`points faibles ailleurs : ${techWeak.slice(0, 2).join(' ; ')}`);
  }

  const lowerImpact = others.filter(
    (o) => o.analysis.aesthetic.editorialImpact < rec.analysis.aesthetic.editorialImpact - 1
  );
  if (lowerImpact.length > 0 && !positives.some((p) => p.includes('impact'))) {
    negatives.push(
      `${lowerImpact.length} cliché(s) moins percutant(s) pour une publication guide`
    );
  }

  const cloudy = others.filter((o) =>
    /nuageux|nuageuse|couvert|gris|sombre|brume/i.test(o.analysis.shortDescription)
  );
  const clearRec = /clair|ensoleill|lumineux|cieux bleu/i.test(rec.analysis.shortDescription);
  if (clearRec && cloudy.length > 0) {
    positives.push('lumière plus favorable (ciel dégagé vs vues plus couvertes)');
  }

  const obstructed = others.filter((o) =>
    /main|doigt|bras|téléphone|objet au premier plan|personne au premier plan/i.test(
      `${o.analysis.shortDescription} ${o.analysis.fullDescription}`
    )
  );
  if (obstructed.length > 0) {
    negatives.push(
      `${obstructed.map((o) => o.name).join(', ')} : élément parasite au cadre`
    );
  }

  let text = `**${rec.name}** est retenue`;
  if (positives.length > 0) {
    text += ` pour ${positives.slice(0, 3).join(', ')}`;
  }
  if (negatives.length > 0) {
    text += `. ${negatives.slice(0, 2).join('. ')}`;
  } else if (positives.length === 0) {
    text += ` (meilleur équilibre des critères esthétiques et conformité dans ce groupe)`;
  }
  text += '.';

  return text;
}
