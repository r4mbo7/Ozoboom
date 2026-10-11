# Plan Ambyss

Découpage de [2026-10-11-ambyss-requirements.md](../brainstorms/2026-10-11-ambyss-requirements.md) en issues du jalon [Ambyss](https://github.com/r4mbo7/Ozoboom/milestone/7). Le contrat ouvre le jalon ; une fois fusionné, tout le reste se mène de front.

La maquette validée est hors du dépôt, sur la machine de Constantin : `.lavish/ambyss/index.html` (visuel B, filtre « Les deux », morceau « Premier rayon »).

## Vagues

| Vague | Clé | Issue                                                                                                                      | Bloquée par   |
| ----- | --- | -------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1     | C1  | [#367 data : le set d'Ambyss, son décor, ses 116 BPM et ses enceintes](https://github.com/r4mbo7/Ozoboom/issues/367)       | -             |
| 2     | A1  | [#368 audio/data : le morceau « Premier rayon »](https://github.com/r4mbo7/Ozoboom/issues/368)                             | C1            |
| 2     | V1  | [#369 render : le sol de la butte, la piste en amande et ses coussins](https://github.com/r4mbo7/Ozoboom/issues/369)       | C1            |
| 2     | V2  | [#370 render : la voile tendue, ses mâts, haubans et piquets](https://github.com/r4mbo7/Ozoboom/issues/370)                | C1            |
| 2     | V3  | [#371 render : le filtre cosmique, traces et voiles](https://github.com/r4mbo7/Ozoboom/issues/371)                         | C1            |
| 2     | U1  | [#372 ui : la carte d'Ambyss dans « Choisis la scène »](https://github.com/r4mbo7/Ozoboom/issues/372)                      | C1            |
| 2     | B1  | [#373 data : équilibrer Ambyss sans écran](https://github.com/r4mbo7/Ozoboom/issues/373)                                   | C1            |
| 3     | P1  | [#374 app : assembler Ambyss, une partie complète, des captures et les docs](https://github.com/r4mbo7/Ozoboom/issues/374) | tout le reste |

## Règles

- Celles d'`AGENTS.md` : une issue, une branche `issue-<numéro>-<slug>`, fusionnée en un commit sur `dev`.
- Rien dans la logique ne teste la scène : Ambyss est des données (`ticksPerBeat`, `decor`, `trackIds`, `acoustics`, enceintes).
- Ajouter une scène ne doit pas empiler les `if` de décor : un choix par décor se lit dans une table.
- Quand une issue fusionne, retirer `blocked` et poser `ready` sur celles qu'elle débloque.
