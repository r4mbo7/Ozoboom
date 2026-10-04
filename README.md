# Ozoboom

Jeu web léger de survie coopérative dans un festival de psytrance. De 1 à 4 amis défendent le sound system de la scène principale contre des vagues de bad vibes de plus en plus puissantes, chacun avec sa classe, jusqu'au lever du soleil.

Jouer : [r4mbo7.github.io/Ozoboom](https://r4mbo7.github.io/Ozoboom/)

## État

Au 2026-10-04 : les fondations sont posées, le jeu n'est pas encore jouable. Le nom vient d'Ozora et de Boom, deux festivals de psytrance.

| Jalon      | Contenu                                                                                                                                                                                                  | État     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Fondations | Vision, direction artistique, game design, architecture, contrats, outillage, CI et déploiement                                                                                                          | fait     |
| V0         | Prototype solo jouable : mage, vagues, deux pièges, clavier et manette, musique synthétisée, bouton « Ton avis » ([exigences](docs/brainstorms/2026-10-04-v0-requirements.md), [plan](docs/plans/v0.md)) | planifié |
| V1         | Trois classes, tous les pièges, équilibrage, coop locale, tactile, mode radio ([jalon](https://github.com/r4mbo7/Ozoboom/milestone/2))                                                                   | à venir  |
| V2         | Coop en ligne par lien, pair à pair                                                                                                                                                                      | à venir  |
| V3         | Classement public : soirée du jour, scores vérifiés par rejeu                                                                                                                                            | à venir  |

## Documentation

- [Vision](docs/vision.md) : piliers et non-objectifs.
- [Direction artistique](docs/direction-artistique.md) : lumière, couleur, rythme, son, accessibilité.
- [Game design](docs/game-design.md) : boucle, classes, pièges, ennemis, contrôles, coop, classement.
- [Architecture](docs/architecture.md) : simulation déterministe séparée du rendu, contrats, organisation du code, tests.
- [Décisions](docs/adr/) : les ADR.
- [AGENTS.md](AGENTS.md) : conventions pour contribuer, humain ou agent.
- [Donner un avis](https://github.com/r4mbo7/Ozoboom/issues/new?template=feedback.yml) : une idée, un bug, un souci d'équilibrage.

## Démarrer

```bash
pnpm install
pnpm dev       # http://localhost:5173
pnpm check     # types, lint, format, tests, build
```

Node 24 et pnpm (version épinglée dans `package.json`).

## Licence

[MIT](LICENSE).
