---
date: 2026-10-11
topic: kpi
---

# Ozoboom - KPI d'usage anonymes

## Cadre

Le 2026-10-11, Constantin veut savoir quelle scène est la plus jouée, et plus largement suivre l'usage du jeu, sans données personnelles. Ce qui est permis et l'outil sont décidés dans l'[ADR 0013](../adr/0013-mesures-d-usage-anonymes.md). Un événement décrit une partie, jamais une personne.

## KPI

| Clé | KPI                                                                           | Question                                                                |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| K1  | Part des parties lancées sur la Main stage et sur le Dome                     | Quelle scène est la plus jouée ?                                        |
| K2  | Parties lancées, et part des parties finies (gagnées ou perdues)              | Joue-t-on, et va-t-on au bout d'une partie ?                            |
| K3  | Répartition solo, coop locale, en ligne, et nombre de joueurs                 | Le jeu se joue-t-il à plusieurs, comme le veut le pilier 2 ?            |
| K4  | Part des parties où chaque classe joue, et compositions les plus jouées       | Chaque classe trouve-t-elle ses joueurs ?                               |
| K5  | Répartition du palier atteint, par scène                                      | Jusqu'où va-t-on, la difficulté monte-t-elle comme prévu ?              |
| K6  | Durée médiane d'une partie, par issue                                         | Une partie dure-t-elle les 15 à 25 minutes visées ?                     |
| K7  | Répartition des issues : gagnée, noyau détruit, tous à terre, quittée, coupée | Pourquoi les parties s'arrêtent-elles, la coop en ligne tient-elle ?    |
| K8  | Répartition du périphérique : clavier et souris, manette, tactile             | Sur quoi joue-t-on, quel parcours soigner d'abord ?                     |
| K9  | Parties par version du jeu                                                    | Les joueurs suivent-ils les sorties, un KPI a-t-il bougé à une sortie ? |

Chaque KPI se lit sur une période et se découpe par version (K9) et par scène (K1).

## Événements

Deux événements, et aucun autre. Une partie lancée envoie `start`, puis au plus un `end`. Un `start` sans `end` est une partie fermée en cours (onglet, panne).

| Champ     | Valeurs                                                                                                | `start` | `end` | KPI        |
| --------- | ------------------------------------------------------------------------------------------------------ | ------- | ----- | ---------- |
| `event`   | `start`, `end`                                                                                         | oui     | oui   | K2         |
| `stage`   | `setId` de la partie : `soiree-v0` (Main stage), `dome`                                                | oui     | oui   | K1, K5     |
| `mode`    | `solo`, `local`, `online`                                                                              | oui     | oui   | K3, K7     |
| `players` | 1 à 4                                                                                                  | oui     | oui   | K3         |
| `classes` | identifiants de classe des joueurs, triés, joints par `+`                                              | oui     | oui   | K4         |
| `device`  | périphérique de la machine qui envoie : `keyboardMouse`, `gamepad`, `touch`                            | oui     | oui   | K8         |
| `version` | `APP_VERSION`                                                                                          | oui     | oui   | K9         |
| `outcome` | `won`, `core` (noyau détruit), `downed` (tous à terre), `quit`, `interrupted` (partie en ligne coupée) | non     | oui   | K2, K6, K7 |
| `tier`    | palier atteint, entier                                                                                 | non     | oui   | K5         |
| `seconds` | durée de jeu en secondes entières, depuis les ticks de la sim                                          | non     | oui   | K6         |

- L'heure de réception est posée par WAE, jamais par le jeu.
- Le Worker refuse tout l'événement si un champ manque, est en trop ou sort de ses valeurs. `stage` et `classes` se vérifient par leur forme (identifiants en minuscules, 24 caractères au plus) : une nouvelle scène ou classe passe sans redéployer le Worker.
- En ligne, seul l'hôte envoie ; son périphérique compte pour la partie.

## Lecture

- `pnpm kpi [depuis]` affiche les neuf KPI en tableaux Markdown, par défaut depuis la date de la dernière sortie. Pas de tableau de bord à tenir.
- À chaque sortie, le tableau entre dans la description de la pull request de sortie : c'est l'historique au-delà des 3 mois de WAE.
- Entre deux sorties, Constantin le lance quand il veut ; rien ne tourne seul.

## Critères de réussite

- Constantin lit en une commande la part des parties sur chaque scène depuis la dernière sortie.
- Un envoi raté ne se voit pas et ne retarde rien ; aucune requête de mesure en développement ni dans les tests.
- Le jeu ne dépose ni cookie ni rien dans le stockage local pour la mesure.

## Hors périmètre

Remplacer le compteur de visites abacus. Les retours de vive voix ou par formulaire (jalon feedback). Le pays, la langue, le navigateur, l'écran, les images par seconde. Les choix d'amélioration et les statistiques de combat (équilibrage : banc sans écran). Un tableau de bord en ligne.
