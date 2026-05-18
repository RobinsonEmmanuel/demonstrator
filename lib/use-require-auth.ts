'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

/**
 * Synchronise le JWT localStorage → cookie (middleware) et redirige si non connecté.
 */
export function useRequireAuth() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    const token = localStorage.getItem('accessToken');
    if (token) {
      document.cookie = `accessToken=${token}; path=/; max-age=86400`;
    }
    setReady(true);
  }, [router]);

  return ready;
}
