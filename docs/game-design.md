# Game design

Document vivant. Ce qui est **tranché** est marqué ainsi, le reste est une proposition qui tient jusqu'à ce qu'un prototype la confirme ou l'infirme. Les décisions coûteuses à défaire vont dans `adr/`.

## Concept

Survivor plus défense de noyau, en coop. **Tranché le 2026-10-04.**

Une partie est une nuit de festival. De 1 à 4 joueurs défendent la scène principale et son sound system contre des vagues de bad vibes de plus en plus puissantes. Les personnages montent en puissance au même rythme. La partie est gagnée au lever du soleil (fin du set), perdue quand la musique s'arrête (noyau à zéro).

Deux manières de tuer, **tranchées** : tirer directement sur les ennemis, et poser des pièges qui protègent le noyau.

## Sensation recherchée

- Le début est fragile : on recule, on choisit où mettre le premier caisson.
- Le milieu est le crescendo : des centaines d'ennemis, des lasers partout, des choix d'amélioration qui s'empilent.
- Le drop est le pic : le boss arrive, la musique se vide puis explose, l'équipe tient ou craque.
- Le sunrise est la récompense : silence, lumière, score.

## Boucle de jeu

Une partie dure 15 à 25 minutes et suit le set : des phrases de 16 mesures (26,5 s à 145 BPM) forment la montée, puis un break et un drop closent chaque palier, avec un boss sur le drop. Le déroulé du set est visible à l'écran comme un line-up : les joueurs savent quand le drop tombe.

Moment à moment :

1. Se déplacer, viser, tirer. Les ennemis convergent vers le noyau et attaquent les joueurs qui les gênent.
2. Ramasser les vibes (expérience) laissées par les ennemis. Un niveau offre trois améliorations tirées au sort, on en prend une.
3. Dépenser les watts (ressource de défense, produite par la scène à chaque mesure et lâchée par certains ennemis) pour poser ou améliorer des pièges.
4. Au break, souffler : soigner, réparer la scène, replacer les pièges.

## Le noyau

La scène principale et son sound system. Sa vie est son volume. Les ennemis le ciblent par défaut. Il produit des watts à chaque mesure. Il peut être réparé (par le healer surtout). S'il tombe à zéro, la musique s'arrête : partie perdue.

## Les ennemis : bad vibes

Des masques sombres de mauvaises humeurs : les relous que l'on croise en festival. Bestiaire **tranché le 2026-10-04** ; chaque sorte a un déplacement (nuée, rapide, lourd, à distance, boss) et au plus un effet spécial, qui est une donnée pointant sur un module de la sim.

| Bad vibe           | Déplacement | Effet spécial                                                                  | Arrive          |
| ------------------ | ----------- | ------------------------------------------------------------------------------ | --------------- |
| le Random          | nuée        | aucun : faible, mais partout                                                   | palier 1        |
| le Désagréable     | rapide      | bouscule : repousse le joueur qu'il touche                                     | palier 1        |
| le Méprisant       | à distance  | ses soupirs ralentissent le joueur touché                                      | palier 1        |
| le Mâle alpha      | lourd       | pousse les pièges (le lourd de base)                                           | palier 1        |
| le Collant         | rapide      | s'accroche à un joueur et le ralentit jusqu'à ce qu'on le décroche             | palier 1        |
| l'Intolérant       | nuée lente  | éteint les bonus des joueurs dans sa zone ; à viser en priorité                | palier 2        |
| l'Arnaqueur        | rapide      | file vers les vibes au sol, les vole et s'enfuit ; les rend quand on le chasse | palier 2        |
| le Fatigué         | nuée lente  | bâillement contagieux : ralentit les joueurs proches, puis s'endort sur place  | palier 2        |
| le Filmeur         | à distance  | son écran éblouit doucement une zone, sans flash                               | palier 2        |
| le Bavard          | à distance  | ses bulles masquent un bout de l'écran                                         | palier 2        |
| le Zombie          | lourd       | le zombie du petit matin : se relève une fois                                  | dernière phrase |
| le Couvre-feu      | boss        | arrive sur le premier drop                                                     | drop 1          |
| la Batterie à plat | boss        | arrive sur le dernier drop                                                     | drop 2          |

Un boss avance toujours vers la scène : pièges, armes et compétences peuvent le ralentir, jamais le repousser, l'attirer ni le retenir.

