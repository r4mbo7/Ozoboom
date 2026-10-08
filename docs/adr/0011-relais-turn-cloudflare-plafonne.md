# 0011 - Relais TURN Cloudflare en secours, identifiants délivrés par un Worker plafonné

- **Statut :** accepté
- **Date :** 2026-10-08

## Contexte

L'ADR 0007 a choisi le pair à pair sans TURN. Le 2026-10-07, un invité en France n'a pas pu rejoindre un hôte au Maroc (#248) : courtier et signalisation fonctionnent, mais ICE échoue faute de candidat `relay` (NAT symétrique ou CGNAT), et les TURN par défaut de PeerJS 1.5.5 ne résolvent plus. Un TURN demande des identifiants ; le jeu est statique et ne peut pas garder de secret. Cloudflare n'offre aucun plafond de dépense, seulement des alertes. Constantin, le 2026-10-08 : le relais ne doit jamais pouvoir le faire payer.

## Décision

- **TURN Cloudflare Realtime** sur un compte Cloudflare dédié au jeu (1000 Go gratuits par mois, puis 0,05 $/Go), STUN `stun.cloudflare.com`. ICE garde le direct quand il passe : seules les paires qui échouent consomment du relais. L'ADR 0007 ne change pas autrement.
- **Un Worker `turn`** (plan Workers gratuit, plafonné sans facture), dans `worker/turn/` de ce dépôt, déployé à la main par `wrangler deploy`. `POST /ice` rend les `iceServers` avec des identifiants de 2 heures. Il garde la clé TURN et les jetons d'API en secrets Wrangler ; il n'accepte que l'origine du jeu et limite le débit par IP.
- **Coupe-circuit dans le Worker.** Toutes les 10 minutes, une tâche planifiée lit la sortie TURN du mois (GraphQL, `callsTurnUsageAdaptiveGroups`) et la range en KV. À 500 Go, ou si la dernière mesure a plus de 30 minutes, `POST /ice` refuse ; à 800 Go, le Worker supprime la clé TURN, que Constantin recrée à la main le mois suivant. Alerte budgétaire Cloudflare à 1 $ en filet.
- **Côté jeu,** `VITE_TURN_URL` donne l'adresse du Worker à la construction. À l'ouverture d'un salon, `src/net/peerjs.ts` demande les `iceServers` (3 s au plus) ; sans réponse, refus ou variable absente (tests, développement), il garde STUN seul, comme avant.

## Alternatives écartées

- **Metered Open Relay :** pas de serveur à nous, mais clé publique dans le client et 20 Go par mois ; gardé pour un essai rapide, pas pour durer.
- **coturn sur le homelab :** Cloudflare Tunnel ne transporte pas l'UDP public ; il faudrait ouvrir des ports de la box et exposer l'adresse de la maison. Sur un VPS : coût fixe mais un serveur de plus à tenir, et des identifiants à délivrer quand même.
- **Relais WebSocket (Durable Object sur le plan gratuit, ou homelab via Tunnel) :** connexion garantie et aucune facture possible, mais un nouveau transport et un saut de plus à chaque message, même quand le direct passait. C'est la suite si le TURN ne suffit pas.
- **Carte bancaire plafonnée comme seule garde :** un impayé peut suspendre le compte ; le compte dédié et le coupe-circuit évitent d'en arriver là.

## Conséquences

Facile : un changement limité à la liste ICE, le direct reste la règle, aucun secret dans le dépôt, la facture bornée par le Worker. Difficile : un tiers de plus (le Worker et le TURN Cloudflare), un déploiement manuel, un mois sans relais si le coupe-circuit saute. La documentation ne dit pas si révoquer coupe les relais déjà ouverts : qui abuserait d'identifiants déjà délivrés pourrait encore consommer après 800 Go, mais passer 1000 Go demande plus de 200 Mbit/s soutenus pendant les deux heures de validité. On revient dessus si le coupe-circuit saute, si des essais entre amis échouent encore (relais WebSocket), ou si Cloudflare propose un vrai plafond.
