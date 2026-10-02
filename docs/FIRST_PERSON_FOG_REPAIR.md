# First-person fog repair — 2026-10-02

## Reproduction

A local Chromium session selected a real agent, clicked First Person View, held W, turned with pointer lock, and exited using Escape. The old mist was three fixed cylinders centred on the nearest historical exploration point, not the moving observer or the explored boundary. During a short walk the anchor jumped from `(0, -3.07)` to `(-3, -9)` and then `(0, -9.2)`. Its materials disabled depth testing and could composite over foreground geometry. The cylinders ignored overlapping/connected remembered reveal regions.

A separate source-policy defect classified every truthy buildingType as a building. EMPTY and POND therefore generated reveal circles merely because their chunks were loaded. Fresh-game reproduction recorded 81 false building centres. The tracker also hydrated by version alone, allowing another save with the same version to reuse stale history. Exploration was mutated from render callbacks rather than the fixed simulation tick.

## Change

- `game/fog/FogExploration.ts` owns the existing reveal radii, source collection, and saved-centre tracker. Empty and pond tiles cannot grant building sight; unfinished structures remain excluded. Cache hydration checks both state identity and version.
- `game/sim/systems/FogOfWarSystem.ts` records exploration after simulation updates regardless of strategic/first-person camera mode. Rendering only reads this history.
- `game/fog/ExploredBoundary.ts` finds the first unexplored interval along a ray by merging intersections with the existing saved reveal discs. Connected explored corridors stay open; unexplored gaps remain boundaries even when another explored island lies beyond them.
- First-person mist geometry samples this boundary around the actual camera, uses normal depth testing, and follows terrain height. It no longer snaps to a historic centre or imposes a fixed-radius cylinder inside explored land. Rebuilds occur on exploration/load changes or at least half a tile of observer movement; turning alone does not rebuild. There are still three material bands and 192 angular segments. Geometry uses a 128-tile search bound; capped segments are omitted rather than creating an artificial wall in known terrain.
- Fog overlays are recreated when the render scene changes, and mask invalidation notices replacement save objects even at the same version.

## Verification

TypeScript, all 288 configured tests, production build, and five boundary/RNG checks pass. Zero external engine imports are preserved. The broader suite reports 145 passes / 16 failures across 161 tests: no new failure titles versus the earlier baseline; the stale fog source test is replaced by five executable behavioral tests and now passes.

Browser proof passes actual enter / W movement / level mouse-look / Escape exit and save/load restoration. Moving geometry origins stay within 0.6 tiles of the camera, depth testing is enabled, and the fresh game has zero false building centres. Exit hides mist and shows the strategic overlay. An additional dark-sky diagnostic compared an upward-facing night camera with fog disabled: it remained dark, so that view was not misreported as a fog defect or a fix. Final level-look screenshots preserve visible foreground terrain. External CDN/font requests were blocked and cause fetch errors.

## Preserved semantics and remaining limitations

This is persistent radial exploration, not a new tactical line-of-sight model. Current reveal sources and remembered centres are distinct in the model, but remembered terrain remains revealed; no new dimmed-current-visibility style or entity visibility culling has been added. Mountains/buildings do not block exploration rays. The mist remains a visual frontier, not a security or gameplay occlusion boundary.

Existing fog save fields and keys are unchanged. Previously saved centres are retained, including any excess exploration produced by the old bug; automatically deleting those could erase legitimate player exploration. Strategic mask resolution, six-tile historical source quantization, first-person night lighting, minimap/current-visibility integration, and large-save performance profiling remain follow-up work. The change does not rebalance generation, reveal radii, agent movement, or saved colonies.
