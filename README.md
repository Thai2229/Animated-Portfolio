# Thai Van Le, animated portfolio

A one-screen three.js portfolio. Each planet is a shipped project and links to its live site. A tabby on a silver surfboard orbits the sun.

Next.js (App Router, TypeScript), react-three-fiber, drei, postprocessing (bloom), Vitest.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm start       # serve the build
npm run lint
npm test
```

Node 22.

## Add a project

Append an entry to `src/projects.ts` (name, subtitle, stack, url, optional github, planet kind), then add a matching slot (planet position and label offset) to `SLOTS` in `src/layout.ts`.

## Where things are

- `src/orbit.ts`: the cat's orbit position and tangent (tested).
- `src/lib/planetTextures.ts`: procedural planet textures, sampled in 3D so there is no seam.
- `src/lib/cat.ts`: tabby and surfboard geometry.
- `src/components/`: scene (sun, planets, rider) and the HTML overlay.

Phones (under 900px) get a plain list of project links instead of leader-line labels. With `prefers-reduced-motion` the scene renders one still frame. Without JavaScript the project links are listed in a `<noscript>` block.
