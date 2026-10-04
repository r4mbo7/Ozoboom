# Architecture

Les choix ci-dessous découlent des piliers de `vision.md`. Les décisions coûteuses à défaire sont justifiées dans `adr/`.

## Principes

1. **La simulation est déterministe et ne connaît ni le navigateur ni le moteur de rendu** (ADR 0003). Du TypeScript pur, sans DOM, sans PixiJS, sans `Math.random` ni `Date`. Elle avance par pas fixes (tick) et ne consomme que des commandes datées en ticks et une graine. Mêmes commandes, même graine : même état, partout (navigateur, Node, worker). C'est ce qui rend possibles les tests rapides, les rejeux, la vérification du classement, la coop en ligne et l'équilibrage en masse sans écran.
2. **Le rendu lit l'état, il ne l'écrit jamais.** Il interpole entre deux ticks pour rester fluide à n'importe quelle fréquence d'écran.
3. **Les entrées sont abstraites.** Clavier, souris, manette et tactile produisent les mêmes intentions (déplacement, visée, tirer, poser, choisir, naviguer), transformées en commandes par tick. L'interface se pilote avec ces mêmes intentions.
4. **Le contenu est de la donnée.** Classes, ennemis, pièges, améliorations, sets et courbes vivent dans `src/data/` sous forme d'objets TypeScript typés, pas dans la logique. Équilibrer, c'est éditer une table.
5. **Un seul temps musical.** `src/shared/tempo.ts` convertit ticks, temps, mesures et phrases. Les événements rythmiques dérivent du compteur de ticks, l'audio se cale dessus par le planificateur de la Web Audio API.
6. **Le budget de performance est une exigence.** Plusieurs centaines d'entités à 60 images par seconde sur un portable sans carte dédiée et un téléphone de milieu de gamme. Chargement initial sous 2 Mo compressés. Mesurer avant d'optimiser, et garder la boucle chaude sans allocation inutile.

## Le tick est une subdivision du temps musical

Un temps à 145 BPM vaut 12 ticks, donc la simulation tourne à **29 Hz** (`TICK_RATE_HZ`), une mesure vaut 48 ticks et une phrase 768. Temps, mesures, phrases et drops tombent sur des ticks entiers : aucune dérive, aucun flottant dans le rythme. Le rendu, lui, tourne à la fréquence de l'écran et interpole. Les constantes sont dans `src/shared/tempo.ts`.

## Organisation du code

```
src/
  shared/   utilitaires sans dépendance : tempo, générateur aléatoire à graine, maths
  data/     contenu déclaratif : classes, ennemis, pièges, améliorations, sets
  sim/      simulation déterministe : état, commandes, pas de temps, systèmes
  render/   rendu PixiJS, lit l'état de la sim
  input/    périphériques vers intentions
  audio/    Web Audio, calé sur le tempo
  ui/       écrans et HUD (DOM)
  net/      plus tard : transport, lobby, synchronisation
  app/      assemblage : boucle, écrans, chargement
```

Règles de dépendance, vérifiées par ESLint (`eslint.config.js`) :

- `shared` ne dépend de rien.
- `data` ne dépend que de `shared`.
- `sim` ne dépend que de `shared` et `data`. Interdits dans `sim`, `data` et `shared` : les globales du navigateur, `Math.random`, `Date`, `pixi.js` et tout import des couches au-dessus.
- `render`, `input`, `audio`, `ui` dépendent de `sim` en lecture et de `shared`.
- `app` assemble tout.

## Contrats partagés

Ces fichiers sont l'interface entre les couches, donc entre les tâches menées en parallèle. Un changement y est additif, petit, dans sa propre pull request, et annoncé dans l'issue concernée.

Unités : 1 unité vaut 1 pixel à zoom 1, les vitesses sont en unités par tick, les durées en ticks.

