/**
 * Client API avec authentification automatique
 */

import { getAccessToken } from './auth';

export interface AuthFetchOptions extends RequestInit {
  credentials?: RequestCredentials;
}

export async function authFetch(url: string, options: AuthFetchOptions = {}): Promise<Response> {
  const token = getAccessToken();

  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const finalOptions: RequestInit = {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  };

  return fetch(url, finalOptions);
}
