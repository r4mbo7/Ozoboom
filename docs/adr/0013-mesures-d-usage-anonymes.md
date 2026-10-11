# 0013 - Mesures d'usage anonymes : une partie, un point dans Workers Analytics Engine

- **Statut :** accepté
- **Date :** 2026-10-11

## Contexte

Constantin, le 2026-10-11 : savoir quelle scène, de la Main stage ou du Dome, est la plus jouée, et plus largement suivre des KPI, sans données personnelles. `vision.md` excluait toute collecte au-delà du classement public et du compteur de visites (abacus, `src/app/visits.ts`). Le jeu est statique et sans secret (ADR 0005) ; un compte Cloudflare dédié au jeu porte déjà le Worker `turn` (ADR 0011).

## Décision

- **Permis :** des événements qui décrivent une partie, jamais une personne, pris dans la liste fermée de `brainstorms/2026-10-11-kpi-requirements.md`. Un champ s'ajoute seulement s'il sert un KPI de ce document.
- **Interdit :** cookie, stockage local pour la mesure, identifiant de joueur, d'appareil ou de session, adresse IP ou pays stockés, pseudonyme, texte libre, agent utilisateur, taille d'écran, et tout script de mesure tiers. Sans rien de cela, pas de bandeau de consentement.
- **Envoi :** `navigator.sendBeacon` en texte brut vers `VITE_STATS_URL`, sans réponse attendue ni erreur visible. Seuls l'hôte ou la machine qui joue seule envoient : une partie compte une fois. Rien sans la variable (développement, tests) ni en mode `?dev=`.
- **Collecte :** un Worker `stats` dans `worker/stats/`, sur le compte du jeu et le plan Workers gratuit. `POST /event` vérifie l'origine, limite le débit par IP sans l'écrire, valide l'événement contre la liste fermée et écrit un point dans Workers Analytics Engine (WAE). Aucun secret côté jeu ni côté Worker.
- **Lecture :** `pnpm kpi` interroge l'API SQL de WAE avec un jeton en lecture seule pris dans l'environnement. La rétention de WAE étant de 3 mois, chaque sortie archive le tableau des KPI dans sa pull request.
- **`vision.md` :** « pas de collecte de données personnelles », le jeu compte ses visites et ses parties, anonymement.

## Alternatives écartées

- **Worker et D1 :** gratuit (100 000 lignes écrites par jour) et sans limite de durée, mais un schéma, des migrations et des requêtes qui s'arrêtent au plafond. WAE est fait pour des points sans schéma ; D1 reste le candidat du classement.
- **Ajouter `/event` au Worker `turn` :** un déploiement de moins, mais il mêle un Worker qui garde des secrets et un coupe-circuit à un point d'entrée public sans secret.
- **GoatCounter (hébergé, gratuit pour le non commercial) :** sans cookie, mais un événement n'y est qu'un compteur nommé : ni durée ni palier, les champs deviennent des chemins combinatoires, et les données vivent chez un tiers.
- **Plausible :** sans cookie et avec propriétés, mais aucune offre gratuite (environ 9 $ par mois) ; auto-hébergé, c'est ClickHouse et Postgres à tenir.
- **Umami :** offre Cloud gratuite (Hobby) mais chaque propriété stockée compte dans le quota ; auto-hébergé sur le homelab, une application et une base de plus à exposer et à tenir.
- **Cloudflare Web Analytics :** gratuit et sans cookie, mais des pages vues seulement, sans événement personnalisé : il ne répond pas à la question des scènes.

## Conséquences

Facile : aucun script tiers ni dépendance dans le jeu, une vingtaine de lignes côté client, gratuit, aucune facture possible sur le plan Workers gratuit (100 000 points écrits et 10 000 requêtes lues par jour), et le motif Worker du futur classement posé. Difficile : un deuxième Worker à déployer à la main, des KPI au-delà de 3 mois seulement par les sorties archivées, des parties fermées en cours qui ne disent pas pourquoi, et des événements falsifiables puisque le jeu n'a pas de secret ; la validation et la limite de débit suffisent pour un jeu entre amis. Le quota de requêtes du plan gratuit est partagé avec `turn`. On revient dessus si Cloudflare facture WAE sur le plan gratuit, si un KPI demande plus de 3 mois d'historique brut, ou si des faux événements faussent les chiffres.
