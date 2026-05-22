/** Libellé affiché d’un POI Region Lovers (autocomplétion, en-têtes). */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asArray(data: unknown): unknown[] {
  return Array.isArray(data) ? data : [];
}

function formatFieldValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const t = value.trim();
    return t || undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => formatFieldValue(v))
      .filter((s): s is string => Boolean(s));
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }
  return undefined;
}

function blockId(block: Record<string, unknown>): string | undefined {
  const id = block.block_id ?? block.blockId;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}

function fieldId(field: Record<string, unknown>): string | undefined {
  const id = field.field_id ?? field.fieldId ?? field.field_name ?? field.fieldName;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}

function fieldValue(field: Record<string, unknown>): unknown {
  if ('value' in field) return field.value;
  if ('field_value' in field) return field.field_value;
  if ('fieldValue' in field) return field.fieldValue;
  return undefined;
}

function findFieldInBlocks(
  blocks: unknown,
  opts: { blockId?: string; fieldIds: string[] }
): string | undefined {
  for (const block of asArray(blocks)) {
    if (!isPlainObject(block)) continue;
    if (opts.blockId) {
      const bid = blockId(block);
      if (bid !== opts.blockId) continue;
    }
    for (const section of asArray(block.sections)) {
      if (!isPlainObject(section)) continue;
      for (const field of asArray(section.fields)) {
        if (!isPlainObject(field)) continue;
        const fid = fieldId(field);
        if (!fid || !opts.fieldIds.includes(fid)) continue;
        const text = formatFieldValue(fieldValue(field));
        if (text) return text;
      }
    }
  }
  return undefined;
}

/**
 * Nom du lieu : `blocks[block_id=general_info].sections[].fields[field_id=name].value`.
 */
export function extractSitPoiDisplayName(draft: unknown): string | undefined {
  if (!isPlainObject(draft)) return undefined;

  const fromGeneralInfo = findFieldInBlocks(draft.blocks, {
    blockId: 'general_info',
    fieldIds: ['name'],
  });
  if (fromGeneralInfo) return fromGeneralInfo;

  return findFieldInBlocks(draft.blocks, {
    fieldIds: ['name', 'native_name', 'nativeName', 'title'],
  });
}

export function extractSitPoiCategoryLabel(draft: unknown): string | undefined {
  if (!isPlainObject(draft)) return undefined;
  const v = draft.place_name ?? draft.placeName;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export function extractSitPoiInstanceId(draft: unknown): string | undefined {
  if (!isPlainObject(draft)) return undefined;
  const v = draft.place_instance_id ?? draft.placeInstanceId;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