La variété monte avec le set : chaque phrase amène une sorte nouvelle au moins, et un set plus long ajoute des paliers et des sortes. Les ennemis montent en puissance avec les joueurs : chaque phrase augmente leur vie, leur vitesse et leur nombre selon une courbe définie dans les données.

**Le Festivalier en détresse** n'est pas une bad vibe. Il apparaît dans la foule à partir du palier 2 : un joueur qui reste une mesure à son contact, ou un soin de zone, l'aide, et toute l'équipe gagne des vibes. Si une bad vibe l'atteint avant, il s'en va et l'équipe en perd. Le care l'aide plus vite.

Les bad vibes visent le noyau. Elles se retournent contre un joueur seulement s'il entre dans leur rayon d'aggro, et le lâchent au-delà de deux rayons. Tirer de loin ne provoque pas de poursuite : attirer les ennemis est le rôle du tank. **Tranché le 2026-10-04.**

## Les classes

Trois classes complémentaires, **tranchées** : mage, tank, healer. Chacune fait une chose que les autres font mal. Habillage festival, **tranché le 2026-10-05** : la VJ, le roadie, le care.

| Classe | Habillage          | Rôle                                   | Penche vers | Couleur      |
| ------ | ------------------ | -------------------------------------- | ----------- | ------------ |
| Mage   | la VJ, le chaman   | dégâts de zone à distance, fragile     | tirer       | `uv-magenta` |
| Tank   | le roadie, la sécu | tient la ligne, attire, bouclier, lent | piéger      | `sun-orange` |
| Healer | le bénévole care   | soigne, répare la scène, ralentit      | piéger      | `uv-lime`    |

- En solo chaque classe doit rester jouable, en coop elle brille. L'équilibrage se règle dans les données, jamais dans la logique.
- Chaque classe a : une attaque de base, une compétence active, et un ultime déclenché sur le drop. La VJ : nova et laser show. Le roadie : attaque courte qui repousse, charge qui attire à l'arrivée les bad vibes autour de lui, flight case (barrière qui encaisse un nombre de coups puis se brise) en ultime. Le care : soin de zone qui répare la scène, rappel (relève à mi-vie les alliés à terre et soigne les autres, dans un grand rayon) en ultime.
- Les classes, ennemis, pièges et améliorations sont des données déclaratives (voir `architecture.md`), pour itérer vite.

## Les pièges

Du matériel de festival, posé avec des watts, qui agit sur le temps musical :

| Piège            | Effet                                               |
| ---------------- | --------------------------------------------------- |
| Caisson de basse | onde de choc sur le kick, repousse                  |
| Laser            | ligne de dégâts continue, orientable                |
| Brumisateur      | zone qui ralentit les ennemis et soigne les joueurs |
| Déco UV          | attire les ennemis, les marque (dégâts bonus)       |
| Stroboscope      | étourdit sur le drop                                |

Nombre d'emplacements limité, un de plus par niveau de Volume. Un piège posé se renforce avec des watts. Les lourds peuvent pousser ou casser un piège.

## Progression dans la partie

- Expérience partagée entre les joueurs : les vibes ramassées vont à toute l'équipe, tout le monde monte de niveau en même temps, chacun choisit son amélioration. **Tranché le 2026-10-05.**
- Améliorations de quatre familles : classe (compétences), générique (vitesse, portée, vie), défense (pièges), relique (uniques, lâchées par les boss). Des synergies entre familles font les grosses parties.
- Raretés : commun, rare, légendaire, la même amélioration avec de plus gros chiffres. Le Volume 2 ouvre les rares, le Volume 3 les légendaires.
- Pas de méta-progression entre parties dans les premières versions. Un déblocage cosmétique est envisageable plus tard.

## Enceintes annexes et Volume

**Tranché le 2026-10-04.** La nuit monte toute seule ; le joueur peut pousser le son lui-même, plus dur tout de suite, plus puissant ensuite, fatal s'il le fait trop tôt.

- Quatre stacks éteints au bord de l'arène : le Dôme chill, la Forêt, le Sub, le Cercle acid. Un joueur qui reste deux mesures dedans la branche, sans menu. Indestructibles.
- Chaque enceinte branchée ajoute un niveau de **Volume**, commun à l'équipe et définitif jusqu'au sunrise.

