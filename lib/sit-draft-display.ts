/** Extraction affichage lisible — brouillons Region Lovers (place-instance-drafts). */

import {
  extractSitPoiCategoryLabel,
  extractSitPoiDisplayName,
} from '@/lib/sit-poi-label';

export type SitDisplayField = {
  id: string;
  value: string;
};

export type SitDisplaySection = {
  id: string;
  fields: SitDisplayField[];
};

export type SitDisplayBlock = {
  id: string;
  sections: SitDisplaySection[];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asArray(data: unknown): unknown[] {
  return Array.isArray(data) ? data : [];
}

function pickId(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

export function formatSitFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim() || '—';
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => formatSitFieldValue(v))
      .filter((s) => s !== '—');
    return parts.length > 0 ? parts.join(' · ') : '—';
  }
  if (isPlainObject(value)) {
    const text =
      (typeof value.text === 'string' && value.text) ||
      (typeof value.content === 'string' && value.content) ||
      (typeof value.value === 'string' && value.value);
    if (text) return text;
    return JSON.stringify(value);
  }
  return String(value);
}

function fieldValueFrom(obj: Record<string, unknown>): unknown {
  if ('value' in obj) return obj.value;
  if ('field_value' in obj) return obj.field_value;
  if ('fieldValue' in obj) return obj.fieldValue;
  return undefined;
}

function parseField(raw: unknown): SitDisplayField | null {
  if (!isPlainObject(raw)) return null;
  const id = pickId(raw, ['field_id', 'fieldId', 'field_name', 'fieldName']);
  if (!id) return null;
  return { id, value: formatSitFieldValue(fieldValueFrom(raw)) };
}

/**
 * Structure blocks → sections → fields (block_id, section_id, field_id, value).
 */
export function parseSitDraftForDisplay(data: unknown): SitDisplayBlock[] | null {
  if (!isPlainObject(data)) return null;
  const blocksRaw = asArray(data.blocks);
  if (blocksRaw.length === 0) return null;

  const blocks: SitDisplayBlock[] = [];

  for (const blockRaw of blocksRaw) {
    if (!isPlainObject(blockRaw)) continue;
    const blockId = pickId(blockRaw, ['block_id', 'blockId']) ?? 'block';
    const sections: SitDisplaySection[] = [];

    for (const sectionRaw of asArray(blockRaw.sections)) {
      if (!isPlainObject(sectionRaw)) continue;
      const sectionId =
        pickId(sectionRaw, ['section_id', 'sectionId']) ?? 'section';
      const fields = asArray(sectionRaw.fields)
        .map(parseField)
        .filter((f): f is SitDisplayField => f !== null);

      if (fields.length > 0) {
        sections.push({ id: sectionId, fields });
      }
    }

    if (sections.length > 0) {
      blocks.push({ id: blockId, sections });
    }
  }

  return blocks.length > 0 ? blocks : null;
}

export function pickSitDraftSummary(data: unknown): { title?: string; subtitle?: string } {
  if (!isPlainObject(data)) return {};
  const displayName = extractSitPoiDisplayName(data);
  const categoryLabel = extractSitPoiCategoryLabel(data);
  const typeCode =
    (typeof data.place_type === 'string' && data.place_type) ||
    (typeof data.placeType === 'string' && data.placeType) ||
    undefined;

  const title = displayName ?? categoryLabel ?? undefined;
  const subtitleParts = [
    categoryLabel && categoryLabel !== title ? categoryLabel : null,
    typeCode && typeCode !== title ? typeCode.replace(/_/g, ' ') : null,
    typeof data.destination === 'string' ? data.destination : null,
  ].filter(Boolean);

  return {
    title: title ?? undefined,
    subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined,
  };
}
