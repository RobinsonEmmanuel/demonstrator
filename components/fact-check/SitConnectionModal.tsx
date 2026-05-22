'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/api-client';
import { JsonPreviewToggle } from '@/components/fact-check/JsonHumanView';
import { SitPoiAutocomplete } from '@/components/fact-check/SitPoiAutocomplete';
import type { SitPoiOption } from '@/types/sit';

type SitDraftResponse = {
  poiId: string;
  data: unknown;
};

export function SitConnectionModal({
  open,
  onClose,
  onConfirm,
  initialPoiId,
  initialJson,
  confirmLabel = 'Valider le référentiel',
  poiOptions,
  poiListLoading = false,
  poiListError = null,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (json: string, poiId: string | null) => void;
  initialPoiId?: string;
  initialJson?: string;
  /** Libellé du bouton de confirmation (ex. lancement de la validation) */
  confirmLabel?: string;
  poiOptions: SitPoiOption[];
  poiListLoading?: boolean;
  poiListError?: string | null;
}) {
  const [poiId, setPoiId] = useState(initialPoiId ?? '');
  const [previewJson, setPreviewJson] = useState(initialJson ?? '');
  const [fetchedPoiId, setFetchedPoiId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPoiId(initialPoiId ?? '');
    setPreviewJson(initialJson ?? '');
    setFetchedPoiId(initialPoiId?.trim() ? initialPoiId.trim() : null);
    setError(null);
    setLoading(false);
  }, [open, initialPoiId, initialJson]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, loading, onClose]);

  const setJsonPreview = useCallback((text: string, sourcePoiId: string | null) => {
    setPreviewJson(text);
    setFetchedPoiId(sourcePoiId);
    setError(null);
  }, []);

  const handleFetch = async () => {
    const id = poiId.trim();
    if (!id) {
      setError('Sélectionnez un POI dans la liste.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/tools/fact-check/sit-draft?poiId=${encodeURIComponent(id)}`
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Échec de la récupération SIT');
      }
      const payload = body as SitDraftResponse;
      const formatted = JSON.stringify(payload.data, null, 2);
      setJsonPreview(formatted, payload.poiId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text);
      setJsonPreview(text, null);
    } catch {
      setError('Fichier JSON invalide.');
    }
  };

  const handleConfirm = () => {
    const trimmed = previewJson.trim();
    if (!trimmed) {
      setError('Récupérez ou importez un JSON avant de valider.');
      return;
    }
    try {
      JSON.parse(trimmed);
    } catch {
      setError('JSON invalide — corrigez avant de valider.');
      return;
    }
    onConfirm(trimmed, fetchedPoiId);
    onClose();
  };

  if (!open) return null;

  const previewValid = (() => {
    if (!previewJson.trim()) return false;
    try {
      JSON.parse(previewJson);
      return true;
    } catch {
      return false;
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sit-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="Fermer"
        disabled={loading}
        onClick={onClose}
      />

      <div
        className="relative flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-gray-200 bg-gray-50 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-600">
            Connexion SIT
          </p>
          <h2 id="sit-modal-title" className="text-lg font-semibold text-gray-900">
            Référentiel Region Lovers
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Recherchez un POI du cluster, vérifiez le référentiel, puis lancez la validation
            base de données + web.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label
              htmlFor="sit-poi-search"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Lieu (POI)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <SitPoiAutocomplete
                options={poiOptions}
                value={poiId}
                onChange={setPoiId}
                disabled={loading}
                listLoading={poiListLoading}
                listError={poiListError}
                onEnter={() => void handleFetch()}
              />
              <button
                type="button"
                onClick={() => void handleFetch()}
                disabled={
                  loading ||
                  !poiOptions.some((o) => o.id === poiId.trim())
                }
                className="shrink-0 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {loading ? 'Récupération…' : 'Récupérer'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>ou</span>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              disabled={loading}
              onChange={(e) => {
                void handleFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Importer un fichier .json
            </button>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          {previewJson.trim() ? (
            <div>
              <JsonPreviewToggle jsonText={previewJson} poiId={fetchedPoiId} />
              {previewValid && (
                <p className="mt-2 text-xs text-emerald-700">
                  Référentiel valide — validez pour l&apos;utiliser au niveau 1 du fact checking.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center text-sm text-gray-500">
              Le JSON du POI s&apos;affichera ici après récupération.
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !previewValid}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
