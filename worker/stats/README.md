# Worker stats

Reçoit le `start` et le `end` de chaque partie et les écrit, anonymes, dans Workers Analytics Engine ([ADR 0013](../../docs/adr/0013-mesures-d-usage-anonymes.md)).

`POST /event`, corps `text/plain` : un `GameEvent` en JSON (`src/shared/stats.ts`). Répond 204, 400 (événement invalide), 403 (origine ni `https://r4mbo7.github.io` ni `http://localhost`), 404 ou 429 (plus de 10 requêtes par minute et par IP, jamais écrite).

1. Le jeu de données `ozoboom_games` et la limite de débit sont dans `wrangler.toml` ; Analytics Engine crée le jeu de données à la première écriture. Aucun secret.
2. Déployer : `wrangler deploy`, depuis ce dossier. Le point d'entrée est alors `https://ozoboom-stats.cozi272022.workers.dev/event`.
3. Créer la variable de dépôt `STATS_URL` : `https://ozoboom-stats.cozi272022.workers.dev`, sans `/event` que le jeu ajoute. La CI la passe en `VITE_STATS_URL` à la seule construction déployée.
