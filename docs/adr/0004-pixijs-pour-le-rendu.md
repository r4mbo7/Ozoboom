# 0004 - PixiJS pour le rendu

- **Statut :** accepté
- **Date :** 2026-10-04

## Contexte

Vue de dessus en 2D, plusieurs centaines de sprites lumineux à 60 images par seconde sur du matériel modeste (piliers 1 et 6, `direction-artistique.md`). L'ADR 0003 impose que le moteur de rendu ne porte ni la boucle ni l'état du jeu. La piste notée dans la base de connaissances le 2026-10-04 (Phaser 3 ou PixiJS) n'avait pas été tranchée.

## Décision

**PixiJS 8** rend la scène. C'est un moteur de rendu 2D (WebGL, WebGPU) et rien d'autre : pas de boucle, pas de physique, pas d'état. Il fait exactement la part du travail que l'ADR 0003 lui laisse. Sprites en lot, formes vectorielles, filtres (glow, bloom) et particules couvrent la direction artistique.

PixiJS n'entre dans les dépendances qu'avec le premier écran de jeu, dans `src/render/`.

## Alternatives écartées

- **Phaser 3** : framework complet avec sa boucle, ses scènes et sa physique. Tout ce qu'il apporte en plus de Pixi est ce que l'ADR 0003 interdit de lui confier.
- **Canvas 2D sans bibliothèque** : simple, mais sans lots ni filtres, il plafonne bien avant les centaines de sprites avec halo sur un téléphone.
- **Three.js ou Babylon.js** : moteurs 3D, plus lourds et hors sujet pour de la 2D plate.
- **Excalibur, Kaplay** : moteurs complets, même objection que Phaser, communautés plus petites.
- **Godot export web** : builds de 30 Mo et plus, chargement lent, pile d'outils étrangère au reste.

## Conséquences

Le rendu reste une couche fine et remplaçable : la sim ne connaît pas Pixi. Pixi 8 a une API stable et une documentation que les agents connaissent. À surveiller : la taille du bundle (importer les modules nécessaires seulement) et le coût des filtres sur mobile, à mesurer au prototype.
