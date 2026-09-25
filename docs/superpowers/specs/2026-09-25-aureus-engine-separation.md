# Aureus Engine: executable game-pack boundary

**Design draft — 25 September 2026**  
**Repository:** `Looping69/aureus_-eco-dominion`, `main` at `9e025e3150b26b6bd67ced63a3d9614bd89c40f5` when inspected.

## Purpose and success test

Build a reusable game engine with Eco Dominion as its first complete game. **First finish the separation:** engine-owned modules must not instantiate or import Eco Dominion state, rules, resources, or UI. Only after that, boot a second, minimal game pack to prove the boundary. The second pack is a verification fixture, not the goal or a shortcut around unfinished extraction. Keep Eco Dominion playable throughout.

## Current state observed

- `engine/game-pack/GamePack.ts` defines metadata, a definition, module-name strings, and a registry. Registration works, but module strings are not executable factories.
- `game/gamePackRuntime.ts` explicitly allows only the Aureus world module. Selecting `sample.micro-colony` falls back to Aureus. `game-definitions/activeGameDefinition.ts` repeats the bootable-module allowlist.
- `game/useAureusEngine.ts` always constructs `AureusWorld`; `tests/game-pack-boundary-contract.test.ts` explicitly protects that behavior. The sample pack declares a placeholder tick system and `SAMPLE_PING`, but cannot boot.
- `engine/state/StateManager.ts` constructs an Eco Dominion `GameState` with AGT, mining, agents, bureaucracy, dungeon, and other game rules. It is therefore not yet a generic engine state manager despite its location.
- `game/AureusWorld.ts` assembles the Eco Dominion simulation and renderer directly. This is a sensible game adapter, provided generic orchestration stops depending on it.
- `game/useAureusEngine.ts` still reloads whole game state for layered view, dig mode, fog removal, and factory planner state. Goal claims and sector policy have been moved to commands in merged PR #56.
- `docs/ENGINE_CONTRACT.md` says simulation runs at 60 Hz and only simulation ticks mutate state, while the current hook configures 30 Hz and some paths mutate or reload state outside dispatch. Treat the document as an intended contract, not a description of current enforcement.
- `game/world/persistenceBridge.ts` writes news and effects to state when saving and uses the Aureus-specific save key. It is not a generic save adapter.

## Architectural decision

Start with a **dependency inventory and extraction boundary**. Classify every import and responsibility under `engine/`: reusable mechanism, Eco Dominion rule/data, or transitional coupling. Move game-specific initial-state creation, rule tables, simulation systems, and save normalization into the Eco Dominion pack, while keeping reusable scheduler, queue, worker, spatial, and rendering mechanisms under `engine/`. Then add a **runtime factory per game pack** behind the existing registry. Keep `AureusWorld` as Eco Dominion's world implementation. Introduce a small engine-owned host contract that accepts a pack runtime and controls lifecycle, fixed ticks, commands, snapshots, and teardown. The game pack supplies initial state, command handlers or systems, presentation adapter, and save codec. Extract incrementally with compatibility adapters so current saves and gameplay survive.

Avoid a generic `GameState` union assembled from every Eco Dominion field. The engine contract should be generic over game state and command payload, with a narrow common command envelope and lifecycle interface. A pack owns its own state schema and migrations. Engine facilities such as scheduler, command sequencing, event delivery, workers, and rendering abstractions may be shared without acquiring Eco Dominion's economy types.

## Proposed interfaces and flow

1. A runtime registry maps a pack ID to a typed factory, not a string path. Unknown or unbootable packs return a visible selection error; they must not silently launch another game's save or state. Preserve existing Aureus default startup until explicit selection is wired.
2. A factory receives engine services (clock, command queue, renderer host, storage adapter, worker services) and creates a runtime implementing `initialize`, `tick`, `getSnapshot`, `dispatch`, `save`, `load`, and `dispose`. Keep the surface small; adapters can wrap existing `AureusWorld` methods initially.
3. UI and AI enqueue commands. The host assigns deterministic tick and sequence metadata. The pack validates and applies domain commands in its fixed tick; rejected commands do not partially mutate gameplay state. Camera and transient overlays remain presentation actions. Pausing and save feedback are explicitly modelled rather than patched into gameplay snapshots.
4. Saves carry `packId`, schema version, engine compatibility version, and payload. Loading rejects a mismatched pack before state mutation. Existing Aureus saves get a tested migration path or continue through a clearly scoped legacy adapter.
5. A minimal sample pack must execute one meaningful resource-changing command and one tick rule, then demonstrate save/load and isolation. Its test must fail if an Aureus world or Eco Dominion state initializer is used.

