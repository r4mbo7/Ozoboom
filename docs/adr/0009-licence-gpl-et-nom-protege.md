# 0009 - Code sous GPL-3.0, nom Ozoboom protégé à part

- **Statut :** accepté
- **Date :** 2026-10-07

## Contexte

Le dépôt est public sous MIT, qui laisse n'importe qui vendre le jeu tel quel. Constantin envisage un jour une version payante, sur Steam ou ailleurs. Il est le seul auteur de tous les commits : il peut changer la licence seul. Les versions déjà publiées restent sous MIT, la nouvelle licence ne vaut que pour la suite.

## Décision

- **Code et contenu sous GPL-3.0-only.** Qui redistribue le jeu, modifié ou non, payant ou non, doit publier ses sources sous la même licence.
- **Le nom et le logo ne sont pas couverts par la licence.** Une version dérivée doit changer de nom. Une marque se dépose avant une sortie commerciale.
- **La version navigateur reste gratuite.** Une version payante, si elle vient, passe par une boutique.
- **Une contribution extérieure exige une cession de droits** (CLA) : sans elle, Constantin ne pourrait plus publier de version sous d'autres termes, par exemple liée au SDK Steamworks.

## Alternatives écartées

- **Garder MIT.** Une copie payante sous un autre nom serait légale.
- **PolyForm Noncommercial ou tous droits réservés.** Seule protection légale contre la revente, mais le jeu cesse d'être libre et Constantin préfère qu'il le reste. Le modèle libre et payant sur Steam a fait ses preuves (Mindustry, Shattered Pixel Dungeon).
- **GPL-3.0-or-later.** Laisse la FSF fixer les termes d'une version 4 ; « only » garde la main à l'auteur, qui peut de toute façon relicencier.
- **AGPL-3.0.** Utile seulement pour un service en réseau ; le futur classement le serait, à trancher le moment venu.

## Conséquences

Facile : le jeu reste libre, lisible et modifiable ; une copie doit publier ses sources et changer de nom. Difficile : rien n'interdit une copie gratuite ou payante qui respecte ces deux conditions, seul le nom et la boutique officielle font la différence. On revient dessus si des copies payantes concurrencent réellement la version officielle.
