Sani workspace notes

- Purpose: compact running repo note file required by AGENTS.md.
- Keep summaries concise and update after each reply that changes repo state.
- Current focus: late Phase 3 / early Phase 4 stabilization plus build and contract repairs around the engine-owned state layer.
- 2026-06-02: Repaired `engine/state/StateManager.ts` after it drifted onto an older contract. It now uses current chunk bootstrapping, current `commandQueue` flow, current React-facing listener shape, and exposes `serializeState()` for `GameStateManager` again.
- 2026-06-02: Synced back to the live repo and found one more stale save/load seam. `game/world/GameStateManager.ts` had fallen behind the chunked world model by loading `parsed.grid` and broadcasting `SYNC_GRID`; it now loads `parsed.chunks` and broadcasts `SYNC_CHUNKS` to match the current world/worker contract.
- 2026-06-02: This note file had been emptied in the live repo and has now been restored so the running engineering context is visible again.
- 2026-06-03: Continued the approved higher-risk Phase 4 renderer pass on `main`. `game/render/systems/BuildingRenderSystem.ts` now reuses overlay label sprites across frames and moves the remaining transient route-heat, congestion, hub, planner, sector, and junction beacon visuals onto the instanced overlay path instead of recreating one-frame meshes and sprites every update.
- 2026-06-03: Replaced the failed macro-cell slope experiment in `engine/jobs/engine.worker.ts` with tile-scale smooth terrain meshing. The surface now renders as a per-tile heightfield again, while foliage density still respects LOD so the world can look smoother without exploding prop counts.
- 2026-06-03: Updated `tests/render-performance-contract.test.ts` so the repo now pins tile-scale terrain loops, LOD-throttled foliage sampling, and the removal of the old stepped cliff-wall loop.
- 2026-06-03: Resumed the safer renderer split path by extracting pure sector and planner overlay presentation rules into `game/render/systems/LogisticsOverlayPresentation.ts`, with contract coverage added in `tests/logistics-renderer-contract.test.ts` before the next `BuildingRenderSystem.ts` coordinator shrink.
- 2026-06-03: Pulled the overlay label canvas-material builder into `game/render/systems/OverlayLabelMaterialFactory.ts`, with contract coverage added before the main renderer switchover so the future `BuildingRenderSystem.ts` rewrite has less embedded presentation code to carry.
