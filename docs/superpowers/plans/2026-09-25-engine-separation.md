# Engine Separation Implementation Plan

**Goal:** Remove Eco Dominion ownership from reusable engine modules while preserving the playable game and saves.

**Architecture:** Establish an import boundary and measured baseline, extract reusable mechanisms and game-owned data in small slices, then boot a second pack as proof. Existing game integration remains working throughout.

**Tech Stack:** TypeScript, Node test runner, React, Vite, Three.js.

**Spec:** `docs/superpowers/specs/2026-09-25-aureus-engine-separation.md`.

## Global constraints

- Eco Dominion remains the default game.
- Existing saves remain readable.
- Every slice passes `npm run typecheck`, `npm run test:contracts`, and `npm run build` before merging.
- A second game pack proves separation; it does not replace the extraction work.

## Tasks

1. **Boundary baseline.** Scan runtime imports in `engine/`; resolve relative paths; classify imports of root `types.ts`, game/UI, and game-owned data. Store a machine-readable baseline and fail if new dependencies are added. Test that the scanner catches a newly added forbidden import. Record the current top coupling clusters.
2. **Reusable state primitives.** Extract deterministic RNG and subscription/dirty tracking to engine-only modules. Retain behavior through existing `StateManager` tests and an independent fixture.
3. **State factory.** Move Eco Dominion initial state and save normalization to game-owned modules. Inject the factory and codec into generic state storage. Preserve old-save fixtures and no-argument Aureus boot via a game adapter.
4. **Game rules.** Relocate domain tables and simulation systems from `engine/data` and `engine/sim/systems`, leaving shared algorithms and system interfaces in `engine/`. Reduce the boundary baseline to zero by subsystem, testing simulation outcomes after each move.
5. **Runtime host.** Replace string-only pack runtime metadata and duplicated bootability allowlists with a typed factory registry. Boot both Aureus and a minimal independent sample game and reject unknown packs explicitly.
6. **Commands and saves.** Route planner and other gameplay writes through fixed-tick commands, separate camera/overlay presentation, and tag saves with pack identity and version while migrating legacy Aureus saves.
7. **Play verification.** Run fixed-seed replay and cross-pack isolation tests, then browser-play the Eco Dominion factory and Deep Ledger loops.

## This branch

Execute tasks 1 and the deterministic RNG portion of task 2. Later tasks each require their own independently reviewable PR because moving all 214 engine files in one diff would make regressions hard to locate.
