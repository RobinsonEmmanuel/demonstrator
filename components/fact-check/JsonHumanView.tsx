'use client';

import { useMemo, useState } from 'react';
import { SitDraftHumanView } from '@/components/fact-check/SitDraftHumanView';
import { parseSitDraftForDisplay } from '@/lib/sit-draft-display';

const FIELD_LABELS: Record<string, string> = {
  id: 'Identifiant',
  name: 'Nom',
  title: 'Titre',
  label: 'Libellé',
  slug: 'Slug',
  type: 'Type',
  status: 'Statut',
  description: 'Description',
  shortDescription: 'Description courte',
  fullDescription: 'Description complète',
  presentation: 'Présentation',
  horaires: 'Horaires',
  openingHours: 'Horaires',
  schedule: 'Horaires',
  tarif: 'Tarif',
  tarifs: 'Tarifs',
  price: 'Prix',
  prices: 'Tarifs',
  address: 'Adresse',
  adresse: 'Adresse',
  access: 'Accès',
  acces: 'Accès',
  accessibility: 'Accessibilité',
  accessibilite: 'Accessibilité',
  contact: 'Contact',
  phone: 'Téléphone',
  email: 'E-mail',
  website: 'Site web',
  url: 'URL',
  destination: 'Destination',
  clusterName: 'Cluster',
  latitude: 'Latitude',
  longitude: 'Longitude',
  duration: 'Durée',
  duree: 'Durée',
  languages: 'Langues',
  langues: 'Langues',
  tags: 'Tags',
  metadata: 'Métadonnées',
  content: 'Contenu',
  fields: 'Champs',
  practicalInfo: 'Infos pratiques',
  editorial: 'Éditorial',
};

function humanizeKey(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T|\b)/.test(s) && !Number.isNaN(Date.parse(s));
}

function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (isIsoDate(value)) {
      try {
        return new Date(value).toLocaleString('fr-FR', {
          dateStyle: 'medium',
          timeStyle: value.includes('T') ? 'short' : undefined,
        });
      } catch {
        return value;
      }
    }
    return value;
  }
  return String(value);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickSummary(data: unknown): { title?: string; subtitle?: string } {
  if (!isPlainObject(data)) return {};
  const title =
    (typeof data.name === 'string' && data.name) ||
    (typeof data.title === 'string' && data.title) ||
    (typeof data.label === 'string' && data.label) ||
    undefined;
  const subtitle =
    (typeof data.destination === 'string' && data.destination) ||
    (typeof data.type === 'string' && data.type) ||
    (typeof data.status === 'string' && data.status) ||
    undefined;
  return { title, subtitle };
}

function LongText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 280;
  const needsClamp = text.length > limit;

  return (
    <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
      {needsClamp && !expanded ? `${text.slice(0, limit)}…` : text}
      {needsClamp && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="ml-1 text-xs font-medium text-orange-600 hover:underline"
        >
          {expanded ? 'Réduire' : 'Voir tout'}
        </button>
      )}
    </p>
  );
}

