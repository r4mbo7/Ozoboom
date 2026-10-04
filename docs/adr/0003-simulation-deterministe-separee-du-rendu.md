# 0003 - Simulation déterministe, séparée du rendu, à pas fixe

- **Statut :** accepté
- **Date :** 2026-10-04

## Contexte

Le jeu est pensé pour la coop en ligne dès le départ (pilier 2), même si la V0 est solo. Le classement public doit résister à la triche ordinaire. Les agents doivent pouvoir tester la logique de jeu vite et sans navigateur, et plusieurs agents doivent pouvoir travailler en parallèle sur le rendu, les entrées, l'audio et la logique sans se bloquer. Ces besoins ont la même réponse.

## Décision

La simulation est un module TypeScript pur, sans accès au navigateur, au rendu, à l'horloge ni au hasard système. Elle avance par pas fixes et ne consomme que deux choses : une graine et des commandes par joueur et par tick. Pour les mêmes entrées, elle produit le même état sur toute machine.

Le rendu, les entrées, l'audio et l'interface vivent à côté et lisent l'état sans le modifier. Les frontières sont vérifiées par ESLint (`eslint.config.js`), les contrats sont des fichiers de types partagés (voir `docs/architecture.md`).

## Alternatives écartées

- Laisser un moteur de jeu (Phaser, Babylon) tenir la boucle, la physique et l'état : rapide au début, mais l'état se mélange au rendu et le réseau devient une refonte.
- Simulation à pas variable (delta time) : plus simple, mais non reproductible, donc ni rejeu, ni vérification, ni lockstep.
- Décider le multijoueur plus tard : c'est la seule décision qui ne se rattrape pas sans tout réécrire.

## Conséquences

Facile : tests unitaires rapides, rejeux, vérification des scores côté serveur, coop en ligne par commandes, équilibrage en masse sans écran, travail en parallèle par couche. Difficile : discipline d'écriture (pas de `Math.random`, pas d'horloge, maths flottantes limitées aux opérations à arrondi garanti), interpolation nécessaire pour un rendu fluide, et un peu de plomberie avant la première chose visible. Réversible seulement au prix d'un abandon du multijoueur et du classement vérifié.
