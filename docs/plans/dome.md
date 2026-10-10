# Plan Le Dome

Découpage de [2026-10-10-dome-requirements.md](../brainstorms/2026-10-10-dome-requirements.md) en issues du jalon [Le Dome](https://github.com/r4mbo7/Ozoboom/milestone/5). Le tempo par scène est décidé dans l'[ADR 0012](../adr/0012-le-tempo-est-une-donnee-de-la-scene.md). Deux issues de contrat ouvrent le jalon, avec les voix de l'audio ; une fois les contrats fusionnés, tout le reste se mène de front.

Les maquettes validées sont hors du dépôt, sur la machine de Constantin : le visuel dans `.lavish/dome/index.html` (option F), les morceaux dans `.lavish/dome-musiques/index.html`. Les issues qui en ont besoin donnent leur chemin.

## Vagues

| Vague | Clé | Issue                                                                                                                                          | Bloquée par   |
| ----- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1     | C1  | [#308 shared/data/sim : contrats du Dome, tempo par set, décor, obstacles, morceaux et batterie](https://github.com/r4mbo7/Ozoboom/issues/308) | -             |
| 1     | C2  | [#309 ui/net : contrats du choix de la scène, écran de choix et salon](https://github.com/r4mbo7/Ozoboom/issues/309)                           | -             |
| 1     | A1  | [#315 audio : voix darbouka, riq, oud et ney](https://github.com/r4mbo7/Ozoboom/issues/315)                                                    | -             |
| 1     | A2  | [#316 audio : voix kalimba, chœur à formants, sirène dub et bol chantant](https://github.com/r4mbo7/Ozoboom/issues/316)                        | -             |
| 2     | S1  | [#310 sim : la grille musicale au tempo du set](https://github.com/r4mbo7/Ozoboom/issues/310)                                                  | C1            |
| 2     | S2  | [#311 sim : obstacles, collisions des joueurs, des bad vibes et des tirs](https://github.com/r4mbo7/Ozoboom/issues/311)                        | C1            |
| 2     | S4  | [#313 sim : rien n'apparaît ni ne se pose dans un obstacle](https://github.com/r4mbo7/Ozoboom/issues/313)                                      | C1            |
| 2     | D1  | [#314 data : le set du Dome, tempo, enceintes replacées, paliers recalés et obstacles](https://github.com/r4mbo7/Ozoboom/issues/314)           | C1            |
| 2     | A3  | [#317 audio : batterie par morceau, tempo du set et réverbe de coupole](https://github.com/r4mbo7/Ozoboom/issues/317)                          | C1            |
| 2     | V0  | [#318 render/ui/app : animations et horloges au tempo du set](https://github.com/r4mbo7/Ozoboom/issues/318)                                    | C1            |
| 2     | V1  | [#319 render : le sol de sable du Dome aux quatre moments](https://github.com/r4mbo7/Ozoboom/issues/319)                                       | C1            |
| 2     | V2  | [#320 render : la coupole en filigrane, côtes, guirlandes, panneaux UV et couronne](https://github.com/r4mbo7/Ozoboom/issues/320)              | C1            |
| 2     | V3  | [#321 render : les quatre géants en ronde et les champignons lumineux](https://github.com/r4mbo7/Ozoboom/issues/321)                           | C1            |
| 2     | U1  | [#322 ui : écran « Choisis la scène » et choix dans le salon](https://github.com/r4mbo7/Ozoboom/issues/322)                                    | C2            |
| 3     | S3  | [#312 sim : les bad vibes contournent les obstacles et trouvent les passages](https://github.com/r4mbo7/Ozoboom/issues/312)                    | S2            |
| 3     | P1  | [#323 app : choisir la scène en solo, en local et en ligne, et tirer ses morceaux](https://github.com/r4mbo7/Ozoboom/issues/323)               | C2, U1        |
| 3     | D2  | [#324 data : les cinq morceaux du Dome](https://github.com/r4mbo7/Ozoboom/issues/324)                                                          | A1, A2, A3    |
| 4     | B1  | [#325 data : équilibrer le Dome sans écran](https://github.com/r4mbo7/Ozoboom/issues/325)                                                      | S1, S3, D1    |
| 5     | P2  | [#326 app : assembler le Dome, une partie complète et des captures](https://github.com/r4mbo7/Ozoboom/issues/326)                              | tout le reste |

## Règles

- Celles d'`AGENTS.md` : une issue, une branche `issue-<numéro>-<slug>`, fusionnée en un commit sur `dev`.
- Les contrats posent des types inertes : chaque scène se joue seule pendant tout le jalon, et les empreintes de rejeu de la main stage ne bougent pas.
- Rien dans la logique ne teste la scène : le Dome est des données (`ticksPerBeat`, `decor`, `obstacles`, `trackIds`, `acoustics`).
- Les pièges et les watts restent hors du jalon : ils vont être refondus.
- Quand une issue fusionne, retirer `blocked` et poser `ready` sur celles qu'elle débloque.
