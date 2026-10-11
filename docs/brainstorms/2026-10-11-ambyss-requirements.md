---
date: 2026-10-11
topic: ambyss
---

# Ozoboom - Ambyss, troisième scène

## Cadre

Le 2026-10-11, Constantin ajoute une troisième scène, Ambyss, en référence à la scène Ambyss d'Ozora : la scène de l'éveil, en plein air au sommet d'une petite butte, où l'on s'assoit sur des coussins, où l'on lâche prise et où l'on pleure au lever du soleil. Le visuel est l'option B « La voile tendue », retenue parmi trois maquettes, avec le filtre cosmique « traces et voiles ». La musique est « Premier rayon », retenu parmi quatre prototypes. Les maquettes sont hors du dépôt : `.lavish/ambyss/index.html`.

Ambyss est un troisième set (`SetDefinition`), comme le Dome : des données, sans `if` de scène dans la logique. Au plus simple en cas de doute.

## Exigences

**Le set d'Ambyss**

- R1. Une arène aux dimensions de la main stage, le noyau au centre, sans obstacle et sans pente : la butte n'est qu'un décor.
- R2. Les paliers, les boss et les enceintes annexes de la main stage. Les enceintes sont replacées hors de la toile.
- R3. Ambyss joue à 116 BPM, les 4/5 de 145 : un temps vaut 15 ticks (ADR 0012). Les règles d'apparition de la main stage sont rendues plus denses pour garder le même nombre de bad vibes par seconde, comme au Dome.
- R4. Une réverbe de plein air, courte et claire, réglée dans le set.

**Musique**

- R5. Un morceau synthétisé, transcrit du prototype de `.lavish/ambyss/index.html` : « Premier rayon », chillgressive de lever du soleil en mi majeur, suite vi-IV-I-V. Kick doux sur les 4 temps, basse en contretemps, arpège pluck, cordes qui pleurent au break, une octave plus haut au drop, chœur au break.
- R6. Ambyss tire ses morceaux parmi les siens : un seul pour l'instant.

**Décor : la voile tendue**

- R7. Le sol de la butte : sable clair au sommet, herbe sèche sur la pente, courbes de niveau, arbres au pied, lumière de l'aube venue de l'est. Teintes aux quatre moments du set, silhouette des bad vibes à 3:1 (`ground.test.ts`).
- R8. Une piste en amande (vesica piscis) couverte de coussins rouges en rangs courbes face au noyau.
- R9. Une toile tendue en amande sur deux mâts, très transparente pour qu'on lise le combat dessous : ocre le jour, peinte de spirales qui s'allument la nuit. Des haubans descendent jusqu'à des piquets plantés dans la pente. Ni les mâts, ni les cordes, ni les piquets ne sont des obstacles.
- R10. Tout est dessiné par le code et suit la lumière et le mode calme de `direction-artistique.md`.

**Le filtre cosmique**

- R11. Permanent à Ambyss, rendu seulement. Des traces fines, comme dans une chambre à brouillard, apparaissent sur le temps et traversent la scène en diagonale depuis l'est, puis s'effacent en une mesure. Des voiles de lumière larges glissent lentement, un passage par phrase, violets la nuit et dorés à l'aube.
- R12. Jamais sur les bad vibes ni sur l'interface. Le 3:1 des silhouettes et le 4,5:1 du texte tiennent. Mode calme : pas de traces, voiles immobiles.

**Choisir la scène**

- R13. Une troisième carte dans « Choisis la scène », avec son nom, son style, son tempo et un aperçu dessiné par le code.

**Qualité**

- R14. Une partie `?dev=fast` à Ambyss va au bout dans les tests navigateur, le banc d'équilibrage joue les trois scènes, et chaque classe finit le set en solo.
- R15. Rien ne change sur la main stage ni au Dome : leurs empreintes de rejeu restent identiques.

## Critères de réussite

- Constantin reconnaît Ambyss au premier coup d'œil, et la toile ne gêne pas la lecture du combat.
- On sent le tempo d'Ambyss, entre la main stage et le Dome.

## Hors périmètre

Une pente qui ralentit. Des obstacles. D'autres morceaux. Des bad vibes, des boss, des agrès ou des enceintes propres à Ambyss. Les pièges et les watts.

## Décisions

- 116 BPM, le tempo du morceau retenu, tombe sur la grille de l'ADR 0012 (15 ticks par temps).
- La toile, les mâts et les piquets ne bloquent rien : au plus simple.
- Les photos et enregistrements de référence de `ambyss/` appartiennent à d'autres : ils restent hors du dépôt (`.gitignore`).
