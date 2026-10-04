# Direction artistique

Ozoboom se passe dans un festival de psytrance, la nuit, vu du ciel. Références : Ozora (Hongrie) et Boom (Portugal), dont le nom du jeu est le mot-valise.

## Intention

Un dancefloor dans la nuit : le sol est sombre, tout ce qui compte émet de la lumière. Décos UV tendues entre les arbres, lasers, mandalas au sol, structures de bois organiques, la scène principale qui pulse comme un phare. L'ambiance est psychédélique et joyeuse, jamais sombre ni horrifique : les ennemis sont des « bad vibes », du brouillard gris qui éteint la lumière, et les tuer, c'est rallumer la fête.

Trois mots pour trancher un doute : **lumineux, rythmé, bienveillant**.

## Lumière et couleur

Règle de lecture : **ce qui est à nous émet de la lumière, ce qui est hostile l'absorbe.** Les joueurs, le noyau et les pièges brillent (couleurs fluo sous lumière noire). Les ennemis sont gris-violet, mats, désaturés, et explosent en couleur quand ils meurent.

Palette de départ, à valider à l'écran. Les jetons sont déclarés dans `src/style.css`.

| Jeton        | Hex       | Usage                                         |
| ------------ | --------- | --------------------------------------------- |
| `night`      | `#0b0618` | fond, le sol du festival (jamais de noir pur) |
| `ink`        | `#1a1030` | surfaces d'interface, ombres                  |
| `uv-magenta` | `#ff2bd6` | mage, lasers, accent principal                |
| `uv-cyan`    | `#2bf0ff` | noyau, interface, texte en évidence           |
| `uv-lime`    | `#b6ff2b` | healer, soins, gains                          |
| `sun-orange` | `#ff8c2b` | tank, impacts, alertes                        |
| `bad-vibe`   | `#5a506b` | ennemis, brouillard                           |
| `glow`       | `#f4f0ff` | halos, texte courant                          |

Chaque classe a sa couleur et sa silhouette : un joueur daltonien doit distinguer les classes et les pièges à la forme seule. La couleur renforce, elle ne porte jamais seule une information.

## Formes

- Vue de dessus, 2D. Sprites plats à contour lumineux (glow) plutôt que texturés : la lisibilité d'une centaine d'entités prime sur le détail. En V0, tout est dessiné par le code (formes géométriques), sans fichier d'image.
- Vocabulaire : géométrie sacrée (mandalas, fleurs de vie), fractales, string art UV (triangles tendus), bois courbé des structures d'Ozora, dôme et temple de Boom.
- Silhouettes simples et distinctes à petite taille : un ennemi se reconnaît en un coup d'oeil à 16 pixels.
- Les pièges ressemblent au matériel de festival : caisson de basse, laser, brumisateur, déco UV, stroboscope.

## Rythme

Le tempo est celui du full-on psytrance : **145 BPM**. Un temps dure 413,8 ms, une mesure (4 temps) 1,655 s, une phrase de 16 mesures 26,5 s.

Tout ce qui bouge est calé dessus : le noyau pulse sur le kick, les pièges tirent sur le temps, les vagues arrivent sur la mesure, le boss sur le drop. Les durées d'animation s'expriment en temps et en mesures, pas en millisecondes. Le module `src/shared/tempo.ts` est la source unique de ces conversions.

## Son

- Musique : psytrance (full-on ou progressive, 140 à 150 BPM), en couches qui s'épaississent avec les vagues et se vident au break avant le drop. En V0, la musique est synthétisée dans le navigateur (Web Audio), ce qui règle la question des droits et du poids.
- Effets : courts, tonals, dans la gamme du morceau. Les ennemis sont sourds (bruits mats, étouffés), les joueurs brillants (sons synthétiques, aigus).
- Droits : uniquement des pistes libres (CC0, CC-BY) ou composées pour le jeu. Aucun morceau commercial.

## Typographie

- Titre : une display géométrique arrondie, dans l'esprit des flyers de festival. Candidats sous licence OFL : Bungee, Audiowide, Righteous.
- Interface : une sans-serif lisible et chaleureuse. Candidats : Nunito, Inter.
- Polices auto-hébergées dans le dépôt, jamais chargées depuis un service tiers. En attendant le choix, la police système.
- Choix à faire à l'écran, puis à figer ici.

## Interface

- Diégétique quand c'est possible : la vie du noyau est le VU-mètre de la scène, le déroulé des vagues est le line-up du soir, la classe est le bracelet du festivalier.
- Peu d'éléments, grands et lisibles à distance : en coop on lit l'écran d'un ami.
- Entièrement navigable à la manette et au tactile, pas seulement à la souris.

## Ton et écriture

- En français, tutoiement, registre festival : line-up, drop, sound system, chill, care, roadie, déco, sunrise.
- Humour bienveillant. Les bad vibes portent des noms de galères de festival : le Relou, la Pluie, la Batterie à plat, le Couvre-feu, le Vigile de mauvais poil.
- Aucune référence aux drogues ni à l'alcool. Le jeu parle de musique, de lumière et d'amis.

## Accessibilité visuelle

Un jeu de lasers et de stroboscopes doit protéger les personnes photosensibles.

- Jamais plus de trois flashs plein écran par seconde (WCAG 2.3.1). Les flashs sont localisés, jamais sur toute la surface.
- Un **mode calme** désactive stroboscopes, secousses d'écran et halos forts, et réduit la pulsation. Il est proposé au premier lancement et suit `prefers-reduced-motion`.
- Contraste du texte d'au moins 4,5:1 sur `night` et `ink`.
- Les informations de jeu passent par la forme et la position avant la couleur.

## Références

- Festivals : Ozora (Dádpuszta, Hongrie) pour la scène principale en bois et les décos ; Boom (Idanha-a-Nova, Portugal) pour le Dance Temple, l'Alchemy Circle et le lac.
- Art : string art UV, mandalas, visuels de VJ (fractales, kaléidoscopes), flyers de soirées psytrance.
- Jeux : Vampire Survivors et Megabonk (lisibilité d'une horde), Geometry Wars (vecteurs lumineux sur fond noir), Hyper Light Drifter (néon sur nuit), Nova Drift.
