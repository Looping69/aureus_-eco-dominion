Sani workspace notes

- Purpose: compact running repo note file required by AGENTS.md.
- Keep summaries concise and update after each reply that changes repo state.
- Current focus: late Phase 3 / early Phase 4 stabilization plus build and contract repairs around the engine-owned state layer.
- 2026-06-02: Repaired `engine/state/StateManager.ts` after it drifted onto an older contract. It now uses current chunk bootstrapping, current `commandQueue` flow, current React-facing listener shape, and exposes `serializeState()` for `GameStateManager` again.
- 2026-06-02: Synced back to the live repo and found one more stale save/load seam. `game/world/GameStateManager.ts` had fallen behind the chunked world model by loading `parsed.grid` and broadcasting `SYNC_GRID`; it now loads `parsed.chunks` and broadcasts `SYNC_CHUNKS` to match the current world/worker contract.
- 2026-06-02: This note file had been emptied in the live repo and has now been restored so the running engineering context is visible again.
- 2026-06-03: Continued the approved higher-risk Phase 4 renderer pass on `main`. `game/render/systems/BuildingRenderSystem.ts` now reuses overlay label sprites across frames and moves the remaining transient route-heat, congestion, hub, planner, sector, and junction beacon visuals onto the instanced overlay path instead of recreating one-frame meshes and sprites every update.
- 2026-06-03: Continued the renderer split without forcing the giant `BuildingRenderSystem.ts` body through a risky whole-file replace. The next pure-logic seam now lives in `game/render/systems/LogisticsOverlayTopology.ts`, covering node activity, neighbor lookup, junction detection, drone-hub detection, node world positions, and affected-chunk filtering ahead of the final coordinator switchover.
- 2026-06-04: Continued breaking down the renderer switchover by extracting `game/render/systems/LogisticsOverlayInstancing.ts`, which now owns packet-instance spec creation plus packet and overlay material-cache helpers ahead of the final `BuildingRenderSystem.ts` coordinator swap.
