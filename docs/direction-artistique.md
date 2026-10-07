# Direction artistique

Ozoboom se passe dans un festival de psytrance, vu du ciel, sur la rive d'un lac. Références : Ozora (Hongrie) et Boom (Portugal), dont le nom du jeu est le mot-valise. Direction « Cycle du soleil », choisie le 2026-10-04 parmi onze maquettes jouables ; personnages et bad vibes choisis le même jour sur maquettes.

## Intention

Une partie est un set, du coucher au lever du soleil. La lumière dit où en est la partie : crépuscule à l'ouverture, nuit au cœur du set, aube à l'approche de la fin, plein jour au sunrise de la victoire. Le sol est la rive du lac de Boom : herbe sèche, eau qui reflète le ciel, arbres dont l'ombre tourne avec le soleil, lucioles la nuit. Le décor et l'interface parlent en géométrie sacrée or et turquoise, au trait fin. L'ambiance est psychédélique et joyeuse, jamais sombre ni horrifique : les ennemis sont des « bad vibes », des masques gris de mauvaises humeurs, et les chasser, c'est leur rendre le sourire et relancer la fête.

Trois mots pour trancher un doute : **lumineux, rythmé, bienveillant**.

## Lumière et couleur

Règle de lecture : **ce qui est à nous est vivant, coloré et net ; ce qui est hostile est sombre, terne et à contre-jour.** La nuit, nos éléments émettent de la lumière (mélange additif, halos). Le jour, ils gardent leur saturation et un contour sombre (mélange normal, halos réduits de moitié). Les ennemis sont des silhouettes sombres bordées de la lumière de l'heure (« Contre-jour », choisi le 2026-10-05) : le liseré clair les détache du sol la nuit, le corps sombre le jour, et leur silhouette tient 3:1 sur tout sol à toute heure (`src/render/ground.test.ts`). Ils explosent en couleur quand ils meurent.

La palette suit la progression du set et s'interpole en continu entre quatre moments : crépuscule au début, nuit de 25 à 60 %, aube à 85 %, plein jour au sunrise. Valeurs de départ, à valider à l'écran.

| Jeton          | Crépuscule | Nuit      | Aube      | Plein jour | Usage                           |
| -------------- | ---------- | --------- | --------- | ---------- | ------------------------------- |
| `sol`          | `#2a1830`  | `#060a1c` | `#e9c9b6` | `#efe2c2`  | fond, jamais de noir pur        |
| `sol-clair`    | `#5a2c48`  | `#101a3c` | `#f8e3d2` | `#fbf3dc`  | piste de danse, surfaces        |
| `or`           | `#f0b050`  | `#d9a441` | `#b07a1a` | `#a8781f`  | géométrie sacrée, interface     |
| `turquoise`    | `#5fd0c8`  | `#3fd0c9` | `#1c8a86` | `#1f8a84`  | eau, lumière, accents           |
| `noyau`        | `#ffc860`  | `#ffd27a` | `#d68400` | `#c98a12`  | la scène et son volume          |
| `mage`         | `#ff6fa8`  | `#ff6fa8` | `#a61d56` | `#b8246a`  | Luxiole, laser                  |
| `tank`         | `#ff9a3d`  | `#ff9a3d` | `#973a0d` | `#a64713`  | Nounours                        |
| `healer`       | `#7cf2b0`  | `#7cf2b0` | `#126346` | `#14724d`  | Hygie, brumisateur              |
| `bad-vibe`     | `#5a4c64`  | `#4b4762` | `#6c6276` | `#66606e`  | zones des ennemis               |
| `bad-vibe-rim` | `#f2c4a0`  | `#b8c4ee` | `#fff0e4` | `#fffaf0`  | liseré des masques et des tirs  |
| `texte`        | `#fbeee0`  | `#f6ecd2` | `#2c1e18` | `#2b2010`  | texte courant, toujours lisible |

Chaque classe a sa couleur et sa silhouette : un joueur daltonien doit distinguer les classes et les pièges à la forme seule. La couleur renforce, elle ne porte jamais seule une information.

## Formes

