# Project Status

Last updated: 2026-06-05

## Current Ship Focus

- Preserve the stable voxel/block terrain style while improving surface texture and frame rate.
- Keep weather and world events paced slowly enough that they feel like events, not noise.
- Keep illegal miner incursions intentionally rare.
- Continue reducing `AureusWorld.ts` pressure through small extraction passes rather than behavior rewrites.

## Verification Path

For local verification, use the repository scripts directly:

```bash
npm install
npm run typecheck
npm run build
```

For a direct development server, use:

```bash
npm run vite
```

`npm run dev` and `npm start` intentionally keep the Sani launch intro before starting Vite. That path is fine for the themed local experience; `npm run vite` is the cleaner path for automation, CI-style checks, and external development.

## Deployment Notes

- Vercel should use the default Vite base path `/` plus the existing catch-all rewrite in `vercel.json`.
- GitHub Pages builds require `VITE_DEPLOY_TARGET=github-pages`, which switches the Vite base path to `/aureus_-eco-dominion/`.
- A mismatched deploy target can break asset paths, especially on GitHub Pages.

## State Ownership

React game state should flow through `useAureusEngine`. `App.tsx` should not subscribe separately through `useEngineState`, because duplicate subscription paths make stale state and double renders much easier to introduce.

## Known Architectural Risks

- `game/AureusWorld.ts` still owns too much orchestration across input, rendering, simulation, persistence, and dispatch.
- The safest next extraction pass is still behavior-preserving: split lifecycle, interaction, render-frame, and dispatch bridge responsibilities into focused modules, validating after each move.
