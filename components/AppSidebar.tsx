'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  HomeIcon,
  ShieldCheckIcon,
  PhotoIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';
import { getCurrentUser, logout } from '@/lib/auth';

const menuItems = [
  { name: 'Accueil', icon: HomeIcon, href: '/' },
  { name: 'Fact checking', icon: ShieldCheckIcon, href: '/tools/fact-checking' },
  { name: 'Classification images', icon: PhotoIcon, href: '/tools/image-classification' },
  { name: 'Remplissage BDD', icon: CircleStackIcon, href: '/tools/database-fill' },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="w-52 bg-[#1e293b] text-white flex flex-col shrink-0">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center font-bold text-lg">
            D
          </div>
          <div>
            <h1 className="font-semibold text-sm">Demonstrateur IA</h1>
            <p className="text-xs text-slate-400">Region Lovers</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{item.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <UserInfo />
      </div>
    </aside>
  );
}

function UserInfo() {
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const handleLogout = () => {
    logout();
  };

  if (!user) return null;

  const initials =
    user.email?.split('@')[0]?.substring(0, 2)?.toUpperCase() ?? 'RL';

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-xs font-semibold">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{user.email}</p>
          <p className="text-xs text-slate-400 capitalize">{user.role}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors"
      >
        Déconnexion
      </button>
    </div>
  );
}
