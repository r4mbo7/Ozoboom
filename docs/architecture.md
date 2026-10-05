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
  feedback/ bouton « Ton avis » : formulaire, contexte joint, envoi vers GitHub (DOM)
  net/      transport (WebRTC via PeerJS), salon, lockstep : du TypeScript pur hors de peerjs.ts
  app/      assemblage : boucle, écrans, chargement
```

Règles de dépendance, vérifiées par ESLint (`eslint.config.js`) :

- `shared` ne dépend de rien.
- `data` ne dépend que de `shared`.
- `sim` ne dépend que de `shared` et `data`. Interdits dans `sim`, `data` et `shared` : les globales du navigateur, `Math.random`, `Date`, `pixi.js` et tout import des couches au-dessus.
- `render`, `input`, `audio`, `ui` dépendent de `sim` en lecture et de `shared`.
- `ui` et `feedback` ne dépendent ni de `render`, ni d'`audio`, ni de `net`, ni d'`app`. `feedback` réutilise les briques de `ui`.
- `net` ne dépend que de `sim` (types, `hashState`), de `shared` et de `data` ; `peerjs` ne s'importe que dans `src/net/peerjs.ts`, nulle part ailleurs (`app` compris).
- `app` assemble tout.

## Contrats partagés

Ces fichiers sont l'interface entre les couches, donc entre les tâches menées en parallèle. Un changement y est additif, petit, dans sa propre pull request, et annoncé dans l'issue concernée.

Unités : 1 unité vaut 1 pixel à zoom 1, les vitesses sont en unités par tick, les durées en ticks.

| Fichier                 | Contenu                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/sim/state.ts`      | `SimState` et tout ce qu'il contient : noyau, joueurs, ennemis, projectiles, pièges, ramassables, progression du set, statistiques, événements du dernier pas              |
| `src/sim/commands.ts`   | `PlayerCommand` : par joueur et par tick, une entrée continue (`PlayerInput`) et des actions discrètes (`PlayerAction`)                                                    |
| `src/sim/lineup.ts`     | le line-up du set et l'heure : `lineupSlots`, `lineupCursor`, `ticksToDrop`, `setFraction` (position dans le set, dans [0, 1], jamais en arrière, 1 une fois gagné)        |
| `src/shared/palette.ts` | la palette du Cycle du soleil : `paletteAt(fraction)` (jetons en `#rrggbb`) et `lightAt(fraction)` (`additive`, `haloAlpha`)                                               |
| `src/data/types.ts`     | définitions de contenu : `ClassDefinition`, `EnemyDefinition`, `TrapDefinition`, `UpgradeDefinition`, `SetDefinition`, `GameContent`                                       |
| `src/input/intents.ts`  | `InputSnapshot` produit par chaque périphérique, `InputSource` (vue fusionnée), `DeviceId` et `InputHub` (un instantané par périphérique, pour la coop locale)             |
| `src/render/types.ts`   | `Renderer` : `render(state, alpha)`, `screenToWorld`, options dont le mode calme et le cadrage (`CameraFocus` : suivre un joueur, ou cadrer tout le monde)                 |
| `src/audio/types.ts`    | `AudioEngine` : `start`, `update(state)`, `setMuted`, `setMood('set' \| 'menu')`                                                                                           |
| `src/ui/types.ts`       | `Ui` et `UiCallbacks` : écrans (titre, salon, jeu, fin, avis), `UiFrame` (les joueurs de cet écran et leurs instantanés), `LobbyModel` rendu par le salon                  |
| `src/net/types.ts`      | `Transport` (envoyer, diffuser, couper un pair, écouter), `NetMessage` (salon, lancement, commande, trame, empreinte, divergence), `CommandSource` consommée par la boucle |

Conventions de la simulation :

