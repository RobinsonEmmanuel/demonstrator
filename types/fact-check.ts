/** Types partagés client / serveur — fact checking */

export type FactStatus = 'valid' | 'invalid' | 'uncertain';

/** Champ extrait du texte (équivalent fiche POI redactor-guide). */
export interface ExtractedField {
  id: string;
  name: string;
  label: string;
  value: string;
  sourceSnippet: string;
}

export interface FactVerificationResult {
  /** Identifiant interne (f1, f2…) — clé de verificationById */
  id?: string;
  /** Nom technique du champ (tarif, horaires…) */
  field?: string;
  label?: string;
  value?: string;
  verbatim?: string;
  status: FactStatus;
  comment?: string | null;
  validated_points?: Array<{
    point: string;
    source_ref?: number;
    source_url?: string;
    source_display?: string;
    source_type?: string;
  }>;
  invalid_points?: Array<{
    point: string;
    correction?: string;
    source_ref?: number;
    source_url?: string;
    source_display?: string;
    source_type?: string;
  }>;
}

export interface SpanFact {
  id: string;
  field?: string;
  label?: string;
  value?: string;
  verbatim: string;
  start: number;
  end: number;
}

export interface GroundingSource {
  uri: string;
  title: string;
  display_name: string;
}

/** Site ou page consulté pendant la vérification (agrégé). */
export interface ConsultedSource {
  host: string;
  uri: string;
  display_name: string;
  source_type: string;
  source_type_label: string;
  citation_count: number;
}

export interface FactCheckPlaceContext {
  nomPoi: string;
  destination: string;
  clusterName?: string;
}

export interface FactCheckAnalyzeResponse {
  fields: ExtractedField[];
  spans: SpanFact[];
  verificationById: Record<string, FactVerificationResult>;
  grounding_sources: GroundingSource[];
  /** Sites de confiance interrogés (toutes passes Perplexity + points cités) */
  consulted_sources: ConsultedSource[];
  place?: FactCheckPlaceContext;
  officialDomains?: string[];
  officialPageUrls?: string[];
  extractedCount: number;
  placedCount: number;
  unplacedIds: string[];
}
