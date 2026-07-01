# Subsurface Reset Plan

## Decision

`layeredWorld` is now the canonical underground model. The old dungeon-style mine, Deep Ledger survey HUD, and separate underground scene can remain in the repo temporarily, but they are no longer the direction for new underground gameplay.

The goal is one continuous world stack:

- Surface terrain lives at `surfaceY`.
- Open-pit mining reveals and removes cells below the surface from the normal surface camera.
- Deep mines later use shafts/elevators to enter enclosed layers, but they still read and mutate the same `layeredWorld` cells.
- Surface systems can see subsurface changes, so pits, shafts, foundations, ore exposure, and future hazards can connect directly to the top layer.

## Keep

- `LayeredWorldState`, `WorldVoxelCell`, and generated vertical cells.
- `DIG_VOXEL` as the command for removing generated subsurface cells.
- The surface-layer overlay renderer, because it already draws the active layer over the same surface coordinate system.
- Survey Drill as the access/unlock concept for excavation authority.

## Retire Or Bypass

- `DungeonState` as a gameplay source of truth.
- Dungeon-only miners, mine orders, and black-box dungeon rendering.
- Deep Ledger survey state as the primary underground UI.
- Any cursor path that selects old dungeon blocks instead of `layeredWorld` cells.

These can be deleted once replacement UI, rendering, and tests no longer reference them.

## New Player-Facing Modes

### Surface

The normal game. Buildings, workers, roads, power, water, animals, and colony management happen here.

### Open-Pit Cut

The player stays in the surface view, but the active layer is below `surfaceY`. The map shows the chosen subsurface layer in place, and `DIG` removes selected cells. This is the first playable mining mode because it makes the underground visibly connected to the surface.

### Deep Mine

Future phase. A mine shaft or elevator opens a deeper interior view, but it still edits the same `layeredWorld` cells. This allows fully underground mines without creating a second disconnected world.

## Implementation Phases

1. Foundation reset
   - Add a small subsurface model module for layer keys, active-layer targeting, resource yields, and excavation.
   - Route `DIG_VOXEL` through that model.
   - Make the Below Sector control open layer `surfaceY - 1` instead of switching to the old dungeon scene.

2. Open-pit playability
   - Add clear cell selection feedback on active subsurface layers.
   - Add mineable/blocked tooltips: ore, stone, bedrock, water pocket, unsupported block.
   - Make workers claim excavation jobs instead of instant/manual-only digging.

3. Surface connection
   - When enough cells are removed, mark surface tiles as pit edges/open cuts.
   - Let exposed ore, slopes, roads, fences, pipes, and powerlines respond to pit geometry.
   - Add safety rules: collapse risk, water ingress, access ramps, supports.

4. Deep mine replacement
   - Add shafts/elevators as access points into the same `layeredWorld` layers.
   - Build a compact mine interior camera only after open-pit mining feels reliable.
   - Delete old dungeon systems after feature parity is reached.

## Why This Path

The previous underground direction split the game into separate realities. That made selection, rendering, agents, and resources difficult to reason about. A single layered world lets the surface and underground share coordinates, resources, and consequences. It supports open-pit mining now and deeper enclosed mines later without rebuilding the rules twice.