- `createSimulation(options)` construit l'état initial à partir d'une graine, des joueurs et du contenu, et garde le set joué dans `state.setId`. Son `step(commands)` avance d'un tick **en modifiant l'état en place** : pas de copie à chaque tick avec des centaines d'entités.
- Chaque entité mobile garde `prevX`, `prevY` : la sim les met à jour au début du pas, le rendu interpole entre `prev` et courant avec `alpha`.
- `state.events` contient les événements du dernier pas seulement (temps, mesure, drop, mort, tir, dégâts, niveau...). La sim le vide au début de chaque pas. Rendu, audio et interface s'en servent pour les effets sans que la sim les connaisse.
- Le tick 0 n'est simulé par aucun pas : `createSimulation` pose dans `state.events` les événements `beat`, `bar`, `phrase` et `segment` du tick 0, que le premier pas vide.
- En `choosingUpgrade`, `won` et `lost`, le pas vide les événements et recopie `prev` mais `tick` ne bouge plus : la grille musicale et le set s'arrêtent.
- `SetProgress.segmentStartTick` est le tick où le segment courant a commencé : les segments se comptent en mesures depuis là, car le drop a une durée variable.
- Une fois le set fini, `set.tier` vaut `tiers.length`, au-delà du dernier palier : c'est ce qui donne `won`.
- Statuts posés par un système et seulement lus par les autres : `slowFactor` et `stunTicks` d'un ennemi, remis à 1 et décomptés par `traps` ; `invulnerableTicks` d'un joueur, décompté par `skills`, aucun dégât tant qu'il est positif. Un piège s'oriente par `TrapState.direction`, vecteur unitaire tiré du `(dx, dy)` de l'action `placeTrap`.
- `slowFactor`, `suppressedTicks` et `dazzledTicks` d'un joueur sont posés par un module de spécial (soupir, collant, étouffement, éblouissement) et remis à 1 ou décomptés par `specials`, qui ne touche que les joueurs qui en portent déjà un : tant qu'aucun module ne les pose, ils restent absents de l'état et l'empreinte de rejeu.
- `PlayerState.name` est absent en solo (posé seulement si le `PlayerSlot` en porte un), et `reviveTicks` n'apparaît que lorsque `revive` le pose : l'empreinte des rejeux solo ne change pas.
- L'échelle par joueur d'un set (`SetDefinition.perPlayer`) s'applique par joueur au-delà du premier ; absente, rien n'est mis à l'échelle. `reviveMul` (classe) et `reviveBars` (set) absents valent 1.
- `SetDefinition.coreRepairPerBar` plafonne ce que toutes les réparations du noyau (soin, rappel) rendent par mesure ; absent, pas de plafond. `CoreState.repairedThisBar` compte la mesure en cours, ne naît qu'à la première réparation sous plafond et est retiré à chaque `bar` : l'empreinte de rejeu ne bouge pas sans plafond. `coreRepaired.amount` est ce qui a vraiment été réparé.
- Le registre `SPECIALS` (`src/sim/specials/`, un fichier par sorte) associe chaque `SpecialEffect.kind` à son module ; `resolveContent` refuse à la création un contenu dont un ennemi porte un `special.kind` sans module enregistré.
- Une offre d'amélioration se tire quand elle devient l'offre courante du joueur, avec l'éligibilité du moment : `pendingUpgrades` tient au plus une offre par joueur, les niveaux suivants attendent dans `PlayerState.pendingLevelUps`. `upgradeChoice` refuse un choix hors offre ou inéligible (classe, `maxStacks` atteint).
- `input.move` est borné à une longueur de 1, pas normalisé : un stick à mi-course donne la mi-vitesse, une diagonale clavier la vitesse nominale.
- Les identifiants de contenu (`classId`, `kind`, `trapId`, `upgradeId`) sont des chaînes qui pointent dans `GameContent`. La sim résout ces références une fois à la création, puis travaille avec des tables.
- Maths autorisées dans la sim : `+ - * /`, `Math.floor`, `Math.ceil`, `Math.abs`, `Math.min`, `Math.max`, `Math.sqrt` (arrondi correct garanti par IEEE 754). Interdites car non reproductibles d'un moteur à l'autre, et refusées par ESLint : `Math.sin`, `Math.cos`, `Math.atan2`, `Math.pow`, `Math.exp`, `Math.hypot` et l'opérateur `**`. Les angles passent par des vecteurs normalisés, pas par des radians ; `src/shared/angle.ts` convertit ceux des données et des événements sans trigonométrie de `Math`.
- Une stat de joueur se lit par `statValue` (`src/sim/stats.ts`), jamais dans `player.modifiers` (un test le vérifie). Une durée en ticks tirée d'une stat a sa fonction dans ce fichier, que l'interface appelle aussi (`skillCooldownTicks`) : même arrondi des deux côtés.
- Le hasard vient d'un générateur à graine à opérations entières (sfc32), dont l'état vit dans `state.rng`.
- Les ennemis prennent leurs dégâts par `hurtEnemy` (`src/sim/effects.ts`), joueurs et noyau par `src/sim/damage.ts`. `hurtEnemy` reçoit le joueur à créditer (tireur, propriétaire du piège, lanceur de la compétence) et le pose dans `lastHitBy`, repris par `enemyDied.byPlayer`. `StepContext.enemyGrid` répond aux requêtes de voisinage sur les ennemis ; `enemy-steering` puis `projectiles` la reconstruisent.
- Une offre de cartes (`UpgradeOffer.options`) mélange des identifiants d'amélioration, d'agrès et de relique ; `chooseUpgrade.upgradeId` les accepte tous, et les identifiants des agrès ne recoupent jamais ceux des améliorations.
- Chaque sorte d'`WeaponEffect` a son module dans `src/sim/weapons/`, enregistré sur sa ligne dans `WEAPONS` (`src/sim/systems/weapons.ts`) ; `resolveContent` refuse un agrès dont la sorte n'a pas de module. Un module reçoit `fire(ctx, player, slot, definition, { power, target, direction })` : la puissance de niveau, l'ennemi le plus proche et la direction vers lui (la visée du joueur sans ennemi), que `weaponFired` porte en `dx`, `dy`. Une enceinte ouvre au tirage l'agrès de son `unlocksWeaponId` ; toutes branchées, elles ouvrent les fusions.
- Les agrès lancés (étincelle, diabolo, frisbee) sont des `ProjectileState` de propriétaire `weapon`, que `projectiles` fait voler : `arc` retombe en blessant et repoussant dans `radius`, `returnTo` fait revenir le frisbee (`returning`) soigner `heal` l'allié le plus blessé.
- Les agrès posés (`SimState.placed`, assiettes et totem) passent par `place` (`src/sim/weapons/place.ts`) ; les systèmes `placedZones` (avant `enemySteering` : ralentit, soigne, retire à l'expiration ; `bystanders` y compte une assiette comme une aide) et `placedTotems` (après : attire puis repousse) les font vivre. La traînée du monocycle est un anneau borné dans `WeaponSlot.trail`, et sa vitesse un modificateur `speedMul`. `mist`, `lure` et `shockwave` partagent leurs briques avec les pièges dans `src/sim/effects.ts`.
- `SimState.volume` compte les enceintes branchées du set ; `SimState.speakers` tient leur position et leur progression de branchement, posé par `createInitialState` à partir de `SetDefinition.speakers`.
- Le système `speakers` suit `traps` : l'aura d'une enceinte branchée passe par `fire` de `traps.ts`, comme un piège (onde de choc sur le temps, le reste en continu). Les effets du Volume se lisent par `volumeMul` (`src/sim/volume.ts`) ; le score d'une partie est `scoreOf` (`src/sim/score.ts`).
- Le système `revive` suit `playerMovement` : l'allié debout au contact au plus grand `reviveMul` fait monter `PlayerState.reviveTicks` de `reviveMul` par tick, qui retombe à 0 sans contact ; à `reviveBars` mesures l'allié se relève à mi-vie, invulnérable un temps. `bystanders` compte le même `reviveMul` au contact du Festivalier. Une vibe ramassée va à chaque joueur debout, `stats.vibesCollected` la compte une fois.
- `spawning` multiplie le `count` d'une règle par `1 + spawnMul × (joueurs - 1)` (arrondi, au moins `count`) et la vie d'une bad vibe à l'apparition, boss compris, par `1 + enemyHpMul × (joueurs - 1)`, avec `SetDefinition.perPlayer` ; en solo le facteur vaut 1.

## Boucle

```
périphériques -> InputSnapshot -> PlayerCommand(tick)
                                        |
         accumulateur de temps -> step(state, commands) x N ticks fixes
                                        |
                       render(state, alpha)   audio.update(state)   ui.update(state)
```

L'accumulateur plafonne le nombre de ticks par image pour ne pas s'enfoncer après une pause d'onglet. Les entrées sont lues une fois par image, avant ses pas ; l'audio reçoit l'état après chaque pas, le rendu et l'interface une fois par image avec les événements de tous les pas de l'image (`src/app/session.ts`), sans toucher à `state.events` de la sim. Quand la sim est en `choosingUpgrade`, elle n'avance plus : l'interface affiche le choix, l'action `chooseUpgrade` la relance.

À plusieurs, la boucle garde sa forme : une `CommandSource` (`src/net/types.ts`) donne les commandes du tick, locales ou trame du lockstep ; quand elle n'a rien, le pas attend et le rendu fige l'interpolation. En coop locale, un `Controls` par joueur produit sa commande à partir de son périphérique (`InputHub`), et la caméra cadre tout le monde.

## Coop en ligne

ADR 0007 : le navigateur d'un joueur est l'hôte et fait foi, les invités s'y connectent en pair à pair (WebRTC, canaux de données fiables et ordonnés) par le courtier public PeerJS, et tout le monde simule les mêmes commandes au même tick, en lockstep séquencé par l'hôte.

- Le code de salon est l'identifiant PeerJS de l'hôte ; le lien `…/#rejoindre=CODE` le porte dans le fragment.
- À l'entrée, un invité envoie sa version (`__APP_VERSION__`), son nom et sa classe ; l'hôte refuse une version différente, un salon plein ou une partie commencée, et diffuse le salon à chaque changement.
- Au lancement, l'hôte envoie la graine, le set et les joueurs ; chaque pair crée la même sim.
- À chaque tick, l'hôte assemble la trame (sa commande et la dernière reçue de chaque invité, ou l'entrée précédente sans action), la simule et la diffuse. Un invité envoie sa commande à chaque tick et ne simule que les trames reçues, dans l'ordre, derrière un tampon de deux ticks. Une action n'est jamais perdue : deux commandes pour un même tick donnent la dernière entrée et toutes les actions ; un invité qui accumule plus de 8192 trames (onglet figé, moins de cinq minutes) prévient l'hôte par `bye` et affiche « Connexion perdue » : ce n'est pas une divergence.
- À chaque mesure, un invité envoie `hashState` ; une différence avec l'hôte arrête la partie pour tous, avec un écran explicite et un rapport prêt pour « Ton avis ».
- L'hôte qui part finit la partie des invités ; un invité qui part laisse son personnage immobile.

