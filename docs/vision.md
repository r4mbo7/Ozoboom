# Vision

Ozoboom est un jeu web léger de survie coopérative. Des amis défendent le sound system d'un festival de psytrance contre des vagues de « bad vibes » de plus en plus puissantes, chacun avec sa classe, jusqu'au lever du soleil.

Projet de loisir de Constantin. Le but est de s'amuser à le construire et d'y jouer entre amis. Le jeu est libre et la version navigateur reste gratuite ; une version payante sur une boutique reste possible ([ADR 0009](adr/0009-licence-gpl-et-nom-protege.md)).

## Piliers

Ces six piliers tranchent les débats. Quand deux options se valent, celle qui sert le mieux les piliers gagne. Un pilier ne change que par un ADR.

1. **Léger.** Le jeu s'ouvre dans un navigateur, sans installation ni compte. Une partie se rejoint par un simple lien. Il tourne à 60 images par seconde sur un portable sans carte graphique dédiée et sur un téléphone de milieu de gamme.
2. **Coopératif avant tout.** Le jeu est conçu pour 2 à 4 joueurs qui se complètent, même quand on y joue seul. Les classes ne font pas la même chose. On ne s'affronte pas entre joueurs : la compétition se joue entre équipes, par un classement public des parties.
3. **La montée en puissance partagée.** Le plaisir central est la courbe : les personnages et les ennemis deviennent de plus en plus forts au fil d'une partie courte (15 à 25 minutes). Chaque niveau offre un choix qui change la façon de jouer.
4. **Deux façons de tenir.** Tirer sur ce qui arrive et poser des pièges pour protéger le noyau. Les deux comptent, chaque classe penche d'un côté.
5. **Le festival est le jeu.** La musique rythme la partie : les vagues tombent sur les mesures, le drop amène le boss. La direction artistique est celle d'un festival de psytrance la nuit. Le ton est joyeux et bienveillant, jamais gore.
6. **Accessible.** Clavier et souris, manette (Xbox et toute manette au mapping standard), tactile. Options pour les personnes photosensibles et daltoniennes.

## Ce que le jeu n'est pas

- Pas de publicité, pas de collecte de données au-delà du classement public. Rien à payer pour jouer dans le navigateur.
- Pas de compte obligatoire. Un pseudonyme suffit pour le classement.
- Pas de 3D, pas de monde ouvert, pas d'histoire à suivre.
- Pas de joueur contre joueur.
- Pas de méta-progression lourde (arbres à débloquer sur des dizaines d'heures). Chaque partie repart de zéro, c'est la partie qui compte.
- Pas de serveur de jeu dédié ni de boutique d'applications dans les premières versions.

## Comment on construit

- **Explorer avant de construire.** Les concepts et la concurrence ont été étudiés le 2026-10-04, avant la première ligne de code (voir `game-design.md`, section Références).
- **Un prototype jouable avant le beau.** La V0 est solo, avec une classe, pour valider la boucle. Le multijoueur vient ensuite, mais l'architecture le prévoit dès le départ.
- **Les décisions coûteuses s'écrivent.** Voir `adr/`.
- **La qualité ne se négocie pas.** Types, lint, tests et CI verts à chaque commit. Voir `../AGENTS.md`.
