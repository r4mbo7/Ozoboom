# 0002 - TypeScript strict, Vite et pnpm

- **Statut :** accepté
- **Date :** 2026-10-04

## Contexte

Le jeu tourne dans le navigateur (pilier 1) et sera écrit surtout par des agents, qui gagnent beaucoup à un typage strict et à un outillage standard qu'ils connaissent déjà. La simulation doit aussi tourner en Node pour les tests et la vérification du classement.

## Décision

- **TypeScript** en mode strict, avec `noUncheckedIndexedAccess` et `exactOptionalPropertyTypes`. Syntaxe effaçable seulement (`erasableSyntaxOnly`) pour que Node exécute la sim sans étape de compilation. Version 6 tant que typescript-eslint ne supporte pas la 7.
- **Vite** pour le serveur de développement, le build de production et la configuration de Vitest. Base d'URL relative.
- **pnpm**, épinglé par le champ `packageManager`, et **Node 24** (`.node-version`).

## Alternatives écartées

- JavaScript sans types : trop d'erreurs silencieuses dans une sim de plusieurs centaines d'entités, et rien pour guider les agents.
- Un moteur avec son propre outillage (Phaser et ses templates, Godot export web) : voir ADR 0004. Godot produit des builds web lourds et ferme la porte aux outils JavaScript standard.
- npm ou yarn : pnpm est plus rapide, plus strict sur les dépendances fantômes, et déjà utilisé par Constantin.
- Rolldown, esbuild ou webpack directement : Vite les orchestre déjà et apporte le serveur de développement et Vitest.

## Conséquences

Chaîne d'outils standard, connue des agents, documentée partout. Vite impose une structure (`index.html` à la racine, `src/`), ce qui est voulu. Le build cible les navigateurs récents (ES2023), pas les anciens.
