'use client';

import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { useRequireAuth } from '@/lib/use-require-auth';
import {
  ShieldCheckIcon,
  PhotoIcon,
  CircleStackIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const tools = [
  {
    href: '/tools/fact-checking',
    title: 'Fact checking',
    description:
      'Vérifier des affirmations et sources à l’aide de l’IA — démonstration à venir.',
    icon: ShieldCheckIcon,
  },
  {
    href: '/tools/image-classification',
    title: 'Classification d’images',
    description:
      'Étiquetage et tri automatique de visuels — démonstration à venir.',
    icon: PhotoIcon,
  },
  {
    href: '/tools/database-fill',
    title: 'Remplissage de base de données',
    description:
      'Extraction structurée et insertion assistée — démonstration à venir.',
    icon: CircleStackIcon,
  },
];

export default function HomePage() {
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
      <div className="max-w-5xl mx-auto p-8">
        <header className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900">Demonstrateur IA</h1>
          <p className="text-gray-600 mt-2">
            Trois parcours pour illustrer les capacités de l’IA sur vos cas d’usage.
          </p>
        </header>

        <ul className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <li key={tool.href}>
                <Link
                  href={tool.href}
                  className="block h-full bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:border-orange-300 hover:shadow transition-all group"
                >
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
                    <Icon className="w-7 h-7 text-orange-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">{tool.title}</h2>
                  <p className="text-sm text-gray-600 mb-4">{tool.description}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-orange-600">
                    Ouvrir
                    <ArrowRightIcon className="w-4 h-4" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
