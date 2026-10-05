# Pages de développement

Une page HTML par couche pour la développer sans le reste du jeu : `render.html`, `input.html`, `audio.html`, `ui.html`. `replay.html` est à part : elle rejoue les parties scriptées de `src/sim/replay-scripts.ts` pour comparer leurs empreintes entre navigateurs. Vite les construit toutes (`vite.config.ts`), elles sont servies sous `/dev/` sur GitHub Pages. Chaque page de couche charge un fixture d'état et ne touche jamais à `src/sim/`.
