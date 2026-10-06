# 0008 - Une branche `dev` d'intégration, `main` pour les sorties

- **Statut :** accepté
- **Date :** 2026-10-06

## Contexte

L'[ADR 0005](0005-github-pages-et-main-deployable.md) faisait de chaque fusion une sortie : les agents poussaient directement sur `main`. Avec plusieurs agents en parallèle, ces poussées se croisent, chacun doit refaire sa base et retester, et chaque fusion redéploie le jeu.

## Décision

- Le jeu reste hébergé sur GitHub Pages ; un push sur `main` le construit et le déploie.
- `dev` est la branche par défaut du dépôt. Les branches d'issue partent de `origin/dev` et y sont fusionnées en un commit, testées en local par l'agent.
- `main` ne reçoit que des sorties : à la demande de Constantin, une pull request de `dev` vers `main` fait tourner la CI, puis `main` avance en avance rapide jusqu'à `dev`. Personne ne pousse d'autre commit sur `main`.
- La CI ne tourne que sur cette pull request et sur le push de `main`. Rien sur `dev`, Dependabot compris.
- Les versions sont des tags sur `main`, posés quand un jalon du README est atteint.

## Alternatives écartées

- Garder le tronc unique (0005) : les conflits entre agents et les redéploiements à chaque fusion sont la raison de ce changement.
- Fusionner `dev` dans `main` par un commit de fusion : l'avance rapide garde un historique linéaire et `main` toujours ancêtre de `dev`.
- Des branches de release : une seule personne décide des sorties, `dev` suffit à stabiliser.

## Conséquences

Les agents ne se disputent plus la branche qui déploie, et Constantin choisit quand une version part en ligne. Le jeu en ligne peut avoir du retard sur `dev`. Un correctif urgent passe par `dev` puis une sortie. `dev` étant la branche par défaut, `Closes #N` ferme l'issue dès la fusion dans `dev`.
