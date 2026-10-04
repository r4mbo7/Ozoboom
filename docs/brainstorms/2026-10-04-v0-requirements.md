---
date: 2026-10-04
topic: v0
---

# Ozoboom V0 - prototype solo jouable

## Cadre

Le concept, la concurrence et le nom ont été explorés le 2026-10-04 (base de connaissances de Constantin, fiche `projets/jeu-video.md`). Les fondations sont posées : vision, direction artistique, game design, architecture, contrats de types, outillage. Il n'y a pas encore de jeu. La V0 doit prouver que la boucle survivor plus défense est amusante dans un navigateur, seul, avec une classe, avant d'investir dans les autres classes, la coop et le classement.

## Exigences

**Boucle**

- R1. Une partie se lance depuis l'écran titre en un geste et dure au plus 10 minutes (set raccourci : deux paliers, un boss par palier).
- R2. Le joueur contrôle la classe mage : déplacement, tir visé, une compétence active, un ultime disponible sur le drop.
- R3. Des vagues de bad vibes (rusher et horde au minimum, plus un boss) convergent vers le noyau et attaquent le joueur qui les gêne. Leur vie, leur vitesse et leur nombre montent par phrase de 16 mesures.
- R4. Le noyau a une vie visible, produit des watts à chaque mesure, et la partie est perdue quand il tombe à zéro.
- R5. Les ennemis lâchent des vibes ; un niveau propose trois améliorations tirées au sort, la sim se met en pause pendant le choix.
- R6. Deux pièges posables avec des watts (caisson de basse, laser), qui agissent sur le temps musical.
- R7. La partie se gagne à la fin du set (sunrise) et affiche un écran de fin avec le score (phrases tenues, temps, kills, vie du noyau) et une relance en un geste.

**Rythme et direction artistique**

- R8. Tout est calé sur 145 BPM : spawns sur la mesure, pièges sur le temps, pulsation du noyau sur le kick, boss sur le drop. Le line-up du set est visible.
- R9. Palette, lisibilité des silhouettes et règle « nous émettons, eux absorbent » de `direction-artistique.md` sont respectées. Mode calme disponible et `prefers-reduced-motion` respecté. Jamais plus de trois flashs plein écran par seconde.
- R10. Musique synthétisée en boucle à 145 BPM qui s'épaissit avec les vagues et se vide au break, effets sonores sur le tir, les morts, les niveaux et les impacts sur le noyau. Le son se coupe d'un geste et ne démarre qu'après un geste de l'utilisateur.

**Contrôles**

- R11. Clavier et souris, et manette au mapping standard (Xbox vérifiée) fonctionnent dès la V0, menus compris. Le tactile attend la V1.

**Architecture et qualité**

- R12. La sim respecte l'ADR 0003 et les conventions de `architecture.md` : pure, déterministe, 29 ticks par seconde, pilotée par des `PlayerCommand` et une graine. Un test de rejeu fixe l'empreinte d'une partie scriptée.
- R13. Le contenu (classe, ennemis, pièges, améliorations, set) est dans `src/data/` et validé par un test.
- R14. 60 images par seconde avec 300 ennemis à l'écran sur un portable sans carte dédiée. Mesuré, pas estimé.
- R15. `pnpm check` et la CI sont verts à chaque fusion. `main` déploie sur GitHub Pages et reste jouable.

## Critères de réussite

- Constantin et un ami jouent chacun une partie complète sans explication et ont envie d'en refaire une.
- Le crescendo se sent : la troisième phrase est tendue, le drop fait peur, le sunrise fait plaisir.
- Un agent qui n'a jamais vu le dépôt ajoute un ennemi ou une amélioration en ne touchant que `src/data/` et un test.

## Hors périmètre

Tank et healer, coop locale ou en ligne, classement public, tactile, remappage des touches, plusieurs cartes, méta-progression. Tout cela est prévu et l'architecture le permet, mais rien n'est construit avant que la V0 ait prouvé la boucle.

## Questions ouvertes

- Visée manuelle ou assistée par défaut au clavier (voir `game-design.md`).
- Taille de l'arène et caméra : proposé, arène un peu plus grande que l'écran, caméra qui suit le joueur sans jamais perdre le noyau de vue.
