Sani workspace notes

- Purpose: compact running repo note file required by AGENTS.md.
- Keep summaries concise and update after each reply that changes repo state.
- Current focus: late Phase 3 / early Phase 4 stabilization plus build and contract repairs around the engine-owned state layer.
- 2026-06-02: Repaired `engine/state/StateManager.ts` after it drifted onto an older contract. It now uses current chunk bootstrapping, current `commandQueue` flow, current React-facing listener shape, and exposes `serializeState()` for `GameStateManager` again.
- 2026-06-02: Synced back to the live repo and found one more stale save/load seam. `game/world/GameStateManager.ts` had fallen behind the chunked world model by loading `parsed.grid` and broadcasting `SYNC_GRID`; it now loads `parsed.chunks` and broadcasts `SYNC_CHUNKS` to match the current world/worker contract.
- 2026-06-02: This note file had been emptied in the live repo and has now been restored so the running engineering context is visible again.