| Par niveau de Volume | Coût, immédiat                    | Gain, cumulatif                           |
| -------------------- | --------------------------------- | ----------------------------------------- |
| Bad vibes            | +25 % de vie, +25 % d'apparitions | +25 % de vibes                            |
| Tirage               | -                                 | Volume 2 : rares ; Volume 3 : légendaires |
| Pièges               | -                                 | +1 emplacement                            |
| Boss                 | +25 % de vie                      | une relique de plus au choix              |
| Score                | -                                 | x (1 + 0,25 par niveau)                   |

Chaque enceinte a sa couche musicale, son aura et l'agrès qu'elle ouvre au tirage :

| Enceinte       | Aura autour d'elle                 | Couche                   | Ouvre               |
| -------------- | ---------------------------------- | ------------------------ | ------------------- |
| le Dôme chill  | brume qui soigne les joueurs       | nappe, voix lointaine    | assiettes chinoises |
| la Forêt       | les bad vibes ralentissent         | frappes boisées, oiseaux | monocycle           |
| le Sub         | onde de choc sur chaque kick       | sub-basse                | totem               |
| le Cercle acid | marque les bad vibes qui y dansent | ligne acide              | bâton du diable     |

Les quatre branchées ouvrent le ruban arc-en-ciel et les fusions B2B. Le Volume ne change pas la liste des bad vibes : les paliers du set décident qui arrive.

## Agrès de cirque

**Tranché le 2026-10-04.** La classe garde son attaque, à la main. En plus, jusqu'à trois agrès automatiques, proposés dans les cartes de niveau avec les améliorations. Aucun au départ : le début reste fragile. Chacun tire sur sa place dans la mesure, en doubles croches, ou en continu ; visée automatique vers la bad vibe la plus proche. Un agrès de ta classe sort deux fois plus souvent au tirage. En coop, chacun ses agrès.

| Agrès               | Classe | Rythme                                | Effet                                                                                        |
| ------------------- | ------ | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| bâton de feu        | tank   | chaque temps                          | tournoie devant toi et frappe en arc                                                         |
| bâton du diable     | mage   | sur la basse, 3 doubles après le kick | chaque frappe projette une étincelle qui traverse les bad vibes                              |
| cerceaux            | mage   | chaque demi-mesure                    | un cerceau tourne autour de toi et repousse ce qui le touche ; sur le 1 et le 3 il s'élargit |
| diabolo             | mage   | lancé sur le 1, retombe sur le 3      | retombe au milieu des bad vibes, onde à l'impact                                             |
| frisbee             | healer | sur le 2 et le 4                      | frappe à l'aller, revient vers un allié et le soigne (vers toi en solo)                      |
| assiettes chinoises | healer | sur le 3                              | zones posées au sol qui ralentissent les bad vibes et soignent les alliés, trois au plus     |
| totem               | tank   | toutes les 2 mesures                  | planté au sol, attire les bad vibes puis les repousse d'une onde                             |
| éventails de feu    | tank   | continu                               | deux éventails tournent autour de toi sans arrêt                                             |
| monocycle           | healer | continu                               | tu roules plus vite, ta traînée ralentit les bad vibes et soigne les alliés qui la suivent   |
| ruban arc-en-ciel   | aucune | contretemps                           | marque toute bad vibe qu'il traverse : elle prend plus de dégâts de toute l'équipe           |

**Fusions B2B** : un agrès au niveau maximal plus une amélioration au maximum, l'agrès évolue. Diabolo + Double faisceau : pluie de diabolos sur le drop. Cerceaux + Nova XXL : anneaux solaires, trois cerceaux dont chaque élargissement est une nova. Totem + Sub renforcé : totem sono, une onde sur chaque kick. Bâton de feu + Jambes de danseur : double bâton. Frisbee + Bonnes ondes : trois frisbees qui se font des passes. Ruban + Double tempo : arc-en-ciel sur le drop, il traverse l'écran et marque tout. Monocycle + Deuxième souffle : la traînée répare la scène.

**Reliques de boss** : le boss du drop lâche un choix parmi trois objets de scène uniques, une relique de plus au choix par niveau de Volume. En V0.1 une relique est une grosse combinaison d'améliorations ; des effets uniques viendront ensuite.

Les nombres sont des points de départ, à régler dans `src/data/` en jouant.

## Rythme et musique

