# 0005 - GitHub Pages et une seule branche déployable

- **Statut :** accepté
- **Date :** 2026-10-04

## Contexte

Le jeu doit se rejoindre par un lien (pilier 1) et le projet est un loisir sans serveur à entretenir. Décision du 2026-10-04 dans la base de connaissances : dépôt public `r4mbo7/Ozoboom` sur GitHub, hébergement sur GitHub Pages. Les projets de Constantin suivent d'habitude git-flow (`main` et `dev`), mais ici les contributeurs sont surtout des agents et la CI est la seule garde.

## Décision

- Un push sur `main` construit et déploie le jeu sur GitHub Pages par GitHub Actions. `main` est donc toujours jouable.
- Développement sur tronc : branches courtes depuis `main`, une pull request par issue, fusion quand la CI est verte. Pas de branche `dev`, pas de branches de release.
- Les versions sont des tags sur `main`, posés quand un jalon du README est atteint.

## Alternatives écartées

- GitLab Pages : préféré d'habitude par Constantin, mais le dépôt doit être lisible par les sessions d'agents dans le cloud, qui n'ont que GitHub.
- git-flow avec `dev` : une branche d'intégration n'a de sens que si plusieurs humains stabilisent avant une sortie. Ici chaque fusion est une sortie.
- Hébergement sur le homelab : un serveur à entretenir pour servir des fichiers statiques.

## Conséquences

Chaque fusion est en production : la CI doit rester stricte et le jeu toujours dans un état montrable, au prix d'interrupteurs de fonctionnalité pour le travail en cours. Le classement public demandera un service séparé (voir `architecture.md`), ce qui ne remet pas en cause l'hébergement statique du jeu.