- Vue de dessus, 2D, tout dessiné par le code, sans fichier d'image. La lisibilité d'une centaine d'entités prime sur le détail.
- Noyau, pièges et projectiles : trait fin à double contour, en géométrie sacrée (hexagramme pour la scène).
- Joueurs : festivaliers vus du ciel, « Arts du festival », choisis le 2026-10-04 et rendus « juicy » le 2026-10-07 (maquettes VJ-6, RO-10, CA-7). Chacun porte un objet qui dit sa classe sans la couleur : la Luxiole fait tourner des poi (deux boules en orbite), le Nounours porte un gros sac de camping (tapis roulé, mug accroché, bob sur la tête), l'Hygie marche sous un parasol rayé à pompons (disque à secteurs). Le viseur est un trait fin devant le personnage.
- Vie des joueurs, calée sur le temps et rendue seulement : la Luxiole a cinq rubans dans les cheveux sur ressort, une boule fouette vers la cible à chaque tir et sa nova ouvre un mandala qui tourne ; le Nounours fait un pas lourd par temps (poussière, onde au sol), son sac rebondit en retard et le mug se balance ; l'Hygie fait un petit bond par temps, ses baskets dépassent, ses pompons s'allument en chenillard (fixes en mode calme) et une flaque de lumière la suit la nuit, une ombre fraîche le jour. Tout est pré-dessiné : aucune image perdue au banc à quatre joueurs.
- À plusieurs : le nom du joueur flotte au-dessus de lui, en Space Grotesk, à taille d'écran constante, dans la couleur de sa classe (fond sombre la nuit, contour sombre le jour) ; il n'y en a pas en solo. Un allié à terre garde sa teinte grise, un anneau de perles à la couleur de sa classe se remplit pendant la relève, un halo doux s'ouvre quand il se relève. Un joueur hors de l'écran est signalé par une flèche au bord, dans la couleur de sa classe. La caméra qui cadre tout le monde recule jusqu'aux trois cinquièmes de l'échelle d'un joueur, puis les flèches prennent le relais.
- Bad vibes : des masques sombres de mauvaises humeurs, bordés d'un liseré clair, aux traits et aux yeux clairs, un visage par sorte (voir le bestiaire de `game-design.md`), reconnaissable en un coup d'œil à 16 pixels : la forme du masque et la bouche portent l'identité, les yeux l'intention. Chassée, une bad vibe sourit un temps puis éclate en couleurs. Les grandes figures des drops sont des masques plus grands et plus sévères.
- Festivalier en détresse : masque pâle et inquiet, croix de soin qui pulse au-dessus. Il n'est pas sombre : c'est quelqu'un à aider.
- Décor : rive du lac, arbres, ombres portées selon la position du soleil, reflets sur l'eau, lucioles la nuit.
- Les pièges ressemblent au matériel de festival : caisson de basse, laser, brumisateur, déco UV, stroboscope.
- Pièges, couleur de leur effet : caisson `turquoise`, laser `mage`, brumisateur `healer`, déco UV `or`, stroboscope `texte`. Le niveau se lit à son nombre de traits sous la silhouette. Ramassables : vibes `or`, watts `turquoise`. Noyau : la part allumée de l'anneau extérieur `or` est la vie restante.
- Effets du Nounours et de l'Hygie, dans la couleur de leur classe : la charge laisse une comète derrière le Nounours et un anneau qui se resserre sur les bad vibes attirées, qui clignotent un temps (en couleur `or`, au plus un clignotement par temps) ; le soin est un anneau qui s'élargit, un reflet `healer` sur chaque allié soigné et un halo sur le noyau réparé ; une gerbe sur chaque allié relevé. En mode calme : pas de clignotement (la bad vibe garde un éclairage fixe), intensité réduite de moitié, durées allongées, moins d'éclats.
- Agrès de cirque : une silhouette par agrès, faite de traits et de cercles, la couleur de sa classe en renfort. Le ruban arc-en-ciel est le seul objet arc-en-ciel permanent du jeu.
- Enceintes annexes : un stack gris et son câble, éteint ; un anneau qui se remplit sur le temps pendant le branchement ; une fois branchée, l'enceinte émet comme le noyau, dans sa couleur (Dôme chill `healer`, Forêt `turquoise`, Sub `or`, Cercle acid `mage`).