| Fichier                | Contenu                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/sim/state.ts`     | `SimState` et tout ce qu'il contient : noyau, joueurs, ennemis, projectiles, pièges, ramassables, progression du set, statistiques, événements du dernier pas |
| `src/sim/commands.ts`  | `PlayerCommand` : par joueur et par tick, une entrée continue (`PlayerInput`) et des actions discrètes (`PlayerAction`)                                       |
| `src/data/types.ts`    | définitions de contenu : `ClassDefinition`, `EnemyDefinition`, `TrapDefinition`, `UpgradeDefinition`, `SetDefinition`, `GameContent`                          |
| `src/input/intents.ts` | `InputSnapshot` produit par chaque périphérique, `InputSource`                                                                                                |
| `src/render/types.ts`  | `Renderer` : `render(state, alpha)`, `screenToWorld`, options dont le mode calme                                                                              |
| `src/audio/types.ts`   | `AudioEngine` : `start`, `update(state)`, `setMuted`                                                                                                          |

Conventions de la simulation :

- `createGame(options): SimState` construit l'état initial à partir d'une graine, des joueurs et du contenu. `step(state, commands): void` avance d'un tick **en modifiant l'état en place** : pas de copie à chaque tick avec des centaines d'entités.
- Chaque entité mobile garde `prevX`, `prevY` : la sim les met à jour au début du pas, le rendu interpole entre `prev` et courant avec `alpha`.
- `state.events` contient les événements du dernier pas seulement (temps, mesure, drop, mort, tir, dégâts, niveau...). La sim le vide au début de chaque pas. Rendu, audio et interface s'en servent pour les effets sans que la sim les connaisse.
- Les identifiants de contenu (`classId`, `kind`, `trapId`, `upgradeId`) sont des chaînes qui pointent dans `GameContent`. La sim résout ces références une fois à la création, puis travaille avec des tables.
- Maths autorisées dans la sim : `+ - * /`, `Math.floor`, `Math.ceil`, `Math.abs`, `Math.min`, `Math.max`, `Math.sqrt` (arrondi correct garanti par IEEE 754). Interdites car non reproductibles d'un moteur à l'autre : `Math.sin`, `Math.cos`, `Math.atan2`, `Math.pow`, `Math.exp`, `Math.hypot`. Les angles passent par des vecteurs normalisés, pas par des radians.
- Le hasard vient d'un générateur à graine à opérations entières (sfc32), dont l'état vit dans `state.rng`.

## Boucle

```
périphériques -> InputSnapshot -> PlayerCommand(tick)
                                        |
         accumulateur de temps -> step(state, commands) x N ticks fixes
                                        |
                       render(state, alpha)   audio.update(state)   ui.update(state)
```

L'accumulateur plafonne le nombre de ticks par image pour ne pas s'enfoncer après une pause d'onglet. Quand la sim est en `choosingUpgrade`, elle n'avance plus : l'interface affiche le choix, l'action `chooseUpgrade` la relance.

## Chemin vers la coop en ligne

Décidé le 2026-10-04 : le navigateur d'un joueur fait l'hôte et fait foi, les autres s'y connectent en pair à pair (WebRTC, canaux de données), avec un service de mise en relation minimal. Le jeu reste hébergé en statique. Deux variantes compatibles avec la sim :

- **Hôte autoritaire** : les clients envoient leurs commandes, l'hôte simule et diffuse des instantanés ou des différences d'état. Robuste aux divergences, plus de bande passante.
- **Lockstep** : tout le monde simule les mêmes commandes au même tick. Très peu de bande passante, exige un déterminisme parfait.

Le choix se fera par ADR quand on y arrive. Dans les deux cas la sim ne consomme que des commandes par tick : c'est la contrainte à respecter dès maintenant, et `PlayerCommand` est déjà la forme qui circulera sur le réseau.

Une coop locale (plusieurs manettes sur un écran) ne demande aucun réseau : les commandes de chaque manette entrent dans la même sim. C'est l'étape intermédiaire naturelle.

## Chemin vers le classement public

Un site statique ne peut pas tenir un classement fiable : il faut un petit service.

- Le client envoie la graine, le journal des commandes et le score revendiqué.
- Le service rejoue la sim en Node avec le même code (d'où l'absence de dépendance au navigateur) et compare. Seul le score recalculé est stocké.
- Une graine du jour commune rend les parties comparables.
- Hébergement candidat : fonction serverless avec base légère (Cloudflare Workers et D1), ou service sur le homelab via Kamal. ADR au moment venu.

## Tests

- `sim`, `data`, `shared` : tests unitaires Vitest, rapides, sans navigateur. Structure Given / When / Then. C'est là que vit l'essentiel de la couverture.
- Déterminisme : tests de rejeu qui fixent l'empreinte de l'état final pour une graine et une suite de commandes données. Toute dérive casse le test.
- Contenu : un test valide `GameContent` (identifiants uniques, références résolues, valeurs positives).
- Rendu et interface : tests de fumée dans un vrai navigateur (Playwright) dès qu'il y a un écran à tester.
- Équilibrage : des simulations en masse sans écran, lancées en ligne de commande, sortent des courbes de survie par classe.

## Qualité et livraison

- TypeScript strict, ESLint avec règles typées, Prettier, Vitest. `pnpm check` enchaîne tout et doit passer avant chaque commit.
- CI GitHub Actions sur chaque push et pull request. Un push sur `main` construit et déploie sur GitHub Pages.
- Dependabot met à jour dépendances et actions chaque semaine.
- Base d'URL relative dans le build : le même `dist/` se sert depuis GitHub Pages, GitLab Pages ou une archive itch.io.
