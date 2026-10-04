# 0006 - ESLint typé, Prettier, Vitest et CI à chaque commit

- **Statut :** accepté
- **Date :** 2026-10-04

## Contexte

Le code est écrit par des agents de sessions différentes, parfois en parallèle. Sans gardien actif, un code se dégrade. Constantin exige zéro erreur de lint, zéro test en échec, même hors du sujet en cours. L'ADR 0003 pose des frontières entre dossiers qu'un humain ne surveillera pas à la main.

## Décision

- **ESLint** avec les règles typées de typescript-eslint (`strictTypeChecked`, `stylisticTypeChecked`). Les frontières de l'ADR 0003 y sont codées en règles `no-restricted-*` par dossier.
- **Prettier** pour le format, sans discussion.
- **Vitest** pour les tests, en environnement Node par défaut.
- **`pnpm check`** enchaîne types, lint, format, tests et build. La **CI GitHub Actions** rejoue la même suite sur chaque push et pull request. **Dependabot** propose les mises à jour chaque semaine.

## Alternatives écartées

- **Biome** : un seul outil, très rapide, mais sans règles typées (promesses oubliées, comparaisons douteuses) ni règles de frontières par dossier. La vitesse ne compense pas ce que l'on perd.
- Pas de formateur : chaque agent formate à sa façon et les diffs deviennent illisibles.
- Hooks git pré-commit : utiles mais contournables ; la CI est la garde qui compte. À ajouter si le besoin se confirme.

## Conséquences

Un peu de lenteur au lint (analyse typée) contre des classes entières d'erreurs attrapées avant l'exécution. Toute règle qui gêne se discute dans la configuration, jamais par un `eslint-disable` dans le code.
