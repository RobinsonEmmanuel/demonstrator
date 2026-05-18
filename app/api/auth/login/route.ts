import { NextRequest, NextResponse } from 'next/server';

const API_URL = 'https://api-prod.regionlovers.ai';

function getApiKey(): string | undefined {
  return process.env.API_REGION_LOVERS?.trim() || undefined;
}

export async function POST(request: NextRequest) {
  const API_KEY = getApiKey();

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      );
    }

    if (!API_KEY) {
      console.error(
        '[api/auth/login] API_REGION_LOVERS est vide ou absente. Créez demonstrator/.env.local avec API_REGION_LOVERS=votre_clé'
      );
      return NextResponse.json(
        {
          error:
            'Configuration serveur : variable API_REGION_LOVERS manquante. Ajoutez-la dans le fichier .env.local à la racine du dossier demonstrator (puis redémarrez npm run dev).',
          code: 'MISSING_API_REGION_LOVERS',
        },
        { status: 500 }
      );
    }

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || 'Échec de la connexion' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[api/auth/login]', error);
    const message =
      error instanceof Error ? error.message : 'Erreur lors de la connexion';
    return NextResponse.json({ error: message, code: 'LOGIN_EXCEPTION' }, { status: 500 });
  }
}