## Rythme

Le tempo est celui du full-on psytrance : **145 BPM**. Un temps dure 413,8 ms, une mesure (4 temps) 1,655 s, une phrase de 16 mesures 26,5 s.

Tout ce qui bouge est calé dessus : le noyau pulse sur le kick, les pièges tirent sur le temps, les vagues arrivent sur la mesure, le boss sur le drop. Les durées d'animation s'expriment en temps et en mesures, pas en millisecondes. Le module `src/shared/tempo.ts` est la source unique de ces conversions. L'heure, elle, avance avec le set entier : lente, elle ne pulse jamais.

## Son

- Musique : psytrance (full-on ou progressive, 140 à 150 BPM), en couches qui s'épaississent avec les vagues et se vident au break avant le drop. En V0, la musique est synthétisée dans le navigateur (Web Audio), ce qui règle la question des droits et du poids.
- Effets : courts, tonals, dans la gamme du morceau. Les ennemis sont sourds (bruits mats, étouffés), les joueurs brillants (sons synthétiques, aigus).
- Droits : uniquement des pistes libres (CC0, CC-BY) ou composées pour le jeu. Aucun morceau commercial.

## Typographie

- Titre : Cinzel Decorative. Interface : Space Grotesk. Les deux sous licence OFL.
- Polices auto-hébergées dans le dépôt, jamais chargées depuis un service tiers.

## Interface

- Style « galets doux » : panneaux arrondis et translucides, jauges en dégradé or et turquoise, couleurs qui suivent l'heure.
- Diégétique quand c'est possible : la vie du noyau est le VU-mètre de la scène, le déroulé des vagues est le line-up du soir, la classe est le bracelet du festivalier.
- Peu d'éléments, grands et lisibles à distance : en coop on lit l'écran d'un ami.
- Entièrement navigable à la manette et au tactile, pas seulement à la souris.

## Ton et écriture

- En français, tutoiement, registre festival : line-up, drop, sound system, chill, care, roadie, déco, sunrise.
- Humour bienveillant. Les bad vibes portent des noms de relous que l'on croise en festival : le Random, le Désagréable, le Méprisant, le Mâle alpha, le Collant, le Fatigué, le Zombie du petit matin ; les boss, des noms de galères : le Couvre-feu, la Batterie à plat.
- On se moque d'un comportement, jamais d'une personne ni d'un groupe. L'Intolérant est montré par ce qu'il fait (il éteint les couleurs autour de lui), sans caricature de ceux qu'il vise et sans symbole barré.
- Aucune référence aux drogues ni à l'alcool. Le jeu parle de musique, de lumière, de nature et d'amis. Quelqu'un qui ne va pas bien, on l'aide, on ne le chasse pas : c'est le Festivalier en détresse.

## Accessibilité visuelle

Un jeu de lasers et de stroboscopes doit protéger les personnes photosensibles.

- Jamais plus de trois flashs plein écran par seconde (WCAG 2.3.1). Les flashs sont localisés, jamais sur toute la surface.
- Un **mode calme** désactive stroboscopes, secousses d'écran et halos forts, et réduit la pulsation. Il est proposé au premier lancement et suit `prefers-reduced-motion`.
- Contraste du texte d'au moins 4,5:1 sur `sol` et `sol-clair`, vérifié à chacun des quatre moments du cycle.
- Les informations de jeu passent par la forme et la position avant la couleur.

## Références

- Festivals : Ozora (Dádpuszta, Hongrie) pour la scène principale en bois et les décos ; Boom (Idanha-a-Nova, Portugal) pour le lac, le Dance Temple et l'Alchemy Circle.
- Art : géométrie sacrée, flyers de soirées psytrance, ciels de coucher et de lever du soleil.
- Jeux : Alba et Sky : Children of the Light (lumière du jour qui change), Journey, Vampire Survivors et Megabonk (lisibilité d'une horde).
