# Runtime boundary assessment after spatial extraction

This is an implementation assessment, not a claim of a completed independent engine or second-pack boot.

## Current reusable boundary

- Runtime, WorldHost, StateStore, JsonSaveStorage, SeededRandom, resource-grid solving, geometry, and procedural math remain engine-owned.
- Simulation and lockstep modules consume `engine/kernel/Command.ts:EngineCommand`; they no longer import Aureus command/state types.
- `engine/space/TileStore.ts` indexes caller-supplied chunks/tiles; `game/space/ChunkStore.ts` retains existing Aureus generation and dirtiness policy.
- `engine/sim/algorithms/GridPathfinding.ts` runs the existing A* with injected traversal costs. The game adapter retains terrain costs, passability, and destination behavior.
- WorkerPool accepts a worker factory or URL. AureusWorld supplies `game/jobs/aureus.worker.ts` through a bundler-compatible factory. The message protocol and schema version are unchanged.
- Domain types, world generation, underground/subsurface rules, dungeon rules, weather, day/night, contract lifecycle, and building levels now live under `game/`.

The static relative-import inventory is zero. The historical baseline is unchanged; an additional test requires zero imports. This scanner does not prove semantic independence or inspect every runtime dependency. In particular, worker job messages and some render/input abstractions still reflect the original game use case.

## Verification

The spatial extraction passes TypeScript checking, all 276 configured build contracts, Vite production bundling, and five boundary/RNG checks. The built worker is emitted as a separate `aureus.worker` asset. No lint script is configured. Existing bundle-size and Browserslist warnings remain.

The 157 affected existing tests were compared with detached baseline `457fa3489f51e25599e4c9a600f57f461b515e97`: both report 140 passes and 17 failures, with identical failing titles. Three new failures caused by relocated import expectations were corrected. Existing source-contract drift and building-level fixtures remain separate work.

All 27 directly moved module bodies preserve their non-import TypeScript syntax trees. The two intentional adapter changes are ChunkStore and Pathfinding; their extracted mechanisms have independent tests. Fixed chunk-coordinate fixtures for seeds 0, 42, and 987654 preserve exact tile hashes and four exact routes each, including negative coordinates, same-cell, and missing-destination cases. Current surface generation does not use its seed parameter; this behavior is preserved rather than silently changed. Worldgen seeds, noise, and distributions are unchanged.

## Continue save repair and local smoke

Commit `457fa34` fixes the pre-existing save-key mismatch using the existing `aureus_save_v2` key. Loading returns success, and Continue only dismisses the home screen after successful restoration. Existing saves are neither renamed nor deleted; corrupted saves remain stored and do not partially mutate state.

After the spatial extraction, isolated local Chromium rendered the colony, advanced real ticks, purchased Diamond-Tipped Drills for 2,000 AGT, saved, reloaded, displayed Continue, restored the research, and resumed ticking (observed tick 109). All 79 registered voxel factories instantiated without exceptions. Browser storage was temporary. External fonts, analytics, and CDN requests were blocked and caused fetch errors, so this is not an error-free console or a visual-polish certification.

## Next milestone: executable pack host

The launcher still constructs Aureus directly. Sample colony metadata points to runtime/state/UI modules that do not exist, and unsupported selection still falls back to Aureus. Introduce one typed runtime factory registry and route both packs through it. Explicit unknown or unsupported pack IDs must reject rather than silently boot Aureus.

For independent-pack proof, implement an unrelated state shape with a resource-changing command and tick rule, then use the real Runtime and WorldHost for startup, snapshots, save/load, and teardown. Verify that the sample runtime dependency closure excludes AureusWorld, initial-state factory, authored data, and domain enums. Reject incompatible pack saves before mutation and preserve legacy Aureus saves. Browser-test both launch paths through the same registry. No second-pack independence proof is claimed yet.
