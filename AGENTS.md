# AGENTS.md

Instructions pour toute personne ou agent qui travaille sur Ozoboom. `CLAUDE.md` ne fait qu'inclure ce fichier : il n'y a qu'une source.

## Lire avant d'agir

- [docs/vision.md](docs/vision.md) : piliers et non-objectifs. À lire à chaque session.
- [docs/architecture.md](docs/architecture.md) : avant de toucher au code. Les contrats partagés y sont listés.
- [docs/game-design.md](docs/game-design.md) : avant de toucher au gameplay, au contenu ou à l'équilibrage.
- [docs/direction-artistique.md](docs/direction-artistique.md) : avant de toucher au visuel, au son ou aux textes.
- [docs/adr/](docs/adr/) : les décisions prises. Ne pas les rediscuter sans nouvel ADR.
- [docs/brainstorms/](docs/brainstorms/) : les exigences du jalon en cours. [docs/plans/](docs/plans/) : son découpage en tâches.

## Langues

Documentation, interface du jeu et textes en français. Code, identifiants, messages de commit et messages d'erreur techniques en anglais. Pas de tiret long, le tiret simple « - » suffit.

## Prendre une tâche

- Les tâches sont les issues GitHub du jalon en cours. Une issue porte le label `ready` quand rien ne la bloque. Ne pas commencer une issue `blocked`.
- Une branche par issue, fusionnée en un commit qui la ferme (`Closes #N`). Une branche reste petite et ne fait que ce que dit l'issue.
- Les contrats partagés (voir `docs/architecture.md`) sont communs à toutes les tâches en cours. Un changement y est additif, minimal, dans sa propre branche, et annoncé dans l'issue concernée avant de fusionner.
- Ce qui dépasse l'issue devient une nouvelle issue, jamais un `TODO` ni du périmètre ajouté au diff.

## Aller vite

Une session d'agent dure 5 à 15 minutes. Le temps va au changement, pas aux preuves.

- Lire le strict nécessaire : l'issue, les fichiers à changer, la section de document qu'elle cite.
- Pendant le travail, ne lancer que les tests des fichiers touchés (`pnpm exec vitest run <fichiers>`, une seule spec Playwright si le parcours change). La suite complète ne tourne qu'une fois, à la fusion, et `pnpm check` aussi.
- La machine est partagée avec d'autres sessions : ne tuer que ses propres processus (jamais `pkill -f playwright`), et arrêter ses serveurs (`pnpm dev`, `pnpm preview`) avant de finir.
- Une preuve au plus : une capture si le changement se voit, un rendu si il s'entend. Pas de matrice d'écrans, de moments ou de tailles.
- Une issue décrit un changement qui tient dans une session. Plus grosse, on la coupe.

## Écrire des documents

Court. Un agent doit pouvoir charger un document entier et garder de la place pour travailler. Quand un document grossit, on coupe, on ne crée pas un second fichier pour garder la prose.

Couper dans cet ordre : ce que le code, l'historique git ou `gh` donnent déjà ; les paragraphes qui redisent un tableau ; les préambules et récapitulatifs ; les justifications qui n'empêchent personne de défaire la décision. Une exigence ou une décision tient en une ligne, sinon c'est deux.

- Une décision coûteuse à défaire : un ADR depuis `docs/adr/TEMPLATE.md`.
- Un jalon : un document d'exigences daté dans `docs/brainstorms/`, et son plan dans `docs/plans/`.
- Le reste : le document existant, mis à jour. Pas de fichier « divers ».

## Écrire du code

- Pas de commentaire par défaut. Une ligne seulement quand le pourquoi est vraiment non évident. Jamais pour redire ce que le code dit.
- Tests d'abord quand le besoin est clair. Un bug se corrige en écrivant d'abord le test qui échoue. Structure Given / When / Then, sans commentaires pour le dire.
- Commencer une fonctionnalité par ses interfaces publiques, puis les tests, puis l'implémentation.
- Dans `src/sim/`, `src/data/` et `src/shared/` : rien du navigateur, pas de `Math.random`, pas de `Date`, pas de PixiJS, maths limitées à celles de `docs/architecture.md`. ESLint le vérifie, ne pas contourner.
- Le contenu de jeu (classes, ennemis, pièges, améliorations, sets) est de la donnée dans `src/data/`, jamais des `if` dans la logique.
- Une erreur attendue n'est pas un bug. Une exception inattendue en est un et doit remonter, pas être avalée.
- Moins de code est une victoire. Pas d'abstraction avant le deuxième usage.
- Une dépendance s'ajoute avec un ADR si elle structure le projet, sinon avec une phrase dans le message de commit qui dit pourquoi.

## Retours des joueurs

Un retour de joueur est une issue `feedback` (design : [docs/brainstorms/2026-10-04-feedback-requirements.md](docs/brainstorms/2026-10-04-feedback-requirements.md)).

- Un retour donné de vive voix par Constantin devient une issue `feedback` `source:direct`, avec ses mots exacts en citation.
- Trier une issue `needs-triage` : poser un `type:*`, puis la lier à une issue de travail dans un jalon, ou la fermer comme doublon avec le lien, ou la fermer « non retenue » avec une phrase qui dit pourquoi. Retirer `needs-triage`.
- Ne jamais implémenter directement un retour : il passe par une issue de travail, comme le reste.

## Commandes

```bash
pnpm install          # dépendances (Node 24, pnpm épinglé dans package.json)
pnpm dev              # serveur de développement
pnpm check            # types, lint, format, tests, build : doit passer avant tout commit
pnpm test:watch       # tests en continu
pnpm exec playwright test   # tests navigateur, sur des ports propres à chaque checkout
pnpm contrast         # contraste de chaque écran à chaque moment (6 min), après un changement de couleur
pnpm format           # formate tout
```

Un lint, un test ou une instabilité qui casse se répare, même sans lien avec le travail en cours.

## Git

- `dev` reçoit le travail, `main` les sorties et déploie sur GitHub Pages ([ADR 0008](docs/adr/0008-branche-dev-et-sorties-sur-main.md)). Pas de pull request pour les branches d'issue : elles se fusionnent en local, testées par l'agent.
- Fusionner une branche : la réduire en un commit au-dessus de `origin/dev`, faire passer `pnpm check` et `pnpm exec playwright test`, puis `git push origin HEAD:dev` et supprimer la branche. Si `dev` a bougé entre-temps, recommencer.
- Sortir une version, seulement à la demande de Constantin : ouvrir une pull request de `dev` vers `main`, attendre la CI verte, puis `git push origin origin/dev:main` en avance rapide, ce qui la marque fusionnée. Jamais d'autre push sur `main`.
- La CI ne tourne que sur la pull request de `dev` vers `main` et sur le push de `main`, qu'elle déploie si elle passe : un échec s'y répare aussitôt. Rien ne tourne sur `dev` : les tests locaux de l'agent sont la seule garde.
- Messages de commit en anglais, format conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `refactor:`, `test:`), le sujet dit ce que le joueur ou le contributeur peut faire de nouveau.
- Pas de ligne d'attribution ni de co-auteur agent dans les commits.
- Jamais de secret dans le dépôt. Le jeu n'en a pas besoin ; le futur service de classement les tiendra hors du code.
