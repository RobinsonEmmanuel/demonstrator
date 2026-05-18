import 'server-only';

import type { ExtractedField } from '@/types/fact-check';
import type { PlaceContext } from '@/lib/server/place-context';

/**
 * Prompt aligné redactor-guide : recherche web ouverte + hiérarchie des sources.
 */
export function buildRedactorStylePrompt(
  place: PlaceContext,
  fields: ExtractedField[],
  officialDomains: string[] = [],
  officialPageUrls: string[] = []
): string {
  const clusterContext = place.clusterName ? ` (cluster : ${place.clusterName})` : '';
  const fieldsText = fields
    .map((f) => `- ${f.label} (${f.name}) : "${f.value}"`)
    .join('\n');
  const nomsChamps = fields.map((f) => `"${f.name}"`).join(', ');

  const officialHint =
    officialDomains.length > 0
      ? `\nSites repérés pour **${place.nomPoi}** (à consulter en premier, puis élargir si besoin) : ${officialDomains.join(', ')}.\n`
      : '';

  const pageUrlsHint =
    officialPageUrls.length > 0
      ? `\nPages utiles déjà identifiées :\n${officialPageUrls.map((u) => `- ${u}`).join('\n')}\n`
      : '';

  const template = `Tu es un fact-checker expert en tourisme international.

Vérifie chaque information sur "{{NOM_POI}}"{{CLUSTER_CONTEXT}} ({{DESTINATION}}) via une **recherche web large** (comme redactor-guide).

Le lieu à vérifier est **{{NOM_POI}}** à **{{DESTINATION}}**.
{{OFFICIAL_DOMAINS_HINT}}{{OFFICIAL_PAGE_URLS_HINT}}

⚠️ Ne pas utiliser canarias-lovers.com comme source.

====================
PHILOSOPHIE DE VÉRIFICATION (IMPORTANT)
====================

- Tu n'es **pas** limité au site officiel du musée. Une info peut être **validée** par l'OT, la métropole, un guide touristique reconnu, la presse, ou le site de l'établissement.
- Le site officiel est la **meilleure** source quand elle existe, mais l'absence d'une phrase sur le site du musée **ne suffit pas** pour marquer **invalid**.
- Mets **invalid** seulement si une source fiable **contredit** l'info ou si tu es certain qu'elle est fausse.
- Mets **uncertain** si tu n'as rien trouvé après avoir cherché (site musée + OT + guides + presse).
- Les infos **pratiques** (transports, parking, durée de visite, boutique, café, consignes photo) sont souvent sur l'OT, la métropole ou un guide : cherche-les là et valide avec \`source_type\` **institutional** ou **commercial**, pas seulement **official**.

====================
RÈGLES DE SOURCING
====================

Effectue **plusieurs recherches** par champ (site établissement, office de tourisme, guide, presse locale).

Hiérarchie (toutes peuvent **valider** un fait) :
1. Site officiel de l'établissement → source_type **official**
2. OT, métropole, mairie, région → **institutional**
3. Presse / guides majeurs (Lonely Planet, Petit Futé, etc.) → **media_high** ou **commercial**
4. Médias locaux → **media_local**
5. Blogs spécialisés tourisme → **commercial**

**Interdit seul** : avis TripAdvisor, forums, Wikipedia seule, datatourisme.fr, untourism.int, SEO.

**Diversité** : une URL / source_ref **par point** quand les pages diffèrent. Ne recycle pas la home du musée pour tout.

**Collections / artistes** : pour les noms d'artistes et collections permanentes, privilégie le site du musée ; les OT peuvent compléter.

====================
CHAMPS À VÉRIFIER
====================
{{CHAMPS_A_VERIFIER}}

====================
RÈGLES PAR TYPE
====================

**Tarifs** : page tarifs musée ou billetterie en priorité ; OT acceptable pour vue d'ensemble. Montants : recopie exacte dans correction.

**Horaires, accès, accessibilité** : musée, OT ou métropole.

**Transports, parking, durée, services, photo** : très souvent sur OT / guide / métropole — **valide** si confirmé là (pas besoin du site musée).

**Descriptions / listes** : décompose en points atomiques ; chaque point avec sa propre source.

====================
STATUTS ET POINTS
====================

Pour chaque champ :
1. Décompose la value en faits courts.
2. **validated_points** : faits confirmés (source_ref, source_type, source_url si possible).
3. **invalid_points** : uniquement faits **contredits** ou manifestement faux — pas « absent du site musée ».
4. **status** :
   - **valid** : tous les faits confirmés (par n'importe quelle source fiable ci-dessus)
   - **invalid** : au moins un fait contredit
   - **uncertain** : non trouvé ou partiellement trouvé — **pas invalid par défaut**

====================
FORMAT JSON
====================

{
  "results": [
    {
      "field": "transports",
      "label": "Transports",
      "value": "…",
      "status": "valid|invalid|uncertain",
      "validated_points": [
        { "point": "…", "source_ref": 1, "source_type": "institutional", "source_url": "https://…" }
      ],
      "invalid_points": [],
      "comment": "…"
    }
  ]
}

Noms de champs : {{NOMS_CHAMPS}}`;

  return template
    .replace(/\{\{NOM_POI\}\}/g, place.nomPoi)
    .replace(/\{\{CLUSTER_CONTEXT\}\}/g, clusterContext)
    .replace(/\{\{DESTINATION\}\}/g, place.destination)
    .replace(/\{\{OFFICIAL_DOMAINS_HINT\}\}/g, officialHint)
    .replace(/\{\{OFFICIAL_PAGE_URLS_HINT\}\}/g, pageUrlsHint)
    .replace(/\{\{CHAMPS_A_VERIFIER\}\}/g, fieldsText)
    .replace(/\{\{NOMS_CHAMPS\}\}/g, nomsChamps);
}
