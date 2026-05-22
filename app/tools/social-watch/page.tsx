'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { MegaphoneIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { useRequireAuth } from '@/lib/use-require-auth';
import { authFetch } from '@/lib/api-client';
import type {
  SitDbUpdateSuggestion,
  SocialAccount,
  SocialAccountsResponse,
  SocialAnalyzeResponse,
  SocialPost,
  SocialPostPick,
  SocialScrapeResponse,
  SocialWatchFilterMode,
} from '@/types/social-watch';

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  twitter: 'X / Twitter',
};

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

/** Affichage lisible des valeurs JSON longues (listes, objets SIT). */
function formatFieldValueDisplay(raw: string): string {
  const t = raw.trim();
  if ((t.startsWith('[') || t.startsWith('{')) && t.length > 1) {
    try {
      return JSON.stringify(JSON.parse(t), null, 2);
    } catch {
      /* texte brut */
    }
  }
  return raw;
}

function FieldValueBox({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: 'current' | 'suggested';
}) {
  const display = formatFieldValueDisplay(value);
  const isSuggested = variant === 'suggested';

  return (
    <div
      className={`min-w-0 rounded-md border p-3 ${
        isSuggested
          ? 'border-violet-300 bg-violet-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <p
        className={`text-xs font-medium mb-2 ${
          isSuggested ? 'text-violet-800' : 'text-gray-500'
        }`}
      >
        {label}
      </p>
      <div className="max-h-56 overflow-auto rounded border border-gray-100/80 bg-white/60 p-2">
        <pre className="text-xs leading-relaxed text-gray-900 whitespace-pre-wrap break-words font-mono">
          {display}
        </pre>
      </div>
      {isSuggested && (
        <div className="mt-2">
          <CopyButton text={value} />
        </div>
      )}
    </div>
  );
}

function PostSourceDetails({ post }: { post: SocialPost }) {
  return (
    <details className="mt-3 rounded-md border border-gray-200 bg-gray-50/90">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100/80 list-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="text-[10px] text-gray-400" aria-hidden>
            ▶
          </span>
          Post source
        </span>
      </summary>
      <div className="border-t border-gray-200 px-3 py-3 space-y-2">
        {post.poiName && (
          <p className="text-sm font-semibold text-gray-900">{post.poiName}</p>
        )}
        <p className="text-xs text-gray-500">{formatDate(post.publishedAt)}</p>
        {(post.likes != null || post.comments != null) && (
          <p className="text-xs text-gray-500">
            {post.likes != null && <span>{post.likes} j&apos;aime</span>}
            {post.comments != null && (
              <span className="ml-2">{post.comments} commentaires</span>
            )}
          </p>
        )}
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
          {post.text || '(sans texte)'}
        </p>
        {post.postUrl ? (
          <a
            href={post.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline"
          >
            Voir le post en ligne →
          </a>
        ) : (
          <p className="text-xs text-gray-400">Lien du post non disponible.</p>
        )}
      </div>
    </details>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
    >
      <ClipboardDocumentIcon className="h-3.5 w-3.5" />
      {copied ? 'Copié' : 'Copier'}
    </button>
  );
}

function StepBadge({
  n,
  label,
  done,
  active,
}: {
  n: number;
  label: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done
            ? 'bg-emerald-600 text-white'
            : active
              ? 'bg-orange-500 text-white'
              : 'bg-gray-200 text-gray-600'
        }`}
      >
        {done ? '✓' : n}
      </span>
      <span
        className={`text-sm font-medium ${active ? 'text-gray-900' : 'text-gray-500'}`}
      >
        {label}
      </span>
    </div>
  );
}

