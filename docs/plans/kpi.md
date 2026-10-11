# Plan KPI d'usage

Découpage de [2026-10-11-kpi-requirements.md](../brainstorms/2026-10-11-kpi-requirements.md) en issues du jalon [KPI d'usage](https://github.com/r4mbo7/Ozoboom/milestone/6), selon l'[ADR 0013](../adr/0013-mesures-d-usage-anonymes.md). Le contrat de l'événement ouvre le jalon ; le Worker, le jeu et la lecture se mènent ensuite de front.

## Vagues

| Vague | Clé | Issue                                                                               | Bloquée par |
| ----- | --- | ----------------------------------------------------------------------------------- | ----------- |
| 1     | C1  | #346 shared : le contrat des événements de partie, `GameEvent` et `parseGameEvent`  | -           |
| 2     | W1  | #347 worker : le Worker `stats` écrit chaque événement valide dans Analytics Engine | C1          |
| 2     | A1  | #348 app : chaque partie envoie son `start` et son `end`                            | C1          |
| 2     | R1  | #349 scripts : `pnpm kpi` affiche les neuf KPI depuis la dernière sortie            | C1          |
| 3     | D1  | #350 ci : `VITE_STATS_URL` sur la construction déployée, une fois le Worker déployé | W1, A1      |
| 3     | R2  | #351 release : le tableau des KPI entre dans la pull request de sortie              | R1          |

## Tâches

- **C1.** `src/shared/stats.ts` : le type `GameEvent` (`start` ou `end`, champs des exigences) et `parseGameEvent(json): GameEvent | null`, qui refuse champ manquant, en trop ou hors valeurs. Ligne dans « Contrats partagés » de `architecture.md`. Tests Given / When / Then.
- **W1.** `worker/stats/` sur le modèle de `worker/turn/` (paquet du workspace, `wrangler.toml`, README de déploiement) : `POST /event` en `text/plain`, origine du jeu ou locale seulement, limite de débit par IP, `parseGameEvent` importé de `src/shared/stats.ts`, puis `writeDataPoint` dans le jeu de données `ozoboom_games` : `indexes` = `[stage]`, `blobs` = `[event, stage, mode, classes, device, version, outcome]`, `doubles` = `[players, tier, seconds]` (0 et `''` pour un `start`). Répond 204, 400 ou 429 ; n'écrit jamais l'IP. Tests du gestionnaire avec un faux jeu de données.
- **A1.** `src/app/stats.ts` : `gameEvent(...)`, pur et testé, construit l'événement depuis le `SimState`, le mode, le périphérique et la version ; `sendGameEvent` passe par `navigator.sendBeacon` seulement si `VITE_STATS_URL` est posée et hors `?dev=`, et avale l'échec. Dans `game.ts` : `start` au lancement (solo, local, ou hôte en ligne), `end` une seule fois par partie, à `won`/`lost` (cause lue sur le noyau), à `quit` ou à l'interruption en ligne. Un invité n'envoie rien.
- **R1.** `scripts/kpi.ts` et `pnpm kpi [AAAA-MM-JJ]` : requêtes SQL sur l'API WAE (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STATS_TOKEN` en lecture seule, pris dans l'environnement), sortie en tableaux Markdown K1 à K9 ; par défaut depuis le dernier commit `chore: release` de `origin/main`. Tests sur la mise en forme, pas sur l'API.
- **D1.** Constantin déploie le Worker (`wrangler deploy`) et crée la variable de dépôt `STATS_URL` ; `.github/workflows/ci.yml` passe `VITE_STATS_URL` à la seule construction déployée, comme `VITE_TURN_URL`. Ligne dans « Tests » de `architecture.md`.
- **R2.** La skill `release` (`.claude/skills/release/`) lance `pnpm kpi` et colle le résultat dans la description de la pull request de sortie.

## Règles

- Celles d'`AGENTS.md` : une issue, une branche `issue-<numéro>-<slug>`, fusionnée en un commit sur `dev`.
- Aucun champ hors de la liste fermée des exigences ; en ajouter un passe par les exigences et l'ADR 0013.
- Aucune mesure ne touche la sim : les empreintes de rejeu ne bougent pas.
- Quand une issue fusionne, retirer `blocked` et poser `ready` sur celles qu'elle débloque.
