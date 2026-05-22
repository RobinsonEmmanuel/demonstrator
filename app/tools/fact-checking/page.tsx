'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useRequireAuth } from '@/lib/use-require-auth';
import { authFetch } from '@/lib/api-client';
import { HighlightedAssistantResponse } from '@/components/fact-check/HighlightedAssistantResponse';
import { ConsultedSourcesPanel } from '@/components/fact-check/ConsultedSourcesPanel';
import { FieldValidationList } from '@/components/fact-check/FieldValidationList';
import { SitConnectionModal } from '@/components/fact-check/SitConnectionModal';
import { FactCheckLevelLegend } from '@/components/fact-check/FactCheckLevelLegend';
import type { FactCheckAnalyzeResponse } from '@/types/fact-check';
import type { SitPoiOption } from '@/types/sit';

export default function FactCheckingPage() {
  const ready = useRequireAuth();
  const [userPrompt, setUserPrompt] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [databaseJson, setDatabaseJson] = useState('');
  const [sitPoiId, setSitPoiId] = useState<string | null>(null);
  const [sitModalOpen, setSitModalOpen] = useState(false);
  const [analysis, setAnalysis] = useState<FactCheckAnalyzeResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [factChecking, setFactChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poiOptions, setPoiOptions] = useState<SitPoiOption[]>([]);
  const [poiListLoading, setPoiListLoading] = useState(false);
  const [poiListError, setPoiListError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    setPoiListLoading(true);
    setPoiListError(null);

    void (async () => {
      try {
        const res = await authFetch('/api/tools/fact-check/sit-cluster-drafts');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Impossible de charger la liste des POI');
        }
        if (!cancelled) {
          setPoiOptions(Array.isArray(data.items) ? data.items : []);
        }
      } catch (e) {
        if (!cancelled) {
          setPoiOptions([]);
          setPoiListError(e instanceof Error ? e.message : 'Erreur liste POI');
        }
      } finally {
        if (!cancelled) setPoiListLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready]);

  const fieldNumberById =
    analysis?.fields.reduce<Record<string, number>>((acc, field, index) => {
      acc[field.id] = index + 1;
      return acc;
    }, {}) ?? {};

  const handleGenerate = async () => {
    setError(null);
    setAnalysis(null);
    setDatabaseJson('');
    setSitPoiId(null);
    if (!userPrompt.trim()) {
      setError('Saisissez un prompt.');
      return;
    }
    setGenerating(true);
    try {
      const res = await authFetch('/api/tools/fact-check/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Échec de la génération');
      }
      setAssistantText(typeof data.content === 'string' ? data.content : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setGenerating(false);
    }
  };

  const runFactCheck = async (dbJson?: string) => {
    setError(null);
    if (!assistantText.trim()) {
      setError('Aucune réponse à analyser.');
      return;
    }

    setFactChecking(true);
    setAnalysis(null);
    try {
      const body: { assistantText: string; databaseJson?: string } = {
        assistantText,
      };
      const json = (dbJson ?? databaseJson).trim();
      if (json) {
        body.databaseJson = json;
      }

      const res = await authFetch('/api/tools/fact-check/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Échec du fact checking');
      }
      setAnalysis(data as FactCheckAnalyzeResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setFactChecking(false);
    }
  };

  const handleValidateClick = () => {
    setError(null);
    if (!assistantText.trim()) {
      setError('Aucune réponse à analyser.');
      return;
    }
    setSitModalOpen(true);
  };

  const handleSitConfirm = (json: string, poiId: string | null) => {
    setDatabaseJson(json);
    setSitPoiId(poiId);
    setSitModalOpen(false);
    void runFactCheck(json);
  };

  const handleWebOnly = () => {
    setDatabaseJson('');
    setSitPoiId(null);
    void runFactCheck('');
  };

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
            <ShieldCheckIcon className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fact checking</h1>
            <p className="text-gray-600 mt-1">
              Générez une réponse, puis validez avec le référentiel SIT (niveau 1) et les sources
              web Perplexity (niveau 2).
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Votre prompt</label>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              placeholder="Ex. Rédige les infos pratiques du MuMa au Havre : tarifs, horaires, accessibilité…"
              disabled={generating}
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !userPrompt.trim()}
              className="mt-3 px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              {generating ? 'Génération…' : 'Générer la réponse'}
            </button>
            {poiListLoading && (
              <p className="mt-2 text-xs text-gray-500">Chargement de la liste des POI SIT…</p>
            )}
            {!poiListLoading && poiListError && (
              <p className="mt-2 text-xs text-amber-800">
                Liste POI indisponible : {poiListError}
              </p>
            )}
            {!poiListLoading && !poiListError && poiOptions.length > 0 && (
              <p className="mt-2 text-xs text-emerald-700">
                {poiOptions.length} POI prêts pour la connexion SIT.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {assistantText && (
            <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">Réponse du modèle</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleValidateClick}
                    disabled={factChecking}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
                  >
                    {factChecking ? 'Validation…' : 'Valider (BDD + Web)'}
                  </button>
                  <button
                    type="button"
                    onClick={handleWebOnly}
                    disabled={factChecking}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Web uniquement
                  </button>
                </div>
              </div>
              <div className="p-4">
                {!analysis && (
                  <div className="whitespace-pre-wrap break-words text-sm text-gray-900 leading-relaxed">
                    {assistantText}
                  </div>
                )}
                {analysis && sitPoiId && analysis.hasDatabaseCheck && (
                  <p className="mb-3 text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 font-mono">
                    Référentiel SIT : {sitPoiId}
                  </p>
                )}
                {analysis && analysis.extractedCount === 0 && (
                  <p className="text-sm text-amber-800">
                    Aucun champ vérifiable n’a été extrait. Reformulez avec des infos factuelles
                    (tarifs, horaires, accès…).
                  </p>
                )}
                {analysis?.databaseJsonError && (
                  <p className="mb-3 text-sm text-red-800 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    Base de données : {analysis.databaseJsonError} — seul le niveau web a été
                    exécuté.
                  </p>
                )}
                {analysis && (
                  <div className="mb-4">
                    <FactCheckLevelLegend hasDatabaseCheck={!!analysis.hasDatabaseCheck} />
                  </div>
                )}
                {analysis &&
                  (analysis.consulted_sources?.length ?? 0) > 0 && (
                    <ConsultedSourcesPanel sources={analysis.consulted_sources} />
                  )}
                {analysis?.place && (
                  <p className="mb-3 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                    Lieu : <strong>{analysis.place.nomPoi}</strong>
                    {analysis.place.clusterName ? ` (${analysis.place.clusterName})` : ''} —{' '}
                    <strong>{analysis.place.destination}</strong>
                  </p>
                )}
                {analysis && analysis.fields.length > 0 && (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
                    <section className="rounded-lg border border-gray-200 bg-white p-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">Texte source</h3>
                      {analysis.placedCount > 0 ? (
                        <HighlightedAssistantResponse
                          text={assistantText}
                          spans={analysis.spans}
                          verificationById={analysis.verificationById}
                          databaseVerificationById={analysis.databaseVerificationById}
                          hasDatabaseCheck={!!analysis.hasDatabaseCheck}
                          fieldNumberById={fieldNumberById}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap break-words text-sm text-gray-900 leading-relaxed opacity-80">
                          {assistantText}
                        </div>
                      )}
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-gray-800">
                          Points contrôlés ({analysis.fields.length})
                        </h3>
                        <span className="text-xs text-slate-500">Numéros liés au texte</span>
                      </div>
                      <FieldValidationList
                        fields={analysis.fields}
                        verificationById={analysis.verificationById}
                        databaseVerificationById={analysis.databaseVerificationById}
                        hasDatabaseCheck={!!analysis.hasDatabaseCheck}
                        fieldNumberById={fieldNumberById}
                      />
                    </section>
                  </div>
                )}
                {analysis &&
                  analysis.extractedCount > 0 &&
                  analysis.placedCount === 0 && (
                    <p className="mt-3 text-sm text-amber-800 border-l-2 border-amber-400 pl-2">
                      Champs validés ci-dessus, mais pas de surlignage possible dans le texte.
                    </p>
                  )}
                {analysis && analysis.unplacedIds.length > 0 && analysis.placedCount > 0 && (
                  <p className="mt-3 text-xs text-amber-700">
                    {analysis.unplacedIds.length} champ(s) non relié(s) au surlignage.
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Cliquez sur <strong>Valider (BDD + Web)</strong> pour ouvrir la connexion SIT, puis
            lancer les deux niveaux. <strong>Web uniquement</strong> saute le référentiel. Pastilles{' '}
            <strong>BDD</strong> / <strong>Web</strong> par champ.
          </p>
        </div>
      </div>

      <SitConnectionModal
        open={sitModalOpen}
        onClose={() => setSitModalOpen(false)}
        onConfirm={handleSitConfirm}
        initialPoiId={sitPoiId ?? undefined}
        initialJson={databaseJson || undefined}
        confirmLabel="Lancer la validation (BDD + Web)"
        poiOptions={poiOptions}
        poiListLoading={poiListLoading}
        poiListError={poiListError}
      />
    </AppShell>
  );
}
