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
| `rouge`        | `#ff5a52`  | `#ff5a52` | `#b3261e` | `#be281d`  | la scène en danger              |

Chaque classe a sa couleur et sa silhouette : un joueur daltonien doit distinguer les classes et les pièges à la forme seule. La couleur renforce, elle ne porte jamais seule une information.

### Le filtre des drops

« Nuit fondue », choisie le 2026-10-09 : chaque drop fait fondre le monde un temps, et les personnages restent nets.

- Premier drop : rémanence aux trois quarts de la force, avec des traînées aussi longues qu'au second drop, seulement plus pâles. Nos joueurs, leurs tirs et la scène laissent des échos dont la teinte tourne ; les bad vibes et leurs tirs n'en laissent jamais.
- Second drop et suivants : rémanence à pleine force, et le sol ondule. La couche du sol se tord en vagues et ses traits passent par toutes les teintes ; rien d'autre ne se déforme.
- Le filtre monte sur une mesure au début du drop, tient une phrase et retombe sur quatre mesures, jamais d'un coup. Au pic, le sol reste sombre : le 3:1 des silhouettes et le 4,5:1 du texte tiennent.
- Le second drop tombe à l'aube : de jour, les échos passent en mélange normal, en aplat de teinte plus transparent, sans bord sombre qui virerait au gris ; le sol qui ondule garde sa clarté.
- Le filtre est rendu seulement : il ne change ni l'heure, ni le tempo, ni la simulation.
- Mode calme : pas de rémanence, ondulation lente sans cycle de teintes.

### Le filtre cosmique d'Ambyss

« Traces et voiles », choisi le 2026-10-11 : permanent à Ambyss, rendu seulement, peint sur le décor et sous tout ce qui bouge.

- Traces : sur chaque temps, une ou deux traces fines, comme dans une chambre à brouillard, partent du ciel de l'est en diagonale, s'enroulent deux fois et s'effacent en une mesure ; irisées la nuit, plus sombres le jour.
- Voiles : six voiles de lumière larges glissent lentement, inclinés de 36°, un passage par phrase ; pêche au crépuscule, violets et turquoise la nuit, dorés à l'aube.
- Jamais sur les bad vibes ni sur l'interface : le 3:1 des silhouettes et le 4,5:1 du texte tiennent. Mode calme : pas de traces, voiles immobiles.

## Formes

