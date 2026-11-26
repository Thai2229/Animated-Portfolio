# Thai Van Le, portfolio

An interactive 3D murim valley. Each of the three sects guards one project: click a sect (or its label) to fly down to it and open the project panel.

Next.js 16 (App Router, TypeScript), React Three Fiber and drei, three.js 0.170.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
npm run lint
npm test
```

Node 22.

## How it works

- `src/terrain/` builds the world once per page load, in a Web Worker with a progress bar: a 1024 x 1024 heightfield (world size 120), 600k erosion droplets, baked shadows and lighting, the albedo texture and about 26k pine positions. Nothing is cached.
- Small screens (under 900px) and machines with 4 or fewer cores get a reduced profile (512 grid, fewer droplets and trees, smaller textures and shadow map). Add `?quality=low` or `?quality=high` to force one.
- `prefers-reduced-motion` turns off the camera drift and animated water, and renders on demand (camera moves are instant).
- `src/scene/` holds the buildings, camera path (`flyPose`) and the R3F scene. Labels are HTML buttons projected from each sect's 3D position.
- Project text lives in `src/content/sects.ts`. Each sect has a `githubUrl`.

## Deploy on Vercel

1. Import the GitHub repository at https://vercel.com/new. The framework (Next.js) is detected automatically.
2. No environment variables are needed. Metadata URLs come from the `VERCEL_*` variables Vercel sets.
3. Set the production branch to `main` (or the branch you prefer). Every other branch gets a preview deployment.

Add `?quality=low` or `?quality=high` to the URL to override the automatic quality profile.

## Notes

- `eslint.config.mjs` does not use `eslint-config-next`, because it loads typescript-eslint, which does not support the pinned TypeScript 7. ESLint parses TypeScript with Babel; types are checked with `npx tsc --noEmit`.
