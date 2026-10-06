import 'server-only';

import type { SocialAccount } from '@/types/social-watch';

/**
 * Démo Deauville — comptes issus de DEA_04_reseaux-sociaux-partenaires_2026-10-06.csv
 * (rapprochement manuel POI ↔ fiche partenaire). Remplace l'extraction SIT tant que
 * SOCIAL_WATCH_SOURCE n'est pas défini à `sit` dans .env.local.
 */
const DEMO_POIS = [
  {
    poiId: 'museum_75d65668-8b0f-4c0e-b9d2-ce27404bc078',
    poiName: 'Centre Culturel Les Franciscaines',
    facebook: 'https://www.facebook.com/franciscaines.deauville',
    instagram: 'https://www.instagram.com/franciscaines.deauville',
  },
  {
    poiId: 'museum_2d5d06b9-79c7-4ca9-a011-6cd6b75f63ea',
    poiName: 'Musée Paléospace',
    facebook: 'https://www.facebook.com/p/Pal%C3%A9ospace-100057487088671',
    instagram: null,
  },
  {
    poiId: 'casino_4ba6ee6b-dec1-40c6-b630-7d22259c853e',
    poiName: 'Casino Barrière de Deauville',
    facebook: 'https://www.facebook.com/casinobarrieredeauville',
    instagram: 'https://www.instagram.com/casinodeauville.barriere',
  },
] as const;

export const SOCIAL_WATCH_DEMO_CLUSTER_ID = 'deauville-demo';

export function useDemoSocialAccounts(): boolean {
  return process.env.SOCIAL_WATCH_SOURCE?.trim().toLowerCase() !== 'sit';
}

export function getDemoSocialPoiIds(): string[] {
  return DEMO_POIS.map((p) => p.poiId);
}

export function getDemoSocialAccounts(): SocialAccount[] {
  const accounts: SocialAccount[] = [];
  for (const p of DEMO_POIS) {
    if (p.facebook) {
      accounts.push({ poiId: p.poiId, poiName: p.poiName, platform: 'facebook', url: p.facebook });
    }
    if (p.instagram) {
      accounts.push({ poiId: p.poiId, poiName: p.poiName, platform: 'instagram', url: p.instagram });
    }
  }
  return accounts;
}