## Execution slices and acceptance criteria

### Slice 1 — inventory and dependency direction

- Inventory `engine/` imports of `types.ts`, `engine/data`, game definitions, and Eco Dominion-specific modules. Produce a reviewed move/retain/adapter table for each game-specific dependency cluster, including `StateManager`, simulation systems, persistence, world generation, and rendering data.
- Define and enforce one-way dependencies: `engine/` may depend on engine interfaces and standard libraries; a game pack may depend on `engine/`; the engine may invoke a pack only through injected interfaces. Add an import-boundary check with explicit temporary exceptions and a count that must decline to zero.
- Establish baseline Eco Dominion command, deterministic tick, save/load, and build tests before moves. Update `docs/ENGINE_CONTRACT.md` to state the current 30 Hz configuration and transitional mutation paths accurately.

### Slice 2 — extract Eco Dominion ownership

- Move `StateManager`'s Eco Dominion initial-state factory and normalization to game-owned code; retain generic snapshot, subscription, command-queue, and deterministic RNG mechanics in the engine. This may use a typed state/codec adapter while existing `GameState` consumers migrate.
- Move game-specific tables and systems currently beneath `engine/data`, `engine/sim/systems`, and relevant worldgen/persistence paths into an Eco Dominion package, or inject their definitions through a game-owned composition root. Do not relocate truly reusable algorithms solely because an Aureus caller uses them.
- Ensure the engine package has zero runtime imports of Eco Dominion state, resources, rules, or components. Tests must exercise reusable mechanisms with a non-Aureus state fixture.

### Slice 3 — executable runtime boundary

- Add a typed runtime factory/host interface in `engine/`, an Aureus adapter in `game/`, and an actual sample pack runtime in `game-definitions/` or `examples/`.
- Replace the two bootability allowlists with one runtime registry. Explicit pack selection must boot that pack or report an error.
- Verify the sample pack's boot, command, tick, snapshot, teardown, and independence from `AureusWorld`. Keep default Aureus boot working.

### Slice 4 — command ownership

- Split `UPDATE_FACTORY_PLANNER`: camera focus, preview, and overlay are presentation; pin and emergency relief changes become validated simulation commands.
- Migrate layered world, dig mode, and fog changes according to whether they affect gameplay. The fog cheat is auditable and persisted deliberately.
- Test command order, rejection atomicity, replay equality for a fixed seed, and the absence of whole-state reloads from normal gameplay UI actions.

### Slice 5 — persistence and second-pack proof

- Put pack ID and schema version into saves; add round-trip and cross-pack rejection tests. Verify legacy Aureus saves before replacing the current storage path.
- Run the sample runtime through the same launcher and build gate as Aureus, with a browser smoke test of each pack where a browser environment is available.

### Slice 6 — Eco Dominion quality gate

- Play one complete colony session, including factory logistics and the Deep Ledger survey-to-mitigation loop. Log gameplay defects separately from engine boundary defects.
- Only then tune balance and replace Deep Ledger patch modules where tests and actual play show a need.

## Validation

For each slice run `npm run typecheck`, `npm run test:contracts`, and `npm run build`, plus focused executable tests. A successful Vercel build cannot substitute for WebGL, interaction, mobile, or long-session save/load playtesting. Track command replay determinism independently from build success.

## Risks and migration controls

- Full conversion of `StateManager<GameState>` in one change would put saves and every simulation system at risk. Use an adapter and move generic ownership behind the runtime boundary incrementally.
- Silent fallback currently risks showing Aureus while a different pack was selected. Make errors explicit before enabling public pack selection.
- Both `GAME_PACK_REGISTRY` and `GAME_DEFINITION_REGISTRY` can drift; designate the pack registry as the source of the active definition.
- Scope engine abstractions to behavior proven by the sample runtime. Do not build plugin loading, multiplayer, or a public SDK as part of this milestone.

## Review decisions

This draft assumes that Eco Dominion stays the default launched game, that the sample pack is an internal conformance example, and that existing Aureus saves must remain readable. Confirm these product constraints before implementation planning.
