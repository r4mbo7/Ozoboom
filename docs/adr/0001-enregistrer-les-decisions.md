# 0001 - Enregistrer les décisions d'architecture

- **Statut :** accepté
- **Date :** 2026-10-04

## Contexte

Ozoboom est construit par des agents dont chaque session repart sans mémoire, et par Constantin par intermittence. Le code dit ce qui a été construit, jamais ce qui a été écarté ni pourquoi. Sans trace, chaque session rediscute les mêmes questions ou défait un choix délibéré.

## Décision

Toute décision coûteuse à défaire est un ADR numéroté dans `docs/adr/`, à partir de `TEMPLATE.md`. Seuil : si revenir dessus coûterait plus d'une journée de travail, c'est un ADR. Moteur de rendu, format de données, dépendance, modèle réseau, abandon d'une fonctionnalité, pilier de la vision.

Un ADR accepté ne se modifie plus. Une décision qui change donne un nouvel ADR qui remplace l'ancien, marqué « remplacé par ». Le raisonnement qui s'est révélé faux est la partie la plus utile.

## Alternatives écartées

- Un seul `DECISIONS.md` : grossit jusqu'à être illisible et invite à réécrire le passé.
- Messages de commit et issues seulement : introuvables par sujet des mois plus tard.
- Rien : chaque session repart de zéro et dérive.

## Conséquences

Quelques minutes de lecture avant de toucher à un domaine, quelques minutes d'écriture quand on tranche. En échange, le projet garde une mémoire sans auteur continu.
