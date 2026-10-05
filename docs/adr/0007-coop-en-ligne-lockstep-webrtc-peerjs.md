# 0007 - Coop en ligne en lockstep séquencé par l'hôte, sur WebRTC via PeerJS

- **Statut :** accepté
- **Date :** 2026-10-05

## Contexte

Le jeu est pensé pour 2 à 4 amis qui rejoignent une partie par un lien, sans compte (piliers 1 et 2), sans serveur de jeu dans les premières versions (`vision.md`) et hébergé en statique (ADR 0005). La simulation est déterministe et ne consomme que des commandes par tick (ADR 0003) : `PlayerCommand` a été dessiné pour voyager. `architecture.md` laissait deux variantes ouvertes, hôte autoritaire ou lockstep. Un tick coûte 0,2 à 0,4 ms et l'état tient des centaines d'entités (#66). Constantin, le 2026-10-05 : tester d'abord le pair à pair WebRTC ; si l'essai déçoit, étudier d'autres voies.

## Décision

- **Étoile autour de l'hôte.** Le navigateur d'un joueur est l'hôte et fait foi. Chaque invité tient avec lui un canal de données WebRTC fiable et ordonné.
- **Mise en relation par le courtier public PeerJS** (bibliothèque `peerjs`, serveur `0.peerjs.com`), STUN public, sans TURN. Le code de salon, six caractères, est l'identifiant PeerJS de l'hôte.
- **Lockstep séquencé par l'hôte.** À chaque tick, l'hôte assemble la trame : sa commande et la dernière reçue de chaque invité, ou son entrée précédente sans action. Il la simule et la diffuse. Les invités ne simulent que les trames reçues, dans l'ordre, derrière un tampon de deux ticks : vide, ils attendent ; trop plein, ils rattrapent. L'hôte n'attend jamais.
- **Garde-fous.** Même version du jeu exigée à l'entrée ; empreinte d'état échangée à chaque mesure ; divergence égale arrêt explicite. Ni reprise de connexion ni migration d'hôte.
- **Frontières.** Le transport est une interface de `src/net/` dont PeerJS est l'implémentation ; le lockstep est du TypeScript pur, testé sur un transport en mémoire.

## Alternatives écartées

- **Hôte autoritaire à instantanés ou différences d'état.** Robuste aux divergences, mais sérialiser des centaines d'entités à 29 Hz coûte en bande passante et en code (différences, interpolation côté client), et le client devrait de toute façon prédire pour se sentir réactif. Le déterminisme est déjà payé, autant l'encaisser.
- **Lockstep avec rollback (GGPO).** La meilleure sensation, mais il faut copier et restaurer l'état, que la sim modifie en place, et rejouer plusieurs ticks par image. Faisable plus tard au vu des coûts mesurés : c'est la suite si le retard ressenti déçoit.
- **Serveur de jeu dédié ou relais WebSocket.** Un serveur à tenir, ce que la vision refuse dans les premières versions ; un relais ajoute un saut à chaque message.
- **Mise en relation à soi** (relais sur le homelab via Kamal, ou Cloudflare Worker). Plus robuste et sans tiers, mais une pièce à déployer avant de savoir si le pair à pair convient. C'est la première suite si le courtier public déçoit : le protocole PeerJS tourne aussi chez soi (`peer`), une adresse à changer.
- **Codes à copier-coller sans serveur.** Deux allers-retours par joueur et plus de lien.

## Conséquences

Facile : bande passante minuscule (une trame par tick), tests du lockstep en Node, jeu toujours statique, une partie reste un journal de commandes dont le classement vérifié par rejeu profitera. Difficile : chaque pair doit être déterministe (ESLint le tient, un test inter-navigateurs le vérifie) ; l'invité subit sur ses propres gestes l'aller-retour, un tick et le tampon ; sans TURN, certains réseaux (NAT symétriques, 4G) ne se connectent pas ; le courtier public ne garantit rien. On revient dessus si plus d'un essai sur dix ne se connecte pas entre amis (TURN ou courtier à soi), si le retard gêne en jeu (rollback), ou si le courtier tombe souvent (`peer` sur le homelab).
