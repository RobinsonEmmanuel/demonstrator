'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import AppShell from '@/components/AppShell';
import { PhotoIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { useRequireAuth } from '@/lib/use-require-auth';
import { authFetch } from '@/lib/api-client';
import { ImageCard } from '@/components/image-classify/ImageCard';
import { DuplicateGroupsSection } from '@/components/image-classify/DuplicateGroupsSection';
import { ImageDetailPanel } from '@/components/image-classify/ImageDetailPanel';
import type { AnalyzedImageResult, ImageClassifyResponse } from '@/types/image-classify';

const MAX_FILES = 20;
const MAX_MB = 8;

type LocalImage = {
  id: string;
  name: string;
  dataUrl: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageClassificationPage() {
  const ready = useRequireAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [localImages, setLocalImages] = useState<LocalImage[]>([]);
  const [poiName, setPoiName] = useState('');
  const [destination, setDestination] = useState('');
  const [result, setResult] = useState<ImageClassifyResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'all' | 'duplicates' | 'ranking'>('all');

  const previewById = useMemo(
    () => new Map(localImages.map((i) => [i.id, i.dataUrl])),
    [localImages]
  );

  const imagesById = useMemo(() => {
    const m = new Map<string, AnalyzedImageResult>();
    result?.images.forEach((img) => m.set(img.id, img));
    return m;
  }, [result]);

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setResult(null);

    const batch: LocalImage[] = [];
    for (let i = 0; i < files.length && localImages.length + batch.length < MAX_FILES; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`Fichier trop volumineux (max ${MAX_MB} Mo) : ${file.name}`);
        continue;
      }
      const dataUrl = await fileToDataUrl(file);
      batch.push({
        id: `img-${Date.now()}-${i}`,
        name: file.name,
        dataUrl,
      });
    }
    if (batch.length) setLocalImages((prev) => [...prev, ...batch].slice(0, MAX_FILES));
  }, [localImages.length]);

  const handleAnalyze = async () => {
    if (localImages.length === 0) {
      setError('Ajoutez au moins une image.');
      return;
    }
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setSelectedId(null);
    try {
      const res = await authFetch('/api/tools/image-classify/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: localImages.map((i) => ({
            id: i.id,
            name: i.name,
            dataUrl: i.dataUrl,
          })),
          context: {
            ...(poiName.trim() ? { poiName: poiName.trim() } : {}),
            ...(destination.trim() ? { destination: destination.trim() } : {}),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de l’analyse');
      setResult(data as ImageClassifyResponse);
      setActiveSection('all');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setAnalyzing(false);
    }
  };

  const clearAll = () => {
    setLocalImages([]);
    setResult(null);
    setSelectedId(null);
    setError(null);
  };

  const rankedImages = useMemo(() => {
    if (!result) return [];
    return result.rankedImageIds
      .map((id) => imagesById.get(id))
      .filter(Boolean) as NonNullable<ReturnType<typeof imagesById.get>>[];
  }, [result, imagesById]);

  const selectedImage = selectedId ? imagesById.get(selectedId) : undefined;

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-8 pb-16">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
            <PhotoIcon className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Classification d&apos;images</h1>
            <p className="text-gray-600 mt-1">
              Chargement → analyse vision → doublons → scoring esthétique (4 critères) → conformité
              RGPD / éditoriale → détail et tags au clic.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lieu (optionnel)
              </label>
              <input
                type="text"
                value={poiName}
                onChange={(e) => setPoiName(e.target.value)}
                placeholder="Ex. MuMa Le Havre"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination (optionnel)
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Ex. Le Havre"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-orange-400 transition-colors bg-gray-50/50"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              void addFiles(e.dataTransfer.files);
            }}
          >
            <ArrowUpTrayIcon className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-3">
              Glissez vos images ici ou parcourez (max {MAX_FILES}, {MAX_MB} Mo / fichier)
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void addFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Choisir des fichiers
            </button>
            {localImages.length > 0 && (
              <p className="mt-3 text-xs text-gray-500">{localImages.length} image(s) chargée(s)</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || localImages.length === 0}
              className="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              {analyzing ? 'Analyse en cours…' : 'Analyser les images'}
            </button>
            {localImages.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Tout effacer
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {localImages.length > 0 && !result && !analyzing && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {localImages.map((img) => (
                <div key={img.id} className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                  <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {analyzing && (
            <p className="text-sm text-gray-600 animate-pulse">
              Analyse vision, détection des doublons et scoring en cours (peut prendre 1–2 min)…
            </p>
          )}

          {result && (
            <>
              {result.heroImageId && imagesById.get(result.heroImageId) && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <strong>Image hero recommandée :</strong>{' '}
                  {imagesById.get(result.heroImageId)!.name} (score{' '}
                  {imagesById.get(result.heroImageId)!.analysis.aesthetic.overall}/10, conformité{' '}
                  {imagesById.get(result.heroImageId)!.analysis.compliance.status})
                </div>
              )}

              <div className="flex gap-2 border-b border-gray-200">
                {(
                  [
                    ['all', 'Toutes'],
                    ['duplicates', `Doublons (${result.duplicateGroups.length})`],
                    ['ranking', 'Classement'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveSection(key)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                      activeSection === key
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeSection === 'all' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {result.images.map((img) => {
                    const url = previewById.get(img.id);
                    if (!url) return null;
                    return (
                      <ImageCard
                        key={img.id}
                        image={img}
                        previewUrl={url}
                        selected={selectedId === img.id}
                        onSelect={() => setSelectedId(img.id)}
                      />
                    );
                  })}
                </div>
              )}

              {activeSection === 'duplicates' && (
                <DuplicateGroupsSection
                  groups={result.duplicateGroups}
                  imagesById={imagesById}
                  previewById={previewById}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}

              {activeSection === 'ranking' && (
                <ol className="space-y-2">
                  {rankedImages.map((img, idx) => {
                    const url = previewById.get(img.id);
                    if (!url) return null;
                    return (
                      <li
                        key={img.id}
                        className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                      >
                        <span className="text-lg font-bold text-gray-400 w-8">{idx + 1}</span>
                        <img
                          src={url}
                          alt=""
                          className="w-16 h-12 object-cover rounded"
                        />
                        <button
                          type="button"
                          className="flex-1 text-left text-sm"
                          onClick={() => setSelectedId(img.id)}
                        >
                          <span className="font-medium">{img.name}</span>
                          <span className="text-gray-500 ml-2">
                            {img.analysis.aesthetic.overall}/10
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
        </div>
      </div>

      {selectedImage && selectedId && previewById.get(selectedId) && (
        <>
          <button
            type="button"
            className="fixed inset-0 bg-black/30 z-40"
            aria-label="Fermer le détail"
            onClick={() => setSelectedId(null)}
          />
          <ImageDetailPanel
            image={selectedImage}
            previewUrl={previewById.get(selectedId)!}
            onClose={() => setSelectedId(null)}
          />
        </>
      )}
    </AppShell>
  );
}
