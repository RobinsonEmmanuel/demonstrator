/** Types partagés — classification d'images */

export type SceneType =
  | 'exterior'
  | 'interior'
  | 'detail'
  | 'food'
  | 'panorama'
  | 'night'
  | 'people'
  | 'other';

/** Cadrage / point de vue — utilisé pour éviter de regrouper des vues très différentes du même lieu. */
export type CompositionType =
  | 'wide_exterior'
  | 'framed_view'
  | 'architectural_detail'
  | 'interior_scene'
  | 'panorama'
  | 'people_focus'
  | 'other';

export type ComplianceStatus = 'pass' | 'warning' | 'fail';

export interface ComplianceCheck {
  id: string;
  label: string;
  status: ComplianceStatus;
  detail: string;
}

export interface ImageCompliance {
  status: ComplianceStatus;
  checks: ComplianceCheck[];
}

export interface AestheticScores {
  composition: number;
  lighting: number;
  editorialImpact: number;
  subjectRelevance: number;
  overall: number;
}

export interface NotablePoint {
  label: string;
  region?: string;
}

export interface TechnicalQuality {
  resolutionOk: boolean;
  sharpnessOk: boolean;
  horizonLevel: boolean;
  issues: string[];
}

export interface ImageAnalysis {
  shortDescription: string;
  fullDescription: string;
  sceneType: SceneType;
  compositionType: CompositionType;
  tags: string[];
  suggestedCaption?: string;
  notablePoints: NotablePoint[];
  technical: TechnicalQuality;
  aesthetic: AestheticScores;
  compliance: ImageCompliance;
}

export interface UploadedImageInput {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface AnalyzedImageResult {
  id: string;
  name: string;
  analysis: ImageAnalysis;
  duplicateGroupId: string | null;
  isRecommendedInGroup: boolean;
  overallRank: number;
}

export interface CriterionComparisonRow {
  id: string;
  label: string;
  maxScore: number;
  scoresByImageId: Record<string, number>;
  justificationsByImageId: Record<string, string>;
}

export interface DuplicateGroupComparison {
  criteria: CriterionComparisonRow[];
  totalByImageId: Record<string, number>;
  recommendedImageId: string;
  headline: string;
}

export interface DuplicateGroup {
  id: string;
  imageIds: string[];
  recommendedImageId: string;
  similarityNote: string;
  /** Pourquoi cette image est préférée aux autres du groupe. */
  recommendationReason: string;
  /** Tableau comparatif critère par critère (généré à partir des scores vision). */
  comparison?: DuplicateGroupComparison;
}

export interface ImageClassifyContext {
  poiName?: string;
  destination?: string;
}

export interface ImageClassifyResponse {
  images: AnalyzedImageResult[];
  duplicateGroups: DuplicateGroup[];
  rankedImageIds: string[];
  context?: ImageClassifyContext;
  /** Lot d'indexation SigLIP / Mongo */
  batchId?: string;
  /** true si embeddings mock (SIGLIP_MOCK) */
  siglipMocked?: boolean;
}
