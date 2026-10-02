# Runtime boundary assessment after authored asset extraction

This is an implementation assessment, not a claim of a completed independent engine or second-pack boot.

## Smallest reusable boundary already available

- `engine/kernel/Runtime.ts`, Clock, EventBus, Profiler and `engine/world/WorldHost.ts` drive a `World` interface without constructing Aureus. Runtime currently uses browser animation frames.
- `engine/state/StateStore.ts`, `JsonSaveStorage.ts`, and `engine/kernel/SeededRandom.ts` accept independent state, storage keys, and seeds.
- `engine/sim/resourceGrid/ResourceGridSolver.ts` consumes generic participants.
- `engine/render/utils/VoxelBuilder.ts`, `VoxelUtils.ts`, and `GreedyMesher.ts` retain shared geometry operations. The builder's unused domain/material imports are removed. A Node test constructs an unrelated voxel model with caller-supplied materials and no DOM.
- `engine/utils/proceduralMath.ts` retains the exact Bresenham line and procedural RNG functions formerly embedded in GameUtils. GameUtils is now a game-owned adapter/re-export for existing consumers.

These mechanisms are useful independently. They are not a complete pack runtime: `Simulation.ts` still names the domain `GameCommand` through `engine/types`, and the current launcher always constructs Aureus. Existing sample metadata does not point to implemented runtime/state/UI modules.

## Remaining separation work

| Boundary | Current evidence | Safe next change and required verification |
| --- | --- | --- |
| Domain types | Root `types.ts` re-exports game/world/agent/building/economy types still stored under `engine/types/`; internal imports are invisible to the external-edge count | Inventory runtime enums separately from erased type imports. Keep generic command/world/storage contracts in engine and migrate domain types with their callers; do not merely replace imports with a new game re-export from engine. Typecheck all callers and compare serialized field names/enum values. |
| Spatial storage and generation | ChunkStore constructs Aureus tiles and calls biome/foliage generation. Core and layered generation depend on domain types. | Separate chunk indexing from an injected tile generator; keep the existing Aureus generator as its default game adapter. Snapshot fixed seeds at positive/negative chunk coordinates and compare loaded-save tiles and worker results. |
| Pathfinding and workers | A* references BuildingType and authored terrain costs; `engine.worker.ts` has an Aureus palette and terrain/foliage policy | Retain search/meshing algorithms; move traversal costs, passability, palette, and worker composition to game or injected policies. Preserve message schema/version and prove main/worker parity before changes. |
| Networking | Four external imports reference GameCommand/GameState; LockstepStateBridge explicitly knows Aureus state | Parameterize envelopes/queues over a command contract and keep Aureus hydration/state access in a game adapter. Preserve fixed-seed replay, sequencing, duplicate rejection, and old save fixtures. |
| Remaining domain helpers | Contract lifecycle, building upgrades, subsurface rubble/excavation, and underground generation/connectivity remain under engine | Move domain rules in a separate coherent batch while retaining generic geometry/connectivity mechanisms. Run contract, construction, negative-coordinate, and underground save tests. |
| Executable pack host | GamePack runtime metadata uses strings; two bootability allowlists and useAureusEngine still select/construct Aureus | Once domain ownership is removed, introduce one typed runtime factory registry and an Aureus adapter. Explicit unknown/unsupported pack requests must fail, not silently boot Aureus. |

Worldgen instructions prohibit changing seeds, frequencies, or biome distribution without a requested world reset. This extraction does not modify worldgen files or worker messages. Separation can preserve those algorithms byte-for-byte behind a game adapter; it should not rebalance or regenerate existing worlds.

## Honest second-pack acceptance gate

Use the real host and clock, an unrelated state shape, a resource-changing command and tick rule, snapshots, save/load, and teardown. Verify that no AureusWorld, initial-state factory, authored data, or domain enums occur in the sample's dependency closure. Test pack identity rejection before state mutation and preservation of legacy Aureus saves. Run both through the same factory registry, not the current fallback launcher or mocks. The repository's separation spec requires finishing domain extraction before presenting this as the engine-independence milestone.

## Local smoke findings

An isolated headless Chromium session on loopback rendered terrain, water, foliage, agents and HUD; advanced real simulation ticks; purchased Diamond-Tipped Drills through Ops > Tech for 2,000 AGT; and instantiated all 79 registered voxel factories without exceptions. The test used temporary browser storage and blocked external requests. Missing external fonts/analytics/CDN requests produced fetch errors, so this was not an error-free console or visual-polish certification.

The existing Continue UI is blocked by a save-key mismatch: `game/world/persistenceBridge.ts:hasStoredSave` checks `aureus-game-state`, while `game/state/PersistenceManager.ts` writes `aureus_save_v2`. Both are identical at the asset-extraction baseline. The saved research was verified through the actual load API instead; the UI resume defect is a separate follow-up, not hidden by changing this extraction's behavior.
