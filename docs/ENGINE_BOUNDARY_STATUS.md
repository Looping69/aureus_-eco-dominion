# Engine boundary status

This is a migration ledger, not a claim that `engine/` is already game-independent.

The automated guard in `scripts/check-engine-boundary.js` resolves relative TypeScript imports from `engine/` and compares imports leaving the directory with `docs/engine-boundary-baseline.json`. The original baseline has **74 edges, all targeting root `types.ts`**; the state, persistence, utility, bureaucracy, era, simulation-rule, and authored-asset extractions reduce the live count to **17**. Removing edges passes automatically; adding a new edge fails `npm run test:boundary`. The check does not yet detect game ownership hidden inside `engine/`, and it is not an import-cycle analysis.

| Cluster | Current coupling | Destination | Order |
| --- | --- | --- | --- |
| `game/state/StateManager.ts` | Aureus command queue, lockstep integration, ID creation, and active definition validation | Keep in game pack until generic command services have been extracted | In progress |
| `game/state/createAureusInitialState.ts` | Constructs and revives AGT, agents, dungeon, weather, bureaucracy, and other Eco Dominion state | Game-owned factory injected into generic `engine/state/StateStore.ts` | Extracted |
| `game/state/PersistenceManager.ts` | Aureus save key, chunk pruning, and legacy save migration | Game-owned codec using `engine/state/JsonSaveStorage.ts` for generic keyed storage | Extracted |
| `game/sim/systems/`, `game/sim/logic/`, `game/sim/construction/`, and game utility diagnostics | Aureus simulation rules, commands, goals, AI, placement, and diagnostic copy | Game-owned composition in `AureusWorld`; engine scheduler, pathfinding, and resource-grid solver retained | Extracted (31 modules); no reverse engine re-exports |
| `game/data/tech.ts` | Authored technology prices, prerequisites, and effects | Direct game/UI consumers and game-owned ResearchSystem | Extracted; technology types still reside in `engine/types/` |
| `game/data/` and game-owned voxel factories/materials | Authored building, agent, combat, resource and voxel definitions | 81 data modules plus game-specific material, factory, and GameUtils adapters moved; generic geometry and procedural math retained in engine | Extracted (84 modules) |
| `game/sim/utility/` | Aureus power/water adapters and systems own building-specific allocation, while `engine/sim/resourceGrid/ResourceGridSolver.ts` retains the reusable allocation algorithm | Game-owned system composition using engine solver | Extracted |
| `game/sim/BureaucracySystem.ts` and `game/data/bureaucracy.ts` | Aureus permits, NPC dialogue, and approval rules | Game-owned simulation and definitions | Extracted; related bureaucracy types still reside in `engine/types/` |
| `game/sim/EraSystem.ts` and `game/data/eras.ts` | Aureus chapter order, unlock thresholds, milestones, and unlock effects | Game-owned progression registered by `AureusWorld`; HUD consumes game definitions directly | Extracted; era types still reside in `engine/types/` |
| `engine/worldgen/` and `engine/underground/` | Mixes procedural algorithms with Eco Dominion layers and survey rules | Split generic generation from pack-specific policies and normalization | After save fixtures |
| `engine/game-pack/` | Generic metadata and registry, but no executable runtime factory | Reusable runtime contract | After extraction boundary |

The reusable mechanisms are `engine/kernel/SeededRandom.ts`, `engine/state/StateStore.ts`, and `engine/state/JsonSaveStorage.ts`. None imports Eco Dominion state. `StateStore` accepts an initial-state factory and owns subscriptions, dirty keys, mutation context, and serialization; the game-owned state manager supplies the Aureus factory and handles its commands. `JsonSaveStorage` accepts a game-specific key and leaves serialization and migration with the pack.

## Release gates

1. Reduce the measured 74 edges as domain types move behind a pack boundary; do not grow the baseline to make a build pass.
2. Extend ownership checks for game-owned modules *inside* `engine/`. `tests/simulation-game-separation.test.ts` now rejects source files reintroduced under the four extracted simulation directories and the technology table. Other ownership clusters remain unchecked; moving files without changing dependency direction is not sufficient.
3. Preserve old Aureus saves and default game startup through each extraction.
4. A second pack running without `AureusWorld` is the final proof, not a substitute for zero game-owned engine imports.

## Remaining measured imports after authored asset extraction

| Group | External import edges |
| --- | ---: |
| Networking | 4 |
| World generation | 3 |
| Pathfinding | 2 |
| Subsurface rules | 2 |
| Underground generation/connectivity | 2 |
| Worker, chunk store, contract lifecycle, building-level utility | 4 |
| **Total** | **17** |

This count does not include game ownership hidden inside `engine/types`, authored tables without external imports, the day/night policy, or typed game-state assumptions in reusable interfaces. The sample pack still has metadata only and still falls back to Aureus in the existing launcher. No second-pack independence proof is claimed. See `ENGINE_RUNTIME_READINESS.md` for the remaining type/spatial/worker/network boundaries, safe extraction order, and second-pack acceptance gates.

## Simulation-batch verification

The 32-module extraction preserves every moved module's non-import TypeScript syntax tree. System registration order and priorities, runtime rules, serialized state, technology IDs, and costs were not changed. The build gate passes type checking and 268 contract tests; boundary checks pass at 35 edges. Research integration coverage exercises real command dispatch, prerequisite ordering, rejection atomicity, and saved unlock restoration.

All 195 tests in affected existing test files were also run against both the extraction and a detached `afc01df2614f83d65ea3ba4fa6cd52f048cc5425` baseline: both report 177 passes, 15 failures, and 3 skips, with identical failing test names. These non-default failures predate the move: two building-level fixtures, one combat defeat assertion, demo UI copy, two first-loop library source assertions, a browser-only foliage import (`document` absent in Node), two production contracts, two train-logistics contracts, one underground HUD contract, and three utility source contracts. They remain separate follow-up work; the configured build contract suite is green. Browser gameplay verification remains outstanding.

## Authored-asset verification

All 84 moved module bodies retain identical non-import TypeScript syntax trees. The two extracted procedural math functions are also unchanged. The build passes type checking and 271 configured contracts. Boundary checks pass at 17 external imports, without increasing the baseline. The new authored-assets guard rejects source files under `engine/data` and the removed game adapters; generic geometry is exercised with caller-supplied material in Node without a DOM.

All 151 affected existing tests were compared with detached baseline `e9207b01c3eb743963fb3b9932eeb64ecc92475a`: both report 134 passes, 14 failures, 3 skips, with identical failure titles and zero new failures. Local Chromium smoke verification and the pre-existing Continue save-key mismatch are documented in `ENGINE_RUNTIME_READINESS.md`. No independent second pack has been booted.