- Vue de dessus, 2D, tout dessiné par le code, sans fichier d'image. La lisibilité d'une centaine d'entités prime sur le détail.
- Noyau, pièges et projectiles : trait fin à double contour, en géométrie sacrée (dôme géodésique pour la scène).
- Joueurs : festivaliers vus du ciel, « Arts du festival », choisis le 2026-10-04 et rendus « juicy » le 2026-10-07 (maquettes VJ-6, RO-10, CA-7). Chacun porte un objet qui dit sa classe sans la couleur : la Luxiole fait tourner des poi (deux boules en orbite), le Nounours porte un gros sac de camping (tapis roulé, mug accroché, bob sur la tête), l'Hygie marche sous un parasol rayé à pompons (disque à secteurs). Le viseur est un trait fin devant le personnage.
- Vie des joueurs, calée sur le temps et rendue seulement : la Luxiole a cinq rubans dans les cheveux sur ressort, une boule fouette vers la cible à chaque tir et sa nova ouvre un mandala qui tourne ; le Nounours fait un pas lourd par temps (poussière, onde au sol), son sac rebondit en retard et le mug se balance ; l'Hygie fait un petit bond par temps, ses baskets dépassent, ses pompons s'allument en chenillard (fixes en mode calme) et une flaque de lumière la suit la nuit, une ombre fraîche le jour. Tout est pré-dessiné : aucune image perdue au banc à quatre joueurs.
- Avant la partie, chaque perso se montre tel qu'en jeu, zoomé, de nuit : il danse sur le temps à 145 BPM et lance sa compétence toutes les deux mesures. En solo sur l'écran « Choisis ton perso », dans le salon en tête de chaque place ; une place vide montre une silhouette grise.
- À plusieurs : le nom du joueur flotte au-dessus de lui, en Space Grotesk, à taille d'écran constante, dans la couleur de sa classe (fond sombre la nuit, contour sombre le jour) ; il n'y en a pas en solo. Un allié à terre garde sa teinte grise, un anneau de perles à la couleur de sa classe se remplit pendant la relève, un halo doux s'ouvre quand il se relève. Un joueur hors de l'écran est signalé par une flèche au bord, dans la couleur de sa classe. La caméra qui cadre tout le monde recule jusqu'aux trois cinquièmes de l'échelle d'un joueur, puis les flèches prennent le relais.
- Bad vibes : des masques sombres de mauvaises humeurs, bordés d'un liseré clair, aux traits et aux yeux clairs, un visage par sorte (voir le bestiaire de `game-design.md`), reconnaissable en un coup d'œil à 16 pixels : la forme du masque et la bouche portent l'identité, les yeux l'intention. Chassée, une bad vibe sourit un temps puis éclate en couleurs. Les grandes figures des drops sont des masques plus grands et plus sévères.
- Festivalier en détresse : masque pâle et inquiet, croix de soin qui pulse au-dessus. Il n'est pas sombre : c'est quelqu'un à aider.
- Décor de la main stage : rive du lac, arbres, ombres portées selon la position du soleil, reflets sur l'eau, lucioles la nuit.
- Décor du Dome, la scène Dome d'Ozora : sable à dunes et à grain, piste plus claire sous la coupole, teintes de sable aux quatre moments. La coupole est en filigrane pour laisser voir la piste : 24 côtes de bois depuis l'oculus, guirlandes, bande de panneaux peints aux UV, couronne de poteaux au sol. Quatre géants cosmiques à tête de champignon aux diagonales, dos à la scène, joignent leurs mains au-dessus des quatre grandes entrées ; des grappes de champignons luisent la nuit.
- Décor d'Ambyss : butte d'herbe sèche à courbes de niveau, sommet de sable clair, deux sentiers depuis les pointes de la piste, arbres au pied, lumière de l'est forte à l'aube ; piste en amande couverte de coussins rouges en rangs courbes face au noyau, festivaliers assis, une allée sur chaque axe. Teintes de la butte aux quatre moments.
- Toile d'Ambyss : une voile en amande sur deux mâts dans l'axe est-ouest, bords festonnés entre 14 ancrages, coutures des mâts aux ancrages, deux haubans par ancrage jusqu'à des piquets carrés. Très transparente : violette la nuit, ocre le jour ; six spirales peintes (`mage`, `turquoise`, `or`, `tank`, `healer`, violet) s'allument la nuit et s'effacent au jour. Rien n'y est un obstacle.
- Les pièges ressemblent au matériel de festival : caisson de basse, laser, brumisateur, déco UV, stroboscope.
- Pièges, couleur de leur effet : caisson `turquoise`, laser `mage`, brumisateur `healer`, déco UV `or`, stroboscope `texte`. Ramassables : vibes `or`, loot `turquoise` avec l'icône de son piège, et la bad vibe qui le porte en garde un halo. Une vibe aspirée file en comète, étirée, sa traîne `or` virant au `turquoise` ; ramassée, un anneau `or` et cinq étincelles s'ouvrent sur le joueur, qui s'allume d'un halo et d'un liseré `or` (en mode calme : traîne courte, l'anneau seul, halo à mi-force, sans rebond). Bombe : ronde à mèche, `mage`, une étincelle `or` ; déclenchée, une onde part d'elle et balaie toute la piste (une fine onde lente en mode calme). Noyau : la part allumée de l'anneau extérieur `or` est la vie restante.
- Effets du Nounours et de l'Hygie, dans la couleur de leur classe : la charge laisse une comète derrière le Nounours et un anneau qui se resserre sur les bad vibes attirées, qui clignotent un temps (en couleur `or`, au plus un clignotement par temps) ; le soin est un anneau qui s'élargit, un reflet `healer` sur chaque allié soigné et un halo sur le noyau réparé ; une gerbe sur chaque allié relevé. En mode calme : pas de clignotement (la bad vibe garde un éclairage fixe), intensité réduite de moitié, durées allongées, moins d'éclats.
- Agrès de cirque : une silhouette par agrès, faite de traits et de cercles, la couleur de sa classe en renfort. Le ruban arc-en-ciel est le seul objet arc-en-ciel permanent du jeu.
- Enceintes annexes : vues du ciel, un dessin par enceinte (le Dôme chill sous sa bâche, la Forêt en tour de bois, le Sub en mur de son, le Cercle acid en pylône 360°), la bâche et le mur tournés vers la scène ; éteinte, en veille : grise teintée de sa couleur, câblée, une LED de veille à sa couleur allumée le premier temps de chaque mesure (fixe en mode calme) ; à sa droite, une colonne de huit LED s'allume d'une LED par temps pendant le branchement, puis danse sur le temps une fois branchée, la LED du haut blanche la nuit (pleine et fixe en mode calme) ; une fois branchée, l'enceinte émet comme le noyau, dans sa couleur, et trois ondes partent de son avant sur chaque temps, tout autour pour la tour et le pylône ; trois faisceaux balaient son aura, un tour en 8 mesures (Dôme chill `healer`, Forêt `turquoise`, Sub `or`, Cercle acid `mage`).
- Averse de vibes : une vibe lancée par une enceinte vole deux temps en cloche jusqu'à un cercle `or` qui se resserre sur son point de chute. Mode calme : elle apparaît en fondu sur place, sans vol ni cercle.

