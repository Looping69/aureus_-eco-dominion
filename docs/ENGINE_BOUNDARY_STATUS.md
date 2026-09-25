# Engine boundary status

This is a migration ledger, not a claim that `engine/` is already game-independent.

The automated guard in `scripts/check-engine-boundary.js` resolves relative TypeScript imports from `engine/` and compares imports leaving the directory with `docs/engine-boundary-baseline.json`. The baseline currently has **74 edges, all targeting root `types.ts`**. Removing edges passes automatically; adding a new edge fails `npm run test:boundary`. The check does not yet detect game ownership hidden inside `engine/`, and it is not an import-cycle analysis.

| Cluster | Current coupling | Destination | Order |
| --- | --- | --- | --- |
| `engine/state/StateManager.ts` | Constructs AGT, agents, dungeon, weather, bureaucracy, and other Eco Dominion state; imports root `types.ts` | Game-owned state factory and save normalizer injected into reusable state storage | First substantive extraction |
| `engine/sim/systems/` | 26 direct root-type imports; many systems implement Eco Dominion rules | Eco Dominion systems under a game-owned composition root; reusable simulation scheduler stays in engine | After state factory |
| `engine/data/voxels/` | 9 direct root-type imports and building/biome assumptions | Eco Dominion definitions; retain only generic voxel geometry in engine | After state schema |
| `engine/sim/resourceGrid/` | Explicit Aureus adapters import root types | Game-owned adapters against generic resource-grid contracts | After system ownership |
| `engine/worldgen/` and `engine/underground/` | Mixes procedural algorithms with Eco Dominion layers and survey rules | Split generic generation from pack-specific policies and normalization | After save fixtures |
| `engine/game-pack/` | Generic metadata and registry, but no executable runtime factory | Reusable runtime contract | After extraction boundary |

The first extracted mechanism is `engine/kernel/SeededRandom.ts`. It has no Eco Dominion imports and preserves the generator previously embedded in `StateManager`.

## Release gates

1. Reduce the measured 74 edges as domain types move behind a pack boundary; do not grow the baseline to make a build pass.
2. Add a second check for game-owned modules *inside* `engine/` after the dependency inventory assigns ownership; moving files without changing their dependency direction is not sufficient.
3. Preserve old Aureus saves and default game startup through each extraction.
4. A second pack running without `AureusWorld` is the final proof, not a substitute for zero game-owned engine imports.
