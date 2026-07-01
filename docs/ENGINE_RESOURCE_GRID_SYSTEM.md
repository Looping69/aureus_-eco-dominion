# Engine Resource Grid System

## Purpose

Aureus currently solves water and power as project-specific simulation systems. That works for this game, but it keeps the engine from becoming a reusable RTS and simulation framework. The Resource Grid System is the engine-level abstraction for any tile or voxel network that moves capacity from producers, through carriers, to consumers.

The first client remains Aureus. Water pipes, reservoirs, power lines, solar arrays, and factories should eventually be expressed as generic resource-grid participants rather than hand-written water or power branches.

## Design Goals

- Deterministic: identical inputs produce identical outputs across browsers and machines.
- Chunk-safe: participants can be collected from streamed chunks without depending on render state.
- Data-driven: buildings, entities, and mods register producer/carrier/consumer roles through schema data.
- Network-agnostic: the solver should handle water, power, heat, signal, fluids, conveyors, or custom mod resources.
- Allocation-aware: connection and supply are separate. A consumer can be physically connected but unsupplied during shortages.
- Incremental migration: existing Aureus water and power systems can move onto the solver one network at a time.

## Core Concepts

### Network Type

A stable string identifying the resource graph, for example:

- `water`
- `power`
- `heat`
- `items.ore`
- `signal.security`

The engine should not special-case these names.

### Participant

A participant is a node in a grid graph. One tile, building, entity, or voxel cell can register more than one role.

Roles:

- `PRODUCER`: contributes available capacity to a network.
- `CARRIER`: conducts the network across adjacent grid cells.
- `CONSUMER`: requests capacity from a connected network.

Common fields:

- `id`: deterministic stable id.
- `networkType`: resource network key.
- `x`, `z`: grid coordinate.
- `roles`: participant roles.
- `production`: amount produced when the node is a producer.
- `demand`: amount requested when the node is a consumer.
- `priority`: allocation priority during shortages.
- `serviceRadius`: radius from connected producer/carrier cells that can reach consumers.
- `serviceMetric`: `MANHATTAN` or `CHEBYSHEV` service-distance rule.

### Connectivity

The first solver slice uses orthogonal grid adjacency for conductive nodes. A producer with positive production starts a connected component. The component expands through conductive producers and carriers. Connected conductive nodes can serve consumers inside their service radius.

Future solver modes may add:

- directional conveyors
- weighted edges
- pressure or voltage loss
- per-edge capacity
- underground layer constraints
- chunk-border dirty-region updates

### Allocation

The solver separates physical connection from resource allocation:

1. Find connected components reachable from producing sources.
2. Mark consumers that are physically serviceable by connected nodes.
3. Sort connected consumers by priority, then deterministic id.
4. Allocate available production until exhausted.
5. Report supplied, shortage, and disconnected consumers separately.

This supports brownouts, water shortages, partial service, and priority-driven emergency allocation.

## Aureus Migration Plan

### Step 1: Introduce Engine Solver

Add a standalone `engine/sim/resourceGrid` module with pure data inputs and deterministic results. No Aureus building enums should be required by the solver.

### Step 2: Add Adapter Functions

Create small Aureus adapters that collect participants from `BUILDINGS` and `GridTile` state:

- Reservoirs and ponds register as water producers.
- Completed underground pipes and legacy surface pipes register as water carriers with radius 3.
- Water-consuming buildings register as consumers with priority.
- Solar arrays and wind turbines register as power producers.
- Power lines register as power carriers.
- Power-consuming buildings register as consumers with priority.

### Step 3: Replace WaterNetworkSystem Internals

Keep the public `state.waterNetwork` output shape, but compute connectivity and allocation through the generic solver. Preserve current gameplay behavior first, then optimize.

### Step 4: Replace PowerGridSystem Internals

Move power to the same solver once water is stable. This proves the abstraction handles multiple utility types.

### Step 5: Schema-Drive Registration

Move participant declarations into declarative building/entity schema data:

```json
{
  "id": "reservoir",
  "resourceGrid": [
    { "networkType": "water", "roles": ["PRODUCER"], "production": 120 },
    { "networkType": "water", "roles": ["CARRIER"], "serviceRadius": 3, "serviceMetric": "CHEBYSHEV" }
  ]
}
```

## Success Criteria

- Water and power both use the same engine-level graph and allocation solver.
- Network behavior is covered by pure deterministic tests.
- Aureus-specific code is limited to participant collection, priority definitions, and status write-back.
- New networks can be added by data/config and a thin adapter, not by cloning a whole simulation system.
