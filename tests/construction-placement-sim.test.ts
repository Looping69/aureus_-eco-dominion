import test from 'node:test';
import assert from 'node:assert/strict';

import { StateManager } from '../engine/state/StateManager.ts';
import { ConstructionSystem } from '../engine/sim/systems/ConstructionSystem.ts';
import { ChunkStore } from '../engine/space/ChunkStore.ts';
import { BuildingType } from '../types.ts';

function tile(state: ReturnType<StateManager['getMutableState']>, x: number, z: number) {
    const found = ChunkStore.getTile(state.chunks, x, z);
    assert.ok(found, `expected tile at ${x},${z}`);
    return found;
}

test('failed multi-tile placement validates the full footprint before mutating tiles', () => {
    const stateManager = new StateManager({ cheatsEnabled: true });
    const state = stateManager.getMutableState();
    const construction = new ConstructionSystem();

    tile(state, 1, 1).buildingType = BuildingType.ROAD;

    const result = construction.placeBuilding(0, 0, BuildingType.STAFF_QUARTERS, state);

    assert.equal(result.ok, false);
    assert.equal(tile(state, 0, 0).buildingType, BuildingType.EMPTY);
    assert.equal(tile(state, 1, 0).buildingType, BuildingType.EMPTY);
    assert.equal(tile(state, 0, 1).buildingType, BuildingType.EMPTY);
    assert.equal(tile(state, 1, 1).buildingType, BuildingType.ROAD);
    assert.equal(tile(state, 0, 0).isUnderConstruction, false);
    assert.equal(tile(state, 1, 0).isUnderConstruction, false);
    assert.equal(tile(state, 0, 1).isUnderConstruction, false);
});

test('multi-tile placement consumes one inventory item and stamps one shared structure head', () => {
    const stateManager = new StateManager({
        cheatsEnabled: false,
        inventory: { [BuildingType.STAFF_QUARTERS]: 1 } as any,
        selectedBuilding: BuildingType.STAFF_QUARTERS,
        interactionMode: 'BUILD',
    });
    const state = stateManager.getMutableState();
    const construction = new ConstructionSystem();

    const result = construction.placeBuilding(0, 0, BuildingType.STAFF_QUARTERS, state);

    assert.equal(result.ok, true);
    assert.equal(state.inventory[BuildingType.STAFF_QUARTERS], 0);
    assert.equal(state.selectedBuilding, null);
    assert.equal(state.interactionMode, 'INSPECT');

    for (const [x, z] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const placed = tile(state, x, z);
        assert.equal(placed.buildingType, BuildingType.STAFF_QUARTERS);
        assert.equal(placed.structureHeadX, 0);
        assert.equal(placed.structureHeadZ, 0);
        assert.equal(placed.isUnderConstruction, true);
    }
});

test('worker progress on a child tile completes the shared construction head', () => {
    const stateManager = new StateManager({ cheatsEnabled: true });
    const state = stateManager.getMutableState();
    const construction = new ConstructionSystem();

    const result = construction.placeBuilding(0, 0, BuildingType.STAFF_QUARTERS, state);
    assert.equal(result.ok, true);

    const finished = construction.progressConstruction(1, 1, 15, state);

    assert.equal(finished, true);
    for (const [x, z] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const placed = tile(state, x, z);
        assert.equal(placed.isUnderConstruction, false);
        assert.equal(placed.constructionTimeLeft, 0);
        assert.equal(placed.structureHeadX, 0);
        assert.equal(placed.structureHeadZ, 0);
    }
});
