---
date: 2026-10-04
topic: feedback
---

# Système de retours des joueurs

## Cadre

Constantin veut collecter dès maintenant les retours des joueurs pour nourrir les versions suivantes, avec GitHub comme point d'arrivée unique. Les joueurs sont surtout des amis, beaucoup sans compte GitHub. Le jeu est statique (ADR 0005) et ne peut donc pas tenir de secret.

## Principe

**Un retour est une issue GitHub.** Tous les canaux y mènent, avec les labels `feedback` et `needs-triage`, puis un tri régulier transforme les retours en travail planifié dans un jalon, ou les ferme avec une raison.

```
jeu (bouton « Ton avis ») ---\
formulaire GitHub -----------+--> issue `feedback` `needs-triage` --> tri --> issue de travail dans un jalon
Constantin (vive voix) ------/                                          \-> fermée : doublon ou non retenu
```

## Canaux

| Canal                | Pour qui                      | Comment                                                                | Label de source  |
| -------------------- | ----------------------------- | ---------------------------------------------------------------------- | ---------------- |
| Dans le jeu, étape 1 | joueurs avec un compte GitHub | le jeu ouvre le formulaire `feedback-in-game.yml` pré-rempli par l'URL | `source:in-game` |
| Dans le jeu, étape 2 | tous les joueurs, sans compte | le jeu envoie à un petit service relais qui crée l'issue               | `source:in-game` |
| Formulaire GitHub    | contributeurs                 | « Donner un avis » (`feedback.yml`)                                    | aucun            |
| Direct               | Constantin, ses amis          | un agent crée l'issue depuis une note ou un message                    | `source:direct`  |

## Exigences

**Dans le jeu**

- R1. Bouton « Ton avis » sur l'écran titre, dans la pause et sur l'écran de fin. Jamais pendant l'action.
- R2. Formulaire : type (idée, bug, équilibrage, autre), message (2000 caractères au plus), case « joindre le contexte de la partie » cochée par défaut, contexte affiché en clair avant l'envoi.
- R3. Navigable entièrement à la manette. Le texte se tape au clavier ou au clavier natif du téléphone ; à la manette seule, le type et un message court restent possibles avec le clavier virtuel du système quand il existe.
- R4. Avertissement visible : l'avis sera public sur GitHub. Aucun champ ne demande de donnée personnelle.
- R5. Après l'envoi, le joueur voit le lien de l'issue pour suivre son avis (étape 2), ou le formulaire GitHub s'ouvre dans un nouvel onglet (étape 1). Si l'envoi échoue, le texte n'est pas perdu : bouton « Copier » et nouvel essai.

**Contexte joint**

- R6. Version du jeu (SHA du commit, injecté au build), graine, classe, palier et phrase atteints, tick, statut, score et statistiques de fin, périphérique actif, navigateur et système, taille d'écran, mode calme, images par seconde moyennes. Rien d'autre.
- R7. Le contexte est un bloc texte court qui tient dans une URL (8 000 caractères au plus avec le message). Avec la graine et le SHA, un développeur rejoue la même soirée.

**Service relais (étape 2)**

- R8. `POST /feedback` : valide le schéma et les longueurs, vérifie un jeton anti-robot (Cloudflare Turnstile), limite le débit par adresse IP, neutralise les mentions et les liens (`@` et URL rendus inertes), puis crée l'issue avec les labels de R10 et renvoie son URL.
- R9. Le jeton GitHub vit dans le service, avec le seul droit d'écrire des issues sur ce dépôt (GitHub App ou jeton à grain fin). Jamais dans le jeu.
- R10. Même service que le classement public prévu en V3 (`architecture.md`). Choix d'hébergement par ADR quand on le construit.

**Tri**

- R11. Labels : `feedback`, `needs-triage`, un `type:*` (`idea`, `bug`, `balance`) et un `source:*` posés au tri ou par le formulaire.
- R12. Un tri par semaine, par Constantin ou par un agent selon `AGENTS.md` : chaque `needs-triage` finit soit liée à une issue de travail dans un jalon (le retour reste ouvert jusqu'à la livraison, puis se ferme comme réalisé), soit fermée comme doublon avec le lien, soit fermée « non retenue » avec une phrase qui dit pourquoi.
- R13. Les retours d'équilibrage d'une même version se regroupent dans une issue de travail par version plutôt qu'une par retour.

## Découpage du code

- `src/feedback/` : nouvelle couche DOM, au même niveau que `ui`. `buildFeedbackReport(state, meta)` est pure et testée ; `FeedbackTransport` a deux implémentations, `githubFormLink` (étape 1) et `relay` (étape 2). Les règles ESLint de `ui` s'y appliquent.
- `__APP_VERSION__` défini par Vite à partir de `GITHUB_SHA` en CI, `dev` en local.
- Les formulaires vivent dans `.github/ISSUE_TEMPLATE/`. Le jeu pré-remplit les champs par leur `id` (`type`, `message`, `context`).

## Plus tard

- Réactions rapides sur l'écran de fin (« trop dur », « parfait », « trop facile ») : agrégées par le service et publiées en une issue de synthèse par version, jamais une issue par clic.
- Remercier les joueurs dont un retour a été livré, dans un écran « Nouveautés ».

## Hors périmètre

Comptes joueurs, adresse e-mail, analytics de navigation, outil tiers de feedback (le pilier « pas de collecte de données au-delà du nécessaire » de `vision.md` s'applique).

## Questions ouvertes

- Hébergement du relais : homelab via `deploy-factory` et Kamal, cohérent avec les autres projets de Constantin, ou Cloudflare Workers, sans serveur à entretenir. À trancher par ADR avec le classement (R10).
- Tableau de suivi GitHub Projects : inutile tant que labels et jalons suffisent. Il demanderait le droit `project` sur le jeton `gh`.