function PostCard({ post }: { post: SocialPost }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {post.poiName ?? 'Page Facebook'}
          </p>
          <p className="text-xs text-gray-500">{formatDate(post.publishedAt)}</p>
        </div>
        {(post.likes != null || post.comments != null) && (
          <p className="text-xs text-gray-500">
            {post.likes != null && <span>{post.likes} j&apos;aime</span>}
            {post.comments != null && (
              <span className="ml-2">{post.comments} commentaires</span>
            )}
          </p>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap line-clamp-6">
        {post.text || '(sans texte)'}
      </p>
      {post.postUrl && (
        <a
          href={post.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-orange-600 hover:underline"
        >
          Voir le post
        </a>
      )}
    </article>
  );
}

function DbUpdateCard({
  update,
  post,
}: {
  update: SitDbUpdateSuggestion;
  post?: SocialPost;
}) {
  return (
    <article className="rounded-lg border border-violet-200 bg-violet-50/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{update.poiName}</span>
        <span className="font-mono text-[11px] text-violet-700">
          {update.blockId} → {update.sectionId} → {update.fieldId}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-700">{update.justification}</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <FieldValueBox
          label="Valeur actuelle (BDD)"
          value={update.currentValue}
          variant="current"
        />
        <FieldValueBox
          label="Valeur suggérée"
          value={update.suggestedValue}
          variant="suggested"
        />
      </div>
      {post && <PostSourceDetails post={post} />}
    </article>
  );
}

function PickCard({
  pick,
  post,
}: {
  pick: SocialPostPick;
  post?: SocialPost;
}) {
  return (
    <article className="rounded-lg border border-orange-200 bg-orange-50/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            pick.reaction === 'comment'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-700 text-white'
          }`}
        >
          {pick.reaction === 'comment' ? 'Commenter' : 'Aimer'}
        </span>
        {post?.poiName && (
          <span className="text-sm font-medium text-gray-900">{post.poiName}</span>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-800">{pick.justification}</p>
      {pick.reaction === 'comment' && pick.suggestedComment && (
        <div className="mt-3 rounded-md border border-orange-200 bg-white p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">
            Commentaire proposé (Facebook)
          </p>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">
            {pick.suggestedComment}
          </p>
          <div className="mt-2">
            <CopyButton text={pick.suggestedComment} />
          </div>
        </div>
      )}
      {post && <PostSourceDetails post={post} />}
    </article>
  );
}

export default function SocialWatchPage() {
  const ready = useRequireAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [clusterId, setClusterId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<SocialWatchFilterMode>('demo');
  const [poiFilter, setPoiFilter] = useState<string[] | undefined>();
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedMeta, setScrapedMeta] = useState<{
    at: string;
    pages: number;
  } | null>(null);

  const [analysis, setAnalysis] = useState<SocialAnalyzeResponse | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const facebookAccounts = accounts.filter((a) => a.platform === 'facebook');
  const step1Done = accounts.length > 0 && !accountsLoading;
  const step2Done = posts.length > 0;
  const step3Done = analysis != null;
  const step4Done = (analysis?.dbUpdates.length ?? 0) > 0;
  const analysisRan = analysis != null;

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const res = await authFetch('/api/tools/social-watch/accounts');
      const data = (await res.json()) as SocialAccountsResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Impossible de charger les comptes');
      setAccounts(data.accounts);
      setClusterId(data.clusterId);
      setFilterMode(data.filterMode ?? 'demo');
      setPoiFilter(data.poiFilter);
    } catch (e) {
      setAccounts([]);
      setAccountsError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void loadAccounts();
  }, [ready, loadAccounts]);

  const handleScrape = async () => {
    setScrapeLoading(true);
    setScrapeError(null);
    setAnalysis(null);
    try {
      const res = await authFetch('/api/tools/social-watch/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as SocialScrapeResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Échec de la collecte');
      setPosts(data.posts);
      setScrapedMeta({ at: data.scrapedAt, pages: data.facebookPagesScraped });
    } catch (e) {
      setPosts([]);
      setScrapeError(e instanceof Error ? e.message : 'Erreur collecte');
    } finally {
      setScrapeLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzeLoading(true);
    setAnalyzeError(null);
    try {
      const res = await authFetch('/api/tools/social-watch/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts }),
      });
      const data = (await res.json()) as SocialAnalyzeResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Échec de l’analyse');
      setAnalysis(data);
    } catch (e) {
      setAnalysis(null);
      setAnalyzeError(e instanceof Error ? e.message : 'Erreur analyse');
    } finally {
      setAnalyzeLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Chargement…</p>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-6 md:p-8">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg bg-orange-100">
          <MegaphoneIcon className="h-8 w-8 text-orange-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Veille réseaux sociaux</h1>
        <p className="mt-2 text-gray-600 max-w-2xl">
          En tant qu&apos;office de tourisme, identifiez les publications Facebook de vos
          membres (7 derniers jours), puis laissez l&apos;IA sélectionner les posts les plus
          pertinents à valoriser avec un like ou un commentaire prêt à publier.
        </p>

        {filterMode !== 'all' && poiFilter && poiFilter.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">
              {filterMode === 'demo' ? 'Mode démo' : 'Filtre actif'} —{' '}
              {poiFilter.length} établissement{poiFilter.length > 1 ? 's' : ''}
            </p>
            <ul className="mt-1 space-y-0.5 font-mono text-xs text-amber-900/90">
              {poiFilter.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-800">
              Pour tout le cluster :{' '}
              <code className="rounded bg-amber-100/80 px-1">
                SOCIAL_WATCH_POI_IDS=all
              </code>{' '}
              dans <code className="rounded bg-amber-100/80 px-1">.env.local</code>
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-8 border-b border-gray-200 pb-6">
          <StepBadge n={1} label="Comptes SIT" done={step1Done} active={!step1Done} />
          <StepBadge n={2} label="Collecte posts" done={step2Done} active={step1Done && !step2Done} />
          <StepBadge n={3} label="Engagement IA" done={step3Done} active={step2Done && !step3Done} />
          <StepBadge
            n={4}
            label="Mises à jour BDD"
            done={step4Done}
            active={step3Done && !step4Done}
          />
        </div>

        {accountsError && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {accountsError}
          </p>
        )}

        {/* Étape 1 */}
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            1. Comptes réseaux sociaux du cluster
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Extraction depuis le bloc SIT{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">online_presence</code>
            {clusterId && (
              <span className="text-gray-400"> — cluster {clusterId}</span>
            )}
          </p>

          {accountsLoading ? (
            <p className="mt-4 text-sm text-gray-500">Chargement des comptes…</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-gray-700">
                <strong>{accounts.length}</strong> lien{accounts.length > 1 ? 's' : ''}{' '}
                trouvé{accounts.length > 1 ? 's' : ''},{' '}
                <strong>{facebookAccounts.length}</strong> page
                {facebookAccounts.length > 1 ? 's' : ''} Facebook pour la collecte.
              </p>
              <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Lieu</th>
                      <th className="px-3 py-2">Réseau</th>
                      <th className="px-3 py-2">URL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {accounts.map((a) => (
                      <tr key={`${a.poiId}-${a.platform}`} className="hover:bg-gray-50/80">
                        <td className="px-3 py-2 font-medium text-gray-900">{a.poiName}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {PLATFORM_LABEL[a.platform] ?? a.platform}
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-600 hover:underline truncate block max-w-xs"
                          >
                            {a.url.replace(/^https?:\/\//, '')}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Étape 2 */}
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                2. Posts Facebook (7 derniers jours)
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Collecte via Apify — max. 5 posts par page, tri chronologique.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleScrape()}
              disabled={scrapeLoading || facebookAccounts.length === 0}
              className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {scrapeLoading ? 'Collecte en cours…' : 'Lancer la collecte'}
            </button>
          </div>

          {scrapeError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {scrapeError}
            </p>
          )}

          {scrapedMeta && (
            <p className="mt-3 text-xs text-gray-500">
              {posts.length} post{posts.length > 1 ? 's' : ''} —{' '}
              {scrapedMeta.pages} page{scrapedMeta.pages > 1 ? 's' : ''} —{' '}
              {formatDate(scrapedMeta.at)}
            </p>
          )}

          {posts.length > 0 && (
            <div className="mt-4 space-y-3 max-h-[min(50vh,480px)] overflow-y-auto">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>

        {/* Étape 3 */}
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                3. Posts à engager (IA)
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Jusqu&apos;à 10 publications recommandées — like ou commentaire, et détection
                des mises à jour du référentiel SIT.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={analyzeLoading || posts.length === 0}
              className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {analyzeLoading ? 'Analyse…' : 'Analyser avec l’IA'}
            </button>
          </div>

          {analyzeError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {analyzeError}
            </p>
          )}

          {analysis && analysis.picks.length > 0 && (
            <div className="mt-4 space-y-3">
              {analysis.picks.map((pick) => (
                <PickCard
                  key={pick.postId}
                  pick={pick}
                  post={analysis.postsById[pick.postId]}
                />
              ))}
            </div>
          )}

          {analysisRan && analysis.picks.length === 0 && !analyzeLoading && (
            <p className="mt-3 text-sm text-gray-500">
              Aucune recommandation d&apos;engagement.
            </p>
          )}
        </section>

        {/* Étape 4 */}
        {analysisRan && (
          <section className="mt-6 rounded-xl border border-violet-200 bg-white p-5 mb-8">
            <h2 className="text-lg font-semibold text-gray-900">
              4. Informations à mettre à jour dans la base de données
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Tous les champs SIT concernés par les posts analysés (autant que nécessaire,
              jusqu&apos;à 15 suggestions par analyse) — valeurs actuelles vs propositions.
            </p>

            {analysis!.dbUpdates.length > 0 ? (
              <div className="mt-4 space-y-3">
                {analysis!.dbUpdates.map((update) => (
                  <DbUpdateCard
                    key={`${update.poiId}-${update.blockId}-${update.sectionId}-${update.fieldId}`}
                    update={update}
                    post={analysis!.postsById[update.postId]}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Aucune mise à jour de la base de données détectée dans les posts analysés.
              </p>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
