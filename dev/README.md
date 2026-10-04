# Pages de développement

Une page HTML par couche pour la développer sans le reste du jeu : `render.html`, `input.html`, `audio.html`, `ui.html`. Vite les construit toutes (`vite.config.ts`), elles sont servies sous `/dev/` sur GitHub Pages. Chaque page charge un fixture d'état et ne touche jamais à `src/sim/`.
