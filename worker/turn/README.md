# Worker TURN

Délivre les identifiants du relais TURN Cloudflare et le coupe avant toute facture ([ADR 0010](../../docs/adr/0010-relais-turn-cloudflare-plafonne.md)).

1. Remplir l'identifiant du KV (`wrangler kv namespace create USAGE`) et le `namespace_id` de la limite de débit dans `wrangler.toml`.
2. Créer les secrets, un par un : `wrangler secret put CF_TURN_TOKEN_ID`, `CF_TURN_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_ANALYTICS_REALTIME_TOKEN`.
3. Déployer : `wrangler deploy`.
   Jusqu'à la première mesure de la tâche planifiée (10 minutes au plus), ou dès qu'une mesure a plus de 30 minutes, `/ice` répond 503 et le jeu reste en STUN seul.
4. Après un coupe-circuit (clé supprimée à 800 Go) : le mois suivant, recréer une clé TURN, mettre à jour `CF_TURN_TOKEN_ID` et `CF_TURN_API_TOKEN`, puis `wrangler deploy`.
