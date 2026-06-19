import test from 'node:test';
import assert from 'node:assert/strict';

import { StateManager } from '../engine/state/StateManager.ts';
import { ChunkStore } from '../engine/space/ChunkStore.ts';
import { PowerGridSystem } from '../engine/sim/systems/PowerGridSystem.ts';
import { WaterNetworkSystem } from '../engine/sim/systems/WaterNetworkSystem.ts';
import { BuildingType } from '../types.ts';
import type { GameState, GridTile } from '../types.ts';

function tile(state: GameState, x: number, z: number): GridTile {
    const found = ChunkStore.getTile(state.chunks, x, z);
    assert.ok(found, `expected tile at ${x},${z}`);
    return found;
}

function clearTile(state: GameState, x: number, z: number): GridTile {
    const target = tile(state, x, z);
    Object.assign(target, {
        buildingType: BuildingType.EMPTY,
        level: 1,
        foliage: 'NONE',
        isUnderConstruction: false,
        constructionTimeLeft: 0,
        structureHeadX: undefined,
        structureHeadZ: undefined,
        powerStatus: undefined,
        waterStatus: undefined,
    });
    return target;
}

function place(state: GameState, x: number, z: number, buildingType: BuildingType): GridTile {
    const target = clearTile(state, x, z);
    target.buildingType = buildingType;
    return target;
}

test('power allocation keeps priority housing supplied during a brownout', () => {
    const state = new StateManager({ cheatsEnabled: true }).getMutableState();

    for (const [x, z] of [[0, 0], [1, 0], [1, 1], [2, 0], [2, 1]]) {
        clearTile(state, x, z);
    }

    place(state, 0, 0, BuildingType.SOLAR_ARRAY); // 5 power at peak sun
    place(state, 1, 0, BuildingType.POWER_LINE);
    place(state, 1, 1, BuildingType.POWER_LINE);
    const housing = place(state, 2, 0, BuildingType.STAFF_QUARTERS); // priority 90, consumes 1
    const industry = place(state, 2, 1, BuildingType.WASH_PLANT); // priority 70, consumes 5

    state.dayNightCycle = { ...(state.dayNightCycle as any), isDaytime: true, timeOfDay: 12000 };
    state.weather = { ...(state.weather as any), type: 'CLEAR' };

    new PowerGridSystem().tick({ time: 1.1 } as any, state);

    assert.equal(state.powerGrid.totalProduced, 5);
    assert.equal(state.powerGrid.deficit, 1);
    assert.equal(housing.powerStatus, 'CONNECTED');
    assert.equal(industry.powerStatus, 'DISCONNECTED');
});

test('water allocation keeps priority housing supplied during a shortage', () => {
    const state = new StateManager({ cheatsEnabled: true }).getMutableState();

    for (const [x, z] of [
        [0, 5], [1, 5], [1, 6], [1, 7], [1, 8],
        [2, 5], [2, 6], [2, 7], [2, 8],
    ]) {
        clearTile(state, x, z);
    }

    place(state, 0, 5, BuildingType.WATER_WELL); // 10 water
    place(state, 1, 5, BuildingType.PIPE);
    place(state, 1, 6, BuildingType.PIPE);
    place(state, 1, 7, BuildingType.PIPE);
    place(state, 1, 8, BuildingType.PIPE);
    const housing = place(state, 2, 5, BuildingType.STAFF_QUARTERS); // priority 100, consumes 1
    const washPlant = place(state, 2, 6, BuildingType.WASH_PLANT); // priority 65, consumes 5
    const refinery = place(state, 2, 7, BuildingType.GEM_REFINERY); // priority 65, consumes 3
    const trainStation = place(state, 2, 8, BuildingType.TRAIN_STATION); // priority 50, consumes 2

    state.weather = { ...(state.weather as any), type: 'CLEAR' };

    new WaterNetworkSystem().tick({ time: 1.1 } as any, state);

    assert.equal(state.waterNetwork.totalProduced, 10);
    assert.equal(state.waterNetwork.deficit, 1);
    assert.equal(housing.waterStatus, 'CONNECTED');
    assert.equal(washPlant.waterStatus, 'CONNECTED');
    assert.equal(refinery.waterStatus, 'CONNECTED');
    assert.equal(trainStation.waterStatus, 'DISCONNECTED');
});
