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

Du brouillard gris qui absorbe la lumière. Archétypes de départ :

| Archétype | Rôle                                  | Nom de travail                    |
| --------- | ------------------------------------- | --------------------------------- |
| Rusher    | rapide, fragile, nombreux             | le Relou                          |
| Horde     | lent, en masse, submerge              | la Foule au bar                   |
| Lourd     | lent, encaisse, pousse les pièges     | le Vigile de mauvais poil         |
| Tireur    | reste à distance, crache sur la scène | la Pluie                          |
| Boss      | arrive sur le drop, mécanique unique  | le Couvre-feu, la Batterie à plat |

Les ennemis montent en puissance avec les joueurs : chaque phrase augmente leur vie, leur vitesse et leur nombre selon une courbe définie dans les données.

## Les classes

Trois classes complémentaires, **tranchées** : mage, tank, healer. Chacune fait une chose que les autres font mal. Habillage festival, proposé :

| Classe | Habillage          | Rôle                                   | Penche vers | Couleur      |
| ------ | ------------------ | -------------------------------------- | ----------- | ------------ |
| Mage   | la VJ, le chaman   | dégâts de zone à distance, fragile     | tirer       | `uv-magenta` |
| Tank   | le roadie, la sécu | tient la ligne, attire, bouclier, lent | piéger      | `sun-orange` |
| Healer | le bénévole care   | soigne, répare la scène, ralentit      | piéger      | `uv-lime`    |

- En solo chaque classe doit rester jouable, en coop elle brille. L'équilibrage se règle dans les données, jamais dans la logique.
- Chaque classe a : une attaque de base, une compétence active, et un ultime déclenché sur le drop.
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

Nombre d'emplacements limité, améliorables. Les lourds peuvent pousser ou casser un piège.

## Progression dans la partie

- Expérience partagée entre les joueurs : tout le monde monte de niveau en même temps, chacun choisit son amélioration. Proposé, à valider en jouant.
- Améliorations de trois familles : classe (compétences), générique (vitesse, portée, vie), défense (pièges). Des synergies entre familles font les grosses parties.
- Pas de méta-progression entre parties dans les premières versions. Un déblocage cosmétique est envisageable plus tard.

## Rythme et musique

- 145 BPM, source unique de temps pour le jeu, les pièges, les spawns, l'audio et l'interface (voir `direction-artistique.md`).
- Le set est découpé en paliers. Chaque palier : montée (vagues), break (répit), drop (boss). Le dernier palier mène au sunrise.
- La difficulté augmente par phrase, les boss par palier.

## Contrôles

Pris en charge dès la V0 pour le clavier et la manette, **tranché le 2026-10-04** :

| Support                                                              | Déplacement                                                       | Visée                                           | Tir                   | Pièges                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| Clavier et souris                                                    | ZQSD en AZERTY, WASD en QWERTY (mêmes touches physiques), flèches | souris                                          | clic gauche ou touche | molette ou touches numériques pour choisir, clic droit pour poser |
| Manette (Xbox et toute manette au mapping standard de l'API Gamepad) | stick gauche                                                      | stick droit (twin-stick), assistance à la visée | gâchette droite       | LB et RB pour choisir, bouton A pour poser devant soi             |
| Tactile (V1)                                                         | joystick virtuel gauche                                           | automatique                                     | automatique           | bouton et glisser-déposer                                         |

- Les menus et l'écran de fin se parcourent entièrement à la manette.
- Les commandes se remappent (V1).
- La vibration de la manette suit le kick et les impacts, désactivable.

## Coop

- 2 à 4 joueurs. **Coop locale en V1** (plusieurs manettes sur un écran, décidé le 2026-10-04), puis **coop en ligne en V2**, par lien d'invitation, sans compte, pair à pair avec le navigateur d'un joueur qui fait l'hôte et fait foi (voir `architecture.md`).
- Un allié à terre se relève par un coéquipier, plus vite par le healer. Tous à terre, la scène est seule : la partie finit vite.
- Expérience et watts partagés. Le noyau est commun.

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
- Expérience partagée ou individuelle en coop ? Proposé : partagée.
