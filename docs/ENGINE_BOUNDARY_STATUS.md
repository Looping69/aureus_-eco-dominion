# Engine boundary status

This is a migration ledger, not a claim that `engine/` is already game-independent.

The automated guard in `scripts/check-engine-boundary.js` resolves relative TypeScript imports from `engine/` and compares imports leaving the directory with `docs/engine-boundary-baseline.json`. The original baseline has **74 edges, all targeting root `types.ts`**; the state, persistence, and utility extractions reduce the live count to **67**. Removing edges passes automatically; adding a new edge fails `npm run test:boundary`. The check does not yet detect game ownership hidden inside `engine/`, and it is not an import-cycle analysis.

| Cluster | Current coupling | Destination | Order |
| --- | --- | --- | --- |
| `game/state/StateManager.ts` | Aureus command queue, lockstep integration, ID creation, and active definition validation | Keep in game pack until generic command services have been extracted | In progress |
| `game/state/createAureusInitialState.ts` | Constructs and revives AGT, agents, dungeon, weather, bureaucracy, and other Eco Dominion state | Game-owned factory injected into generic `engine/state/StateStore.ts` | Extracted |
| `game/state/PersistenceManager.ts` | Aureus save key, chunk pruning, and legacy save migration | Game-owned codec using `engine/state/JsonSaveStorage.ts` for generic keyed storage | Extracted |
| `engine/sim/systems/` | 26 direct root-type imports; many systems implement Eco Dominion rules | Eco Dominion systems under a game-owned composition root; reusable simulation scheduler stays in engine | After state factory |
| `engine/data/voxels/` | 9 direct root-type imports and building/biome assumptions | Eco Dominion definitions; retain only generic voxel geometry in engine | After state schema |
| `game/sim/utility/` | Aureus power/water adapters and systems own building-specific allocation, while `engine/sim/resourceGrid/ResourceGridSolver.ts` retains the reusable allocation algorithm | Game-owned system composition using engine solver | Extracted |
| `engine/worldgen/` and `engine/underground/` | Mixes procedural algorithms with Eco Dominion layers and survey rules | Split generic generation from pack-specific policies and normalization | After save fixtures |
| `engine/game-pack/` | Generic metadata and registry, but no executable runtime factory | Reusable runtime contract | After extraction boundary |

The reusable mechanisms are `engine/kernel/SeededRandom.ts`, `engine/state/StateStore.ts`, and `engine/state/JsonSaveStorage.ts`. None imports Eco Dominion state. `StateStore` accepts an initial-state factory and owns subscriptions, dirty keys, mutation context, and serialization; the game-owned state manager supplies the Aureus factory and handles its commands. `JsonSaveStorage` accepts a game-specific key and leaves serialization and migration with the pack.

## Release gates

1. Reduce the measured 74 edges as domain types move behind a pack boundary; do not grow the baseline to make a build pass.
2. Add a second check for game-owned modules *inside* `engine/` after the dependency inventory assigns ownership; moving files without changing their dependency direction is not sufficient.
3. Preserve old Aureus saves and default game startup through each extraction.
4. A second pack running without `AureusWorld` is the final proof, not a substitute for zero game-owned engine imports.
