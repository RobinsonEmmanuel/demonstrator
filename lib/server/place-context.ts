import 'server-only';

import { generateJson } from '@/lib/server/openai-client';

export interface PlaceContext {
  nomPoi: string;
  destination: string;
  clusterName: string;
}

/**
 * Comme redactor-guide : ancrer la vérification sur un POI et une destination nommés.
 */
export async function extractPlaceContext(fullText: string): Promise<PlaceContext> {
  const prompt = `À partir du texte ci-dessous, extrais le lieu principal vérifié (musée, monument, site, établissement) et la destination (ville, île, région, pays).

Réponds UNIQUEMENT en JSON :
{
  "nom_poi": "nom officiel ou usuel du lieu (ex. MuMa, Musée de la Tapisserie…)",
  "destination": "ville ou territoire (ex. Le Havre, Tenerife, Paris)",
  "cluster_name": "sous-zone optionnelle ou chaîne vide"
}

Si plusieurs lieux, choisis celui qui domine le texte. Si inconnu, mets "Lieu non précisé" et "Destination non précisée".

Texte :
${JSON.stringify(fullText)}`;

  try {
    const raw = (await generateJson(prompt, 2000)) as {
      nom_poi?: string;
      destination?: string;
      cluster_name?: string;
    };
    return {
      nomPoi: (raw.nom_poi || 'Lieu').trim(),
      destination: (raw.destination || 'Destination').trim(),
      clusterName: (raw.cluster_name || '').trim(),
    };
  } catch {
    return {
      nomPoi: 'Lieu',
      destination: 'Destination',
      clusterName: '',
    };
  }
}
