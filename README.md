# Romance Forge

Interactive branching romance CYOA reader — MVP.

**Sample story:** *Until the Quiet Breaks* — return to Somerton after fifteen years on Henry’s letter. Romance with **Jake Shaw** (male LI); branches diner (`scene2a`) or Willow (`scene2b`); Layers 1–5 draft (Layer 5 stubs OK).

## Quick start

```bash
cd /workspace/romance-forge
npm install
npm start
```

Then open the URL Vite prints (default `http://localhost:5173`).

Enter a name on the landing page and play the sample branches.

## Scripts

| Command | What it does |
| -------- | ------------- |
| `npm start` / `npm run dev` | Serve the app with Vite |
| `npm test` | Run Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |

## Tests

```bash
npm install
npm test
```

Coverage includes:

- Landing page key content (branding, pitch, CTA / name entry)
- `[player_name]` substitution
- Choice navigation to the correct scene
- Non-ending scenes expose exactly two choices

## Project layout

```
romance-forge/
  index.html
  package.json
  vite.config.js
  FOUNDATION.md
  README.md
  artifacts/
    FOUNDATION.md
    stories/until-the-quiet-breaks/
      PREMISE.md
      TREE.md
      scenes/          # scene1 … scene5p modules (glob-loaded)
  src/
    main.js      # landing + reader UI
    engine.js    # substitution, choices, navigation
    story.js     # assembles scene modules into a Story
    styles.css   # ink-and-ember dark theme
  tests/
    engine.test.js
    app.test.js
```

## Engine rules (MVP)

- Scenes are shaped for a future 9-layer tree (`1→2→4→8→16→16→16→8→10`); this build loads Layers 1–5 via glob (31 scenes).
- Non-ending scenes: exactly **two** choices.
- Replace `[player_name]` in scene text with the player’s name.
- Scene art: optional `art` on a scene module, or auto-resolved as `/art/<storyId>/<sceneId>.png`. Missing files hide gracefully in the reader.

See `FOUNDATION.md` for the foundation stub.