La coop locale (plusieurs périphériques sur un écran) ne demande aucun réseau : les commandes de chaque périphérique entrent dans la même sim, par la même `CommandSource` locale.

## Chemin vers le classement public

Un site statique ne peut pas tenir un classement fiable : il faut un petit service.

- Le client envoie la graine, le journal des commandes et le score revendiqué.
- Le service rejoue la sim en Node avec le même code (d'où l'absence de dépendance au navigateur) et compare. Seul le score recalculé est stocké.
- Une graine du jour commune rend les parties comparables.
- Hébergement candidat : fonction serverless avec base légère (Cloudflare Workers et D1), ou service sur le homelab via Kamal. ADR au moment venu.

## Tests

- `sim`, `data`, `shared` : tests unitaires Vitest, rapides, sans navigateur. Structure Given / When / Then. C'est là que vit l'essentiel de la couverture.
- Déterminisme : tests de rejeu qui fixent l'empreinte de l'état final pour une graine et une suite de commandes données. Toute dérive casse le test. La même partie scriptée donne la même empreinte dans Chromium, Firefox et WebKit (`dev/replay.html`, Playwright) que dans Node.
- Réseau : le lockstep se teste en Vitest sur un transport en mémoire ; deux pages Playwright jouent une partie `?dev=fast` par un courtier PeerJS local (`peer`) et finissent sur la même empreinte. Playwright lance le courtier sur `E2E_PEER_PORT` (9000 par défaut) et construit le jeu avec `VITE_PEER_SERVER=localhost:<port>` ; en production la variable est absente et le jeu prend le courtier public. `peerjs` ne se charge qu'à l'ouverture d'un salon (import dynamique) ; `dev/net.html` est le banc du salon.
- Contenu : un test valide `GameContent` (identifiants uniques, références résolues, valeurs positives).
- Rendu et interface : tests de fumée dans un vrai navigateur (Playwright) dès qu'il y a un écran à tester.
- Équilibrage : des simulations en masse sans écran, lancées en ligne de commande, sortent des courbes de survie par classe.

## Qualité et livraison

- TypeScript strict, ESLint avec règles typées, Prettier, Vitest. `pnpm check` enchaîne tout et doit passer avant chaque commit.
- CI GitHub Actions sur chaque push et pull request. Un push sur `main` construit et déploie sur GitHub Pages.
- Dependabot met à jour dépendances et actions chaque semaine.
- Base d'URL relative dans le build : le même `dist/` se sert depuis GitHub Pages, GitLab Pages ou une archive itch.io.
