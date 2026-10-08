# 0010 - La rareté d'une amélioration se tire après la carte

- **Statut :** accepté
- **Date :** 2026-10-08

## Contexte

Chaque rareté était une amélioration à part dans les données. Une offre pouvait montrer la même amélioration en commun et en légendaire (#250), et ouvrir les raretés triplait les améliorations du tirage : les agrès sortaient moins à haut Volume.

## Décision

- Une entrée par amélioration : `description` et `modifiers` sont la forme commune, `rarities.rare` et `rarities.legendary` les deux autres. Sans `rarities`, elle sort toujours commune (reliques).
- Le tirage prend des améliorations et agrès distincts, comme avant, puis tire la rareté de chaque amélioration selon le Volume, avec le générateur de la sim. Agrès et reliques sont communs.
- Les poids sont des données, `GameContent.rarityWeights`, indexés par Volume, la dernière entrée valant au-delà :

| Volume | Commun | Rare | Légendaire |
| ------ | ------ | ---- | ---------- |
| 0, 1   | 100    | 0    | 0          |
| 2      | 75     | 25   | 0          |
| 3      | 70     | 25   | 5          |
| 4      | 60     | 30   | 10         |

- `UpgradeOffer.rarities` donne la rareté de chaque option, dans l'ordre de `options`. `chooseUpgrade` ne change pas : une offre n'a jamais deux fois le même identifiant, la rareté se lit dans l'offre.
- `PlayerState.upgradeRarities` donne la rareté de chaque cumul, dans l'ordre de `upgrades`. `maxStacks` et les recettes de fusion comptent par amélioration, toutes raretés confondues.

## Alternatives écartées

- Garder une entrée par rareté et refuser deux raretés de la même amélioration dans une offre : corrige le doublon, pas la dilution des agrès.
- Pondérer chaque entrée par sa rareté dans un seul tirage : même dilution, et l'équilibrage passe par trois entrées à garder alignées.

## Conséquences

Une rareté de plus ne change plus la part des agrès dans le tirage. Les rejeux qui passent par une offre au Volume 2 ou plus changent, car le tirage consomme le générateur autrement.

Les contrats acceptent encore l'ancienne forme (`rarity` par entrée, `rarities` et `upgradeRarities` optionnels). #260 migre :

- `src/data/upgrades.ts` : fusionner les trois entrées de chaque amélioration, retirer `rarity`, revoir `maxStacks` ; remplir `rarityWeights`.
- `src/sim/draw.ts` : retirer `isRarityOpen`, tirer la rareté après chaque amélioration, remplir `UpgradeOffer.rarities`.
- `src/sim/systems/upgrade-choice.ts` : appliquer les modificateurs de la rareté offerte, remplir `upgradeRarities`.
- `src/ui/cards.ts` : rareté et description viennent de l'option tirée.
- Puis rendre `UpgradeOffer.rarities` obligatoire et retirer `UpgradeDefinition.rarity`.
