import 'server-only';

import type { NextRequest } from 'next/server';

/** Décodage minimal JWT (payload) — aligné sur middleware.ts (sans vérif HMAC). */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf8')
    );
    return payload;
  } catch {
    return null;
  }
}

export function getAccessTokenFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() || null;
  return request.cookies.get('accessToken')?.value ?? null;
}

export function requireAuth(request: NextRequest): void {
  const token = getAccessTokenFromRequest(request);
  if (!token) {
    const e = new Error('UNAUTHORIZED');
    (e as any).status = 401;
    throw e;
  }
  const payload = decodeJwtPayload(token);
  if (!payload?.exp || Date.now() >= payload.exp * 1000) {
    const e = new Error('UNAUTHORIZED');
    (e as any).status = 401;
    throw e;
  }
}
