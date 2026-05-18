'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useRequireAuth } from '@/lib/use-require-auth';
import { authFetch } from '@/lib/api-client';
import { HighlightedAssistantResponse } from '@/components/fact-check/HighlightedAssistantResponse';
import { ConsultedSourcesPanel } from '@/components/fact-check/ConsultedSourcesPanel';
import { FieldValidationList } from '@/components/fact-check/FieldValidationList';
import type { FactCheckAnalyzeResponse } from '@/types/fact-check';

export default function FactCheckingPage() {
  const ready = useRequireAuth();
  const [userPrompt, setUserPrompt] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [analysis, setAnalysis] = useState<FactCheckAnalyzeResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [factChecking, setFactChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setAnalysis(null);
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

  const handleFactCheck = async () => {
    setError(null);
    if (!assistantText.trim()) {
      setError('Aucune réponse à analyser.');
      return;
    }
    setFactChecking(true);
    setAnalysis(null);
    try {
      const res = await authFetch('/api/tools/fact-check/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantText }),
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

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-8 pb-16">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
            <ShieldCheckIcon className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fact checking</h1>
            <p className="text-gray-600 mt-1">
              Prompt → OpenAI → découpage en <strong>champs</strong> (tarif, horaires, accès…) →
              validation Perplexity champ par champ, comme sur redactor-guide.
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
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {assistantText && (
            <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">Réponse du modèle</span>
                <button
                  type="button"
                  onClick={handleFactCheck}
                  disabled={factChecking}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {factChecking ? 'Validation…' : 'Valider par champs'}
                </button>
              </div>
              <div className="p-4">
                {!analysis && (
                  <div className="whitespace-pre-wrap break-words text-sm text-gray-900 leading-relaxed">
                    {assistantText}
                  </div>
                )}
                {analysis && analysis.extractedCount === 0 && (
                  <p className="text-sm text-amber-800">
                    Aucun champ vérifiable n’a été extrait. Reformulez avec des infos factuelles
                    (tarifs, horaires, accès…).
                  </p>
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
                  <>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">
                      Champs extraits ({analysis.fields.length})
                    </h3>
                    <FieldValidationList
                      fields={analysis.fields}
                      verificationById={analysis.verificationById}
                    />
                  </>
                )}
                {analysis && analysis.placedCount > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2 mt-2">
                      Texte source (surlignage)
                    </h3>
                    <HighlightedAssistantResponse
                      text={assistantText}
                      spans={analysis.spans}
                      verificationById={analysis.verificationById}
                    />
                  </>
                )}
                {analysis &&
                  analysis.extractedCount > 0 &&
                  analysis.placedCount === 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-amber-800 border-l-2 border-amber-400 pl-2 mb-3">
                        Champs validés ci-dessus, mais pas de surlignage possible dans le texte.
                      </p>
                      <div className="whitespace-pre-wrap break-words text-sm text-gray-900 leading-relaxed opacity-80">
                        {assistantText}
                      </div>
                    </div>
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
            Cliquez sur un champ pour le détail. Vert = confirmé, orange = incertain, rouge = contredit.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
