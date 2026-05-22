import {
  extractSitPoiDisplayName,
  extractSitPoiInstanceId,
} from '@/lib/sit-poi-label';
import { formatSitFieldValue } from '@/lib/sit-draft-display';

export type SitReferentialField = {
  blockId: string;
  sectionId: string;
  fieldId: string;
  value: string;
};

export type SitPoiSnapshot = {
  poiId: string;
  poiName: string;
  fields: SitReferentialField[];
};

const MAX_VALUE_LEN = 400;

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

function fieldValueFrom(obj: Record<string, unknown>): unknown {
  if ('value' in obj) return obj.value;
  if ('field_value' in obj) return obj.field_value;
  if ('fieldValue' in obj) return obj.fieldValue;
  return undefined;
}

function truncateValue(value: string): string {
  if (value.length <= MAX_VALUE_LEN) return value;
  return `${value.slice(0, MAX_VALUE_LEN)}…`;
}

/** Aplatit un brouillon SIT en champs block_id / section_id / field_id / value. */
export function flattenSitDraftFields(draft: unknown): SitReferentialField[] {
  if (!isPlainObject(draft)) return [];

  const fields: SitReferentialField[] = [];

  for (const blockRaw of asArray(draft.blocks)) {
    if (!isPlainObject(blockRaw)) continue;
    const blockId = pickId(blockRaw, ['block_id', 'blockId']) ?? 'block';

    for (const sectionRaw of asArray(blockRaw.sections)) {
      if (!isPlainObject(sectionRaw)) continue;
      const sectionId =
        pickId(sectionRaw, ['section_id', 'sectionId']) ?? 'section';

      for (const fieldRaw of asArray(sectionRaw.fields)) {
        if (!isPlainObject(fieldRaw)) continue;
        const fieldId = pickId(fieldRaw, [
          'field_id',
          'fieldId',
          'field_name',
          'fieldName',
        ]);
        if (!fieldId) continue;

        const rawValue = formatSitFieldValue(fieldValueFrom(fieldRaw));
        if (!rawValue || rawValue === '—') continue;

        fields.push({
          blockId,
          sectionId,
          fieldId,
          value: truncateValue(rawValue),
        });
      }
    }
  }

  return fields;
}

export function buildSitPoiSnapshot(draft: unknown): SitPoiSnapshot | null {
  const poiId = extractSitPoiInstanceId(draft);
  if (!poiId) return null;

  const poiName =
    extractSitPoiDisplayName(draft) ??
    (isPlainObject(draft) && typeof draft.place_name === 'string'
      ? draft.place_name.trim()
      : poiId);

  const fields = flattenSitDraftFields(draft);
  if (fields.length === 0) return null;

  return { poiId, poiName, fields };
}

export function buildSitSnapshotsFromDrafts(
  drafts: unknown[],
  poiIds: Set<string>
): SitPoiSnapshot[] {
  const snapshots: SitPoiSnapshot[] = [];
  for (const draft of drafts) {
    const snapshot = buildSitPoiSnapshot(draft);
    if (snapshot && poiIds.has(snapshot.poiId)) {
      snapshots.push(snapshot);
    }
  }
  return snapshots;
}