## Rythme

Le tempo est celui de la scène ([ADR 0012](adr/0012-le-tempo-est-une-donnee-de-la-scene.md)) :

| Scène      | Tempo                          | Temps    | Mesure (4 temps) | Phrase (16 mesures) |
| ---------- | ------------------------------ | -------- | ---------------- | ------------------- |
| Main stage | **145 BPM**, full-on psytrance | 413,8 ms | 1,655 s          | 26,5 s              |
| Le Dome    | **96,7 BPM**, les 2/3 de 145   | 620,7 ms | 2,48 s           | 39,7 s              |
| Ambyss     | **116 BPM**, les 4/5 de 145    | 517,2 ms | 2,07 s           | 33,1 s              |

Tout ce qui bouge est calé dessus : le noyau pulse sur le kick, les pièges tirent sur le temps, les vagues arrivent sur la mesure, le boss sur le drop. Les durées d'animation s'expriment en temps et en mesures, pas en millisecondes. `setTempo(set)` de `src/sim/lineup.ts` donne ces conversions pour la scène jouée. L'heure, elle, avance avec le set entier : lente, elle ne pulse jamais.

## Son

- Musique : chaque scène a ses morceaux. Main stage : psytrance (full-on ou progressive, 140 à 150 BPM). Dome : downtempo, dub et psybient à 96,7 BPM, avec darbouka, riq, ney, oud, kalimba, chœur, sirène dub et bol chantant, sous une réverbe de coupole de 3,6 s. Ambyss : psychill et ambient à 116 BPM joués à mi-tempo, « Sous la voile » en do dorien (basse qui glisse, tambours accordés, maillets à échos, flûte bansuri) et « Les quatre marches » en la mineur (basse qui descend sous une nappe d'harmoniques, piano feutré, voix et violoncelle), à l'écho large, sous une réverbe longue de 4,5 s. En couches qui s'épaississent avec les vagues et se vident au break avant le drop. En V0, la musique est synthétisée dans le navigateur (Web Audio), ce qui règle la question des droits et du poids.
- Effets : courts, tonals, dans la gamme du morceau. Les ennemis sont sourds (bruits mats, étouffés), les joueurs brillants (sons synthétiques, aigus).
- Vibes ramassées : chaque vibe joue, sur la double-croche suivante, la note suivante de l'arpège de l'accord de la mesure ; le timbre s'éclaircit à l'approche du niveau.
- Droits : uniquement des pistes libres (CC0, CC-BY) ou composées pour le jeu. Aucun morceau commercial.

## Typographie

- Titre : Cinzel Decorative. Interface : Space Grotesk. Les deux sous licence OFL.
- Polices auto-hébergées dans le dépôt, jamais chargées depuis un service tiers.

## Interface

- Style « galets doux » : panneaux arrondis et translucides, jauges en dégradé or et turquoise, couleurs qui suivent l'heure.
- L'anneau de niveau glisse, tressaute à chaque vibe et bat sur le temps passé 80 % ; au niveau, un anneau `or` s'ouvre. En mode calme : le glissement seul.
- Les menus par-dessus la partie (amélioration, pause, fin) n'éblouissent pas : de jour, leur fond plafonne sa clarté et vire au sable chaud.
- Diégétique quand c'est possible : la vie du noyau est le VU-mètre de la scène, le déroulé des vagues est le line-up du soir, la classe est le bracelet du festivalier.
- Peu d'éléments, grands et lisibles à distance : en coop on lit l'écran d'un ami.
- Monter de niveau se fête, en temps de la scène : le voile monte sur un temps, les cartes tombent une à une sur les notes de la gamme, la rare puis la légendaire en dernier avec leur reflet, et la musique passe sous l'eau jusqu'au dernier choix.
- Le choix claque sur un temps, puis la carte file vers sa place : l'agrès, sinon l'anneau de niveau ; sur un écran partagé, le bracelet du joueur. À plusieurs, la carte choisie attend au centre de son panneau et toutes partent ensemble.
- Une carte se lit de loin : un médaillon de géométrie sacrée, le rang en perles.
- En mode calme rien ne bouge dans ce menu : cartes posées d'un coup, liseré fixe, perle gagnée au trait épais, choix envoyé aussitôt, emplacement qui s'allume. Les sons restent.
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

- Festivals : Ozora (Dádpuszta, Hongrie) pour la scène principale en bois, les décos et le Dome ; Boom (Idanha-a-Nova, Portugal) pour le lac, le Dance Temple et l'Alchemy Circle.
- Art : géométrie sacrée, flyers de soirées psytrance, ciels de coucher et de lever du soleil.
- Jeux : Alba et Sky : Children of the Light (lumière du jour qui change), Journey, Vampire Survivors et Megabonk (lisibilité d'une horde).
