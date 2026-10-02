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

## Executable pack milestone

`engine/game-pack/RuntimeRegistry.ts` registers typed asynchronous world factories without game IDs or services in engine code. `game-definitions/runtimeRegistry.ts` is the composition root. Both the Aureus hook/bootstrap and independent sample instantiate through this registry and run actual Runtime/WorldHost instances. The sample UI is available at `/sample-colony` or `/?pack=sample.micro-colony`; Aureus remains the default. Unknown IDs reject instead of falling back. Lazy entry points keep Aureus implementation modules out of the sample browser load.

The independent sample uses StateStore, Simulation, BaseWorld, command-definition validation, JsonSaveStorage, Runtime, and WorldHost. Its unrelated state is `{ticks, energy, beacons}`. One energy is generated per thirty ticks; queued SAMPLE_PING commands spend five energy for a beacon. Saves use a separate key and a validated pack/version envelope. Invalid saves reject before mutation; successful loads clear pending commands. Legacy Aureus serialization is unchanged, but foreign envelopes are rejected before migration.

Verification at this milestone: TypeScript, 283 configured tests, production build, and five boundary/RNG checks pass. The broader 157-test set remains 140 passing with the same 17 pre-existing failures. Browser proof covers sample registration/boot, resource ticks, command effects, save/load after reload, unknown-ID rejection, and actual runtime stop/unload. The sample route loads zero Aureus application modules. The sample runtime dependency closure test includes type imports and permits only sample modules and engine. Aureus browser smoke again passes purchase, save, reload, Continue, and resumed ticks through the same factory.

Self-review added foreign-save rejection and cancellation cleanup for Aureus initialization. The sample provides an independent runtime proof, not a feature-complete second game. Game UI adapters and save codecs remain pack-specific. The registry is a trusted local composition boundary, not a plugin sandbox. Shared Simulation still accepts broad state types, and the worker/render APIs retain original-use-case assumptions. Global engine telemetry/events and multi-world concurrency are not isolated; the supported browser flow runs one active UI pack. Bundle-size and stale Browserslist warnings remain; browser external fonts/CDN/analytics are blocked during tests.

## Remaining roadmap

1. Follow up on current-visibility styling, minimap consistency, and first-person night lighting after the isolated functional fog repair (see FIRST_PERSON_FOG_REPAIR.md).
2. Refine typed simulation state/command dispatch and formal pack save-codec/lifecycle contracts.
3. Expand rendering/input/worker portability with a second graphical use case and measured lifecycle/performance tests.
4. Resolve the separately baselined source-contract drift and building-level fixture failures.

## Subsequent first-person fog checkpoint

The isolated functional fog repair moves exploration updates into simulation and fixes first-person boundary anchoring and foreground depth behavior. Final configured count is 288 tests; broader affected count is 161 with 145 passes and 16 pre-existing failures, zero new failures. Engine boundary stays zero. See FIRST_PERSON_FOG_REPAIR.md for reproduction, browser evidence, preserved save semantics, and remaining limits.
