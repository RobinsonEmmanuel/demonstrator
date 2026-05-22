'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SitPoiOption } from '@/types/sit';

function normalizeQuery(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function labelMatchesQuery(label: string, query: string): boolean {
  const hay = normalizeQuery(label);
  const tokens = normalizeQuery(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => hay.includes(token));
}

function rankMatch(label: string, query: string): number {
  const hay = normalizeQuery(label);
  const q = normalizeQuery(query);
  if (!q) return 0;
  if (hay === q) return 4;
  if (hay.startsWith(q)) return 3;
  if (hay.includes(q)) return 2;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => hay.includes(t))) return 1;
  return 0;
}

export function SitPoiAutocomplete({
  options,
  value,
  onChange,
  disabled,
  listLoading,
  listError,
  onEnter,
}: {
  options: SitPoiOption[];
  value: string;
  onChange: (poiId: string) => void;
  disabled?: boolean;
  listLoading?: boolean;
  listError?: string | null;
  onEnter?: () => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value]
  );

  /** Synchronise le champ quand le parent impose un POI (réouverture modale, etc.). */
  useEffect(() => {
    if (selected) {
      setQuery(selected.label);
      return;
    }
    if (!value) {
      setQuery('');
    }
  }, [selected, value]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options.slice(0, 40);

    return options
      .filter((o) => labelMatchesQuery(o.label, q))
      .sort((a, b) => {
        const ra = rankMatch(a.label, q);
        const rb = rankMatch(b.label, q);
        if (rb !== ra) return rb - ra;
        return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
      })
      .slice(0, 40);
  }, [options, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleSelect = (opt: SitPoiOption) => {
    onChange(opt.id);
    setQuery(opt.label);
    setOpen(false);
  };

  const handleInputChange = (text: string) => {
    setQuery(text);
    setOpen(true);

    const trimmed = text.trim();
    const exactId = options.find((o) => o.id === trimmed);
    if (exactId) {
      onChange(exactId.id);
      return;
    }

    const byLabel = options.find(
      (o) => normalizeQuery(o.label) === normalizeQuery(text)
    );
    if (byLabel) {
      onChange(byLabel.id);
      return;
    }

    if (value) onChange('');
  };

  const hasValidSelection = Boolean(selected && value === selected.id);

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <input
        id="sit-poi-search"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled || listLoading}
        value={query}
        placeholder={
          listLoading
            ? 'Chargement des POI…'
            : options.length > 0
              ? 'Rechercher un lieu…'
              : 'Aucun POI dans la liste'
        }
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 disabled:opacity-60"
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (e.key === 'Enter') {
            if (open && filtered[0]) {
              e.preventDefault();
              handleSelect(filtered[0]);
            } else if (hasValidSelection) {
              onEnter?.();
            }
          }
        }}
      />

      {hasValidSelection && (
        <p className="mt-1 truncate text-[11px] font-mono text-gray-500" title={value}>
          {value}
        </p>
      )}

      {listError && (
        <p className="mt-1 text-xs text-amber-800">{listError}</p>
      )}

      {open && !disabled && !listLoading && filtered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {filtered.map((opt) => (
            <li key={opt.id} role="option" aria-selected={opt.id === value}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left hover:bg-orange-50 ${
                  opt.id === value ? 'bg-orange-50/80' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
              >
                <span className="block text-sm font-medium text-gray-900">{opt.label}</span>
                {opt.subtitle && (
                  <span className="block text-xs text-gray-500 truncate">
                    {opt.subtitle}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !listLoading && query.trim() && filtered.length === 0 && options.length > 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-lg">
          Aucun lieu correspondant à ce nom.
        </p>
      )}
    </div>
  );
}