function ValueBlock({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || value === undefined) {
    return <span className="text-sm text-gray-400 italic">Non renseigné</span>;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = formatPrimitive(value);
    if (typeof value === 'string' && value.length > 80) {
      return <LongText text={text} />;
    }
    return <span className="text-sm text-gray-900">{text}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-sm text-gray-400 italic">Liste vide</span>;
    }
    const allPrimitive = value.every(
      (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v)
    );
    if (allPrimitive) {
      return (
        <ul className="list-disc pl-4 space-y-0.5 text-sm text-gray-900">
          {value.map((item, i) => (
            <li key={i}>{formatPrimitive(item)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Élément {i + 1}
            </p>
            <JsonNode value={item} depth={depth + 1} defaultOpen={depth < 1} />
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    return <JsonNode value={value} depth={depth + 1} defaultOpen={depth < 2} />;
  }

  return <span className="text-sm text-gray-600">{String(value)}</span>;
}

function JsonNode({
  value,
  depth,
  defaultOpen = true,
}: {
  value: unknown;
  depth: number;
  defaultOpen?: boolean;
}) {
  if (!isPlainObject(value)) {
    return <ValueBlock value={value} depth={depth} />;
  }

  const SKIP_KEYS = new Set([
    'metadata',
    'meta',
    'field_metadata',
    'fieldMetadata',
    'createdAt',
    'updatedAt',
    'created_at',
    'updated_at',
    '__v',
  ]);

  const entries = Object.entries(value).filter(
    ([key, v]) => v !== undefined && !SKIP_KEYS.has(key) && !key.toLowerCase().endsWith('_metadata')
  );
  if (entries.length === 0) {
    return <span className="text-sm text-gray-400 italic">Objet vide</span>;
  }

  if (depth > 5) {
    return (
      <span className="text-xs text-gray-500">
        {entries.length} propriété{entries.length > 1 ? 's' : ''} (niveau profond)
      </span>
    );
  }

  return (
    <div className={depth > 0 ? 'space-y-2' : 'space-y-3'}>
      {entries.map(([key, child]) => {
        const simple =
          child === null ||
          ['string', 'number', 'boolean'].includes(typeof child) ||
          (Array.isArray(child) &&
            child.every((x) => x === null || ['string', 'number', 'boolean'].includes(typeof x)));

        if (simple) {
          return (
            <div
              key={key}
              className="grid gap-1 sm:grid-cols-[minmax(7rem,34%)_1fr] sm:gap-3 py-1.5 border-b border-gray-100 last:border-0"
            >
              <dt className="text-xs font-semibold text-gray-600">{humanizeKey(key)}</dt>
              <dd>
                <ValueBlock value={child} depth={depth + 1} />
              </dd>
            </div>
          );
        }

        return (
          <details
            key={key}
            open={defaultOpen}
            className="group rounded-lg border border-gray-200 bg-white overflow-hidden"
          >
            <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100/80 [&::-webkit-details-marker]:hidden">
              <span className="text-xs font-semibold text-gray-800">{humanizeKey(key)}</span>
              <span className="text-[10px] text-gray-500 group-open:hidden">Ouvrir</span>
              <span className="text-[10px] text-gray-500 hidden group-open:inline">Fermer</span>
            </summary>
            <div className="px-3 py-2 border-t border-gray-100">
              <ValueBlock value={child} depth={depth + 1} />
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function JsonHumanView({ data }: { data: unknown }) {
  const summary = useMemo(() => pickSummary(data), [data]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {(summary.title || summary.subtitle) && (
        <div className="border-b border-gray-100 bg-orange-50/50 px-4 py-3">
          {summary.title && (
            <p className="text-base font-semibold text-gray-900">{summary.title}</p>
          )}
          {summary.subtitle && (
            <p className="text-sm text-gray-600 mt-0.5">{summary.subtitle}</p>
          )}
        </div>
      )}
      <div className="max-h-[min(52vh,420px)] overflow-y-auto px-4 py-3">
        <JsonNode value={data} depth={0} defaultOpen />
      </div>
    </div>
  );
}

export function JsonPreviewToggle({
  jsonText,
  poiId,
}: {
  jsonText: string;
  poiId?: string | null;
}) {
  const [viewMode, setViewMode] = useState<'human' | 'json'>('human');

  const { parsed, parseError } = useMemo(() => {
    try {
      return { parsed: JSON.parse(jsonText) as unknown, parseError: null as string | null };
    } catch {
      return { parsed: null, parseError: 'JSON invalide' };
    }
  }, [jsonText]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-800">Aperçu du référentiel</p>
        <div className="flex flex-wrap items-center gap-2">
          {poiId ? (
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-900 font-mono">
              {poiId}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              Import manuel
            </span>
          )}
          <div
            className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5"
            role="tablist"
            aria-label="Mode d'affichage"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'human'}
              onClick={() => setViewMode('human')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'human'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Lisible
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'json'}
              onClick={() => setViewMode('json')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'json'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {parseError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {parseError}
        </p>
      ) : viewMode === 'json' ? (
        <textarea
          readOnly
          value={jsonText}
          rows={14}
          spellCheck={false}
          className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-gray-800"
        />
      ) : parsed ? (
        parseSitDraftForDisplay(parsed) ? (
          <SitDraftHumanView data={parsed} />
        ) : (
          <JsonHumanView data={parsed} />
        )
      ) : null}
    </div>
  );
}
