# 0012 - Le tempo est une donnée de la scène

- **Statut :** accepté
- **Date :** 2026-10-10

## Contexte

Le jeu n'avait qu'un tempo, 145 BPM, posé en constantes dans `src/shared/tempo.ts` : un temps vaut 12 ticks et la sim tourne à 29 Hz (principe 5 de `architecture.md`). Le Dome, deuxième scène, joue à 96,7 BPM, comme le live de référence. Le jeu se cale sur la musique : les vagues tombent sur les mesures, les segments durent des phrases, les agrès tirent sur le temps.

## Décision

- Le tick reste à 29 Hz dans toutes les scènes.
- Chaque set donne la longueur de son temps en ticks (`SetDefinition.ticksPerBeat`, 12 par défaut, 18 au Dome). `tempoOf` en tire mesure, phrase et BPM (`29 × 60 / ticksPerBeat`), et `setTempo(set)` donne le tempo du set joué.
- Tout ce qui se compte en temps, en mesures et en phrases suit la scène : événements de la grille, segments, effets par mesure, rythmes des agrès, animations calées sur le temps, planification de l'audio.
- Les durées écrites en ticks dans les données restent en temps réel, identiques dans les deux scènes : recharges, statuts, vols de projectiles. Les constantes `TICKS_PER_BEAT` et `TICKS_PER_BAR` restent celles de la main stage et servent seulement à écrire ces durées.

## Alternatives écartées

- **Un tick par scène** (19,3 Hz au Dome) : les vitesses et les portées sont en unités par tick, le lockstep et les tests supposent 29 Hz, et l'entrée deviendrait moins réactive.
- **Le demi-temps sur la grille de 145** : il ne sonne pas comme le live de référence (Constantin, 2026-10-10).
- **Toutes les durées des données en temps, mises à l'échelle par scène** : une portée de projectile s'allongerait avec la musique. À reprendre champ par champ si l'équilibrage du Dome le demande.

## Conséquences

- Un tempo de scène vaut 1740 / n BPM pour un nombre entier n de ticks par temps : 145 (12), 116 (15), 108,75 (16), 96,7 (18)...
- La sim, le rendu, l'audio et l'interface lisent le tempo du set au lieu d'une constante. Les empreintes de rejeu de la main stage ne doivent pas bouger : c'est le garde-fou.
- Au Dome, la partie respire un tiers plus lentement : elle se rééquilibre dans ses propres données.
- À revoir si une scène demande un tempo hors de cette grille, ou un tempo qui change pendant le set.