- 145 BPM, source unique de temps pour le jeu, les pièges, les spawns, l'audio et l'interface (voir `direction-artistique.md`).
- Le set est découpé en paliers. Chaque palier : montée (vagues), break (répit), drop (boss). Le dernier palier mène au sunrise.
- La difficulté augmente par phrase, les boss par palier.

## Contrôles

Pris en charge dès la V0 pour le clavier et la manette, **tranché le 2026-10-04** :

| Support                                                              | Déplacement                                                       | Visée                                           | Tir                   | Pièges                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| Clavier et souris                                                    | ZQSD en AZERTY, WASD en QWERTY (mêmes touches physiques), flèches | souris                                          | clic gauche ou touche | molette ou touches numériques pour choisir, clic droit pour poser |
| Manette (Xbox et toute manette au mapping standard de l'API Gamepad) | stick gauche                                                      | stick droit (twin-stick), assistance à la visée | gâchette droite       | LB et RB pour choisir, bouton A pour poser sous soi               |
| Tactile (V1)                                                         | joystick virtuel gauche                                           | automatique                                     | automatique           | bouton et glisser-déposer                                         |

- Les menus et l'écran de fin se parcourent entièrement à la manette, à la croix comme au stick gauche : une poussée franche au-delà de 0,6 sur l'axe dominant vaut un appui, le stick revient sous 0,3 avant le suivant, et le maintien répète comme la croix (400 ms, puis toutes les 120 ms).
- Au clavier, les menus se parcourent aux flèches ou ZQSD et se valident avec Entrée. Espace ne sert qu'au tir : sans effet dans les menus, hors zone de texte.
- Les commandes se remappent (V1).
- La vibration de la manette suit le kick et les impacts, désactivable.

## Coop

- 2 à 4 joueurs. **Coop locale et coop en ligne en V0.2**, décidé le 2026-10-05 : en local, le clavier et la souris comptent pour un joueur et chaque manette pour un autre ; en ligne, un lien d'invitation, sans compte, pair à pair avec le navigateur d'un joueur qui fait l'hôte et fait foi (ADR 0007).
- Un allié à terre se relève par un coéquipier qui reste une mesure à son contact, deux temps pour le care ; il revient avec la moitié de sa vie. Tous à terre, la scène est seule : la partie finit vite.
- Vibes, watts et Volume sont d'équipe, le noyau est commun. La difficulté monte avec le nombre de joueurs (apparitions et vie des bad vibes, données du set). Cible mesurée sans écran (`pnpm balance`) : une équipe de N joueurs de la même classe tient autant de phrases que cette classe seule, à plus ou moins une ; chaque classe seule tient au moins autant que la VJ moins une phrase ; trois classes différentes tiennent au moins autant que trois VJ.
- Chaque joueur porte un nom libre, affiché au-dessus de lui et dans le HUD. En ligne, chacun suit son personnage à la caméra ; en local, la caméra cadre tout le monde.

## Classement public

Souhaité le 2026-10-04. Classe des parties, pas des joueurs.

- Chaque jour, une **soirée du jour** : une graine commune à tout le monde, donc des parties comparables. Un classement par jour et un classement général.
- Score d'une partie : phrases tenues, temps de survie, puis kills et vie restante du noyau. Composition d'équipe et graine affichées.
- Pseudonyme libre, filtre de modération, pas de compte. Top 100 visible dans le jeu.
- Les scores sont vérifiés en rejouant la partie côté serveur à partir de la graine et des commandes des joueurs (voir `architecture.md`). Cela arrête la triche ordinaire, pas la triche déterminée : c'est le niveau visé pour un jeu entre amis.

## Références et concurrence

Étudiées le 2026-10-04. Dungeon Defenders (noyau, classes, construction et combat), Orcs Must Die! Deathtrap (pièges, roguelite, 4 joueurs), Sanctum 2, Vampire Survivors et Megabonk (boucle survivor). Ce qui semble libre : la sensation survivor combinée à la défense d'un noyau, dans le navigateur, avec des parties courtes que l'on rejoint par un lien.

## Questions ouvertes

- Visée automatique ou manuelle par défaut au clavier ? Proposé : manuelle à la souris, assistée à la manette, automatique au tactile.
- Un ou plusieurs noyaux par carte ? Proposé : un seul dans les premières versions.
- Taille de la carte : écran fixe ou défilement ? Proposé : un peu plus grand que l'écran, caméra qui suit.
