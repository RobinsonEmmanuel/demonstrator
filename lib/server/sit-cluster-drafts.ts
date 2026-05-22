import 'server-only';

import {
  extractSitPoiCategoryLabel,
  extractSitPoiDisplayName,
  extractSitPoiInstanceId,
} from '@/lib/sit-poi-label';
import type { SitPoiOption } from '@/types/sit';

const DEFAULT_CLUSTER_ID = 'recVzMydIlyUoBvvB';

export function getSitClusterId(): string {
  return process.env.SIT_CLUSTER_ID?.trim() || DEFAULT_CLUSTER_ID;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isPlainObject(data)) return [];
  for (const key of [
    'drafts',
    'items',
    'data',
    'results',
    'placeInstanceDrafts',
  ]) {
    const v = data[key];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function normalizeDraftItem(raw: unknown): SitPoiOption | null {
  if (!isPlainObject(raw)) return null;

  /** L’API GET /place-instance-drafts/{id} attend place_instance_id, pas _id Mongo. */
  const id =
    extractSitPoiInstanceId(raw) ?? pickString(raw, ['_id', 'id']);

  if (!id) return null;

  const displayName = extractSitPoiDisplayName(raw);

  /** place_name = catégorie (ex. « Musée »), pas le nom du lieu. */
  const placeTypeLabel = extractSitPoiCategoryLabel(raw);
  const placeTypeCode = pickString(raw, ['place_type', 'placeType']);

  const label = displayName ?? id;

  const subtitleParts = [
    placeTypeLabel && placeTypeLabel !== label ? placeTypeLabel : null,
    placeTypeCode && placeTypeCode !== label && placeTypeCode !== placeTypeLabel
      ? placeTypeCode.replace(/_/g, ' ')
      : null,
  ].filter((s): s is string => Boolean(s));

  const subtitle =
    subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined;

  return { id, label, subtitle };
}

export function normalizeClusterDraftsResponse(data: unknown): SitPoiOption[] {
  const items = asArray(data)
    .map(normalizeDraftItem)
    .filter((x): x is SitPoiOption => x !== null);

  const byId = new Map<string, SitPoiOption>();
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }

  return [...byId.values()].sort((a, b) =>
    a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })
  );
}
