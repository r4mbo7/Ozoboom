# Ozoboom

Jeu web léger de survie coopérative dans un festival de psytrance. De 1 à 4 amis défendent le sound system de la scène principale contre des vagues de bad vibes de plus en plus puissantes, chacun avec sa classe, jusqu'au lever du soleil.

Jouer : [r4mbo7.github.io/Ozoboom](https://r4mbo7.github.io/Ozoboom/)

## État

Au 2026-10-05 : la V0.2 est assemblée, il reste à la jouer à distance. Trois classes (la VJ, le roadie, le care), seul ou de 2 à 4 amis, sur un même écran ou en ligne : lumière du coucher au lever du soleil, bad vibes en masques, enceintes annexes, agrès de cirque, reliques. Le nom vient d'Ozora et de Boom, deux festivals de psytrance.

![Une partie à quatre, de nuit : la VJ, le roadie, le care et une seconde VJ](docs/captures/coop-quatre-joueurs-nuit.png)

![La partie à l'aube : la Batterie à plat au dernier drop](docs/captures/moment-3-aube.png)

### Jouer à plusieurs

- **Sur un écran** : « Jouer à plusieurs » ouvre le salon local. Le clavier et la souris prennent une place avec Entrée, chaque manette avec A ; chacun choisit son nom et sa classe, le premier joueur lance le set.
- **En ligne** : dans le salon, « Jouer en ligne » puis « Créer un salon » donne un code de six caractères et un lien à copier. Les amis ouvrent le lien (ou tapent le code), donnent leur nom et leur classe, l'hôte lance le set. Pair à pair en WebRTC, sans compte ([ADR 0007](docs/adr/0007-coop-en-ligne-lockstep-webrtc-peerjs.md)) ; tout le monde doit avoir la même version du jeu.
- Seul : « Jouer » reste un geste, la classe se choisit à côté.

### Jouer sur téléphone

Au doigt, seul ou en ligne, de préférence tenu à l'horizontale. Un pouce sur l'arène fait naître un joystick sous lui ; la visée et le tir sont automatiques, sur la bad vibe la plus proche à portée. Toucher la tuile d'un piège le pose à tes pieds, la glisser sur l'arène le pose sous le doigt. La compétence se touche sur sa tuile, la pause sur le bouton ❚❚ du bandeau. Les menus se touchent. Le tactile ne prend pas de place en coop sur un même écran.

Les autres captures (crépuscule, sunrise, chaque écran, le banc à 300 masques, la partie à quatre) sont dans [docs/captures](docs/captures).

| Jalon      | Contenu                                                                                                                                                                                                                                    | État                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Fondations | Vision, direction artistique, game design, architecture, contrats, outillage, CI et déploiement                                                                                                                                            | fait                                        |
| V0         | Prototype solo jouable : mage, vagues, deux pièges, clavier et manette, musique synthétisée, bouton « Ton avis » ([exigences](docs/brainstorms/2026-10-04-v0-requirements.md), [plan](docs/plans/v0.md))                                   | fait                                        |
| V0.1       | Direction artistique « Cycle du soleil », bad vibes en masques, enceintes annexes et Volume, agrès de cirque, raretés, fusions, reliques ([exigences](docs/brainstorms/2026-10-04-v0.1-requirements.md), [plan](docs/plans/v0.1.md))       | fait                                        |
| V0.2       | Trois classes, coop locale, coop en ligne par lien, pair à pair en lockstep ([exigences](docs/brainstorms/2026-10-05-v0.2-requirements.md), [plan](docs/plans/v0.2.md), [ADR 0007](docs/adr/0007-coop-en-ligne-lockstep-webrtc-peerjs.md)) | assemblée, vérifications à distance à faire |
| V1         | Tous les pièges, équilibrage, tactile, mode radio, retours des joueurs ([jalon](https://github.com/r4mbo7/Ozoboom/milestone/2))                                                                                                            | en cours : tactile fait                     |
| V2         | Classement public : soirée du jour, scores vérifiés par rejeu                                                                                                                                                                              | à venir                                     |

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

Node 24 et pnpm (version épinglée dans `package.json`). `pnpm e2e` lance les tests navigateur (`pnpm exec playwright install chromium` la première fois).

Pages de développement, une par couche : [rendu](https://r4mbo7.github.io/Ozoboom/dev/render.html), [entrées](https://r4mbo7.github.io/Ozoboom/dev/input.html), [audio](https://r4mbo7.github.io/Ozoboom/dev/audio.html), [interface](https://r4mbo7.github.io/Ozoboom/dev/ui.html) ; le jeu accepte aussi `?dev=fast` (set court et accéléré) et `?dev=bench` (300 masques sur la rive du lac, trois agrès et une enceinte branchée, coût par image dans la console et `window.ozoboom.report` ; `&players=4` pose quatre joueurs, un de chaque classe plus une VJ).

## Licence

Le code et le contenu sont sous [GPL-3.0](LICENSE) : qui redistribue le jeu, modifié ou non, publie ses sources sous la même licence. Le nom Ozoboom et son logo n'en font pas partie : une version dérivée porte un autre nom. Les polices gardent leur licence OFL ([public/fonts/](public/fonts/)). Voir l'[ADR 0009](docs/adr/0009-licence-gpl-et-nom-protege.md).
