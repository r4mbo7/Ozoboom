---
date: 2026-10-10
topic: dome
---

# Ozoboom - Le Dome, deuxième scène

## Cadre

Jusqu'ici, on ne joue que sur la main stage. Le 2026-10-10, Constantin ajoute une deuxième scène, le Dome, en référence à la scène Dome d'Ozora : une coupole de bois sur le sable, du downtempo, du dub et du psybient. Le Dome garde les dimensions de la main stage. Le visuel est l'option F, retenue parmi six maquettes. La musique (cinq morceaux, 96,7 BPM) a été validée sur des prototypes à l'écoute. Les deux maquettes sont hors du dépôt : `.lavish/dome/` et `.lavish/dome-musiques/`.

Une scène est un set (`SetDefinition`) : son arène, son noyau, ses paliers, ses enceintes, son tempo, ses morceaux, son décor et ses obstacles. Le Dome est un deuxième set, sans `if` de scène dans la logique.

## Exigences

**Choisir la scène**

- R1. Juste avant de lancer la partie, l'hôte choisit la scène : en solo après « Jouer », dans le salon en coop locale ou en ligne. La dernière scène jouée est présélectionnée : Entrée suffit à relancer.
- R2. Une carte par scène : son nom, son style, son tempo et un aperçu dessiné par le code. Le choix se fait au clavier, à la manette et au tactile.
- R3. En ligne, les invités voient le choix de l'hôte en direct dans le salon, sans pouvoir le changer. Le lancement porte déjà `setId`.

**Le set du Dome**

- R4. Une arène aux mêmes dimensions que la main stage, le noyau au centre.
- R5. Les quatre enceintes annexes de la main stage, replacées autour de la coupole. « Le Dôme chill » garde son nom.
- R6. Les paliers et les boss de la main stage, recalés au tempo du Dome.

**Tempo propre à la scène**

- R7. Le Dome joue à 96,7 BPM, soit les 2/3 de 145. Le tick reste à 29 Hz. Au Dome, un temps vaut 18 ticks, une mesure 72 et une phrase 1152, contre 12, 48 et 768 sur la main stage.
- R8. La longueur du temps devient une donnée du set, lue par la sim, le rendu, l'audio et l'interface. `src/shared/tempo.ts` cesse d'être une constante unique.
- R9. Au Dome, tout ce que la grille compte en temps, en mesures et en phrases dure un tiers de plus ; les durées écrites en ticks dans les données restent en temps réel (ADR 0012). Le Dome se rééquilibre par des parties sans écran, hors pièges et watts, et ses nombres vivent dans son set.
- R10. Rien ne change sur la main stage : les empreintes de ses rejeux restent identiques.

**Musique**

- R11. Cinq morceaux synthétisés, transcrits des prototypes de `.lavish/dome-musiques/` : Sous la coupole (psybient, ré dorien), Route de la soie (downtempo oriental, mi hijaz), Dub des champignons (psydub, sol mineur), La cérémonie (downtempo rituel, fa mineur) et Mandala de feu (psychill, do# mineur).
- R12. Chaque scène a ses morceaux : on tire au sort parmi ceux de la scène choisie.
- R13. `MusicTrack` peut porter sa propre batterie. Sans elle, c'est la batterie actuelle, et la main stage ne change pas.
- R14. Nouvelles voix dans `src/audio/voices.ts` : darbouka, riq, ney, oud, kalimba, chœur à formants, sirène et bol chantant.
- R15. Une grande réverbe de coupole (convolution d'environ 3,6 s), réglée par scène et pas par morceau.

**Décor : la ronde autour de la coupole**

- R16. Un sol de sable, avec des dunes et du grain. La piste sous la coupole est plus claire. Le sable a ses teintes aux quatre moments du set, et la silhouette des bad vibes y garde un contraste de 3:1 (`ground.test.ts`).
- R17. La coupole est en filigrane, pour qu'on voie la piste à travers : 24 côtes de bois qui partent de l'oculus, des guirlandes, une bande de panneaux peints aux UV et une couronne de poteaux au sol.
- R18. Quatre géants cosmiques à tête de champignon aux diagonales, dos à la scène. Leurs mains se rejoignent au-dessus des quatre grandes entrées et leurs racines plongent sous la couronne. Des grappes de champignons luisent la nuit.
- R19. Tout est dessiné par le code et suit la lumière et le mode calme de `direction-artistique.md`.

**Obstacles**

- R20. Les poteaux de la couronne et les bras des géants sont des obstacles décrits dans le set. Ils arrêtent les tirs.
- R21. Les passages vers la scène sont nombreux, tout autour. Joueurs et bad vibes passent entre deux poteaux, sauf les plus grosses (lourdes et boss), qui prennent les quatre grandes entrées dans les axes. La ronde des bras s'ouvre aussi en de nombreux passages, les plus larges sous les mains jointes.
- R22. Les bad vibes contournent les obstacles sans se coincer, avec les seules maths permises dans la sim. Rien n'apparaît ni ne se pose dans un obstacle : bad vibes, agrès posés, enceintes.
- R23. La main stage n'a pas d'obstacle et ne change pas.

**Qualité**

- R24. Une partie `?dev=fast` au Dome va au bout dans les tests navigateur. Le banc d'équilibrage joue les deux scènes.
- R25. `pnpm check` et `pnpm e2e` passent à chaque fusion, et chaque scène se joue seule pendant tout le jalon.

## Critères de réussite

- L'hôte choisit le Dome en deux gestes, et ses invités le voient avant le lancement.
- Constantin reconnaît le Dome d'Ozora au premier coup d'œil.
- Au Dome, on sent le tempo plus lent dans le jeu : vagues, compétences, pulsation du noyau.
- Aucune bad vibe ne reste coincée contre un poteau ou un bras sur cent parties sans écran.
- Chaque classe finit le set du Dome en solo, comme sur la main stage.

## Hors périmètre

Une troisième scène. Un tempo qui accélère pendant le set, comme dans le live de référence (95 à 108 BPM). Des bad vibes, des boss, des agrès ou des enceintes propres au Dome. Les pièges et les watts : ils vont être refondus, le jalon n'y touche pas. Des fichiers audio : tout reste synthétisé.

## Décisions

- Une scène est un set : le choix de la scène est celui de `setId`, déjà transmis au lancement en ligne.
- Le Dome joue aux 2/3 de 145 pour garder des ticks entiers (18 par temps) et le même pas de sim. Le demi-temps sur la grille de 145 a été écarté : il ne sonne pas comme le live de référence.
- Le tempo par scène défait le principe « un seul temps musical » de `architecture.md` : [ADR 0012](../adr/0012-le-tempo-est-une-donnee-de-la-scene.md).
- Les obstacles filtrent sans fermer : on entre de partout, sauf les plus grosses bad vibes, et les tirs y butent.
- Les photos et l'enregistrement de référence de `dome/` appartiennent à d'autres : ils restent hors du dépôt (`.gitignore`).
