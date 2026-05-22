import {
  extractSitPoiDisplayName,
  extractSitPoiInstanceId,
} from '@/lib/sit-poi-label';
import type { SocialAccount, SocialPlatform } from '@/types/social-watch';

const ONLINE_PRESENCE_BLOCK = 'online_presence';
const ONLINE_PRESENCE_SECTION = 'online_presence_on_the_web';

const SOCIAL_FIELD_IDS: SocialPlatform[] = [
  'facebook',
  'linkedin',
  'instagram',
  'twitter',
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asArray(data: unknown): unknown[] {
  return Array.isArray(data) ? data : [];
}

function fieldId(field: Record<string, unknown>): string | undefined {
  const id = field.field_id ?? field.fieldId ?? field.field_name ?? field.fieldName;
  return typeof id === 'string' && id.trim() ? id.trim().toLowerCase() : undefined;
}

function fieldValue(field: Record<string, unknown>): string | undefined {
  const v = field.value ?? field.field_value ?? field.fieldValue;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
}

function isSocialPlatform(id: string): id is SocialPlatform {
  return (SOCIAL_FIELD_IDS as string[]).includes(id);
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.href.replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

/** Comptes réseaux sociaux depuis le bloc online_presence du brouillon SIT. */
export function extractOnlinePresenceAccounts(draft: unknown): SocialAccount[] {
  if (!isPlainObject(draft)) return [];

  const poiId = extractSitPoiInstanceId(draft);
  if (!poiId) return [];

  const poiName =
    extractSitPoiDisplayName(draft) ??
    (typeof draft.place_name === 'string' ? draft.place_name.trim() : poiId);

  const accounts: SocialAccount[] = [];

  for (const block of asArray(draft.blocks)) {
    if (!isPlainObject(block)) continue;
    const bid = block.block_id ?? block.blockId;
    if (bid !== ONLINE_PRESENCE_BLOCK) continue;

    for (const section of asArray(block.sections)) {
      if (!isPlainObject(section)) continue;
      const sid = section.section_id ?? section.sectionId;
      if (sid !== ONLINE_PRESENCE_SECTION) continue;

      for (const field of asArray(section.fields)) {
        if (!isPlainObject(field)) continue;
        const fid = fieldId(field);
        if (!fid || !isSocialPlatform(fid)) continue;
        const url = fieldValue(field);
        if (!url) continue;
        accounts.push({
          poiId,
          poiName,
          platform: fid,
          url: normalizeUrl(url),
        });
      }
    }
  }

  return accounts;
}

export function filterDraftsByPoiIds(
  drafts: unknown[],
  allowedPoiIds: Set<string> | null
): unknown[] {
  if (!allowedPoiIds) return drafts;
  return drafts.filter((draft) => {
    const id = extractSitPoiInstanceId(draft);
    return id != null && allowedPoiIds.has(id);
  });
}

export function extractClusterSocialAccounts(drafts: unknown[]): SocialAccount[] {
  const byKey = new Map<string, SocialAccount>();
  for (const draft of drafts) {
    for (const account of extractOnlinePresenceAccounts(draft)) {
      const key = `${account.poiId}:${account.platform}`;
      if (!byKey.has(key)) byKey.set(key, account);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.poiName.localeCompare(b.poiName, 'fr', { sensitivity: 'base' })
  );
}

export function draftsArrayFromClusterResponse(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isPlainObject(data) && Array.isArray(data.drafts)) return data.drafts;
  return [];
}
