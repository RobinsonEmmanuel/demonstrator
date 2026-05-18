'use client';

import AppShell from '@/components/AppShell';
import { CircleStackIcon } from '@heroicons/react/24/outline';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function DatabaseFillPage() {
  const ready = useRequireAuth();

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-8">
        <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center mb-6">
          <CircleStackIcon className="w-8 h-8 text-orange-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Remplissage de base de données</h1>
        <p className="text-gray-600 mt-2">
          Espace réservé pour la démonstration d’extraction structurée et d’insertion assistée
          dans une base de données.
        </p>
        <div className="mt-8 p-6 bg-white border border-gray-200 rounded-lg text-sm text-gray-500">
          Contenu et flux à définir dans une prochaine itération.
        </div>
      </div>
    </AppShell>
  );
}
