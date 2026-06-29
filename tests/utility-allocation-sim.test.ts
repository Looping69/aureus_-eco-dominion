import test from 'node:test';
import assert from 'node:assert/strict';

import { BUILDINGS } from '../engine/data/VoxelConstants.ts';
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
        waterShortage: undefined,
    });
    return target;
}

function clearWorld(state: GameState): void {
    for (const chunk of Object.values(state.chunks)) {
        for (const target of chunk.tiles) {
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
                waterShortage: undefined,
            });
        }
    }
}

function place(state: GameState, x: number, z: number, buildingType: BuildingType): GridTile {
    const target = clearTile(state, x, z);
    target.buildingType = buildingType;
    return target;
}

function placeFootprint(state: GameState, x: number, z: number, buildingType: BuildingType): GridTile[] {
    const def = BUILDINGS[buildingType];
    assert.ok(def, `expected definition for ${buildingType}`);
    const placed: GridTile[] = [];

    for (let dz = 0; dz < (def.depth || 1); dz++) {
        for (let dx = 0; dx < (def.width || 1); dx++) {
            const target = place(state, x + dx, z + dz, buildingType);
            target.structureHeadX = x;
            target.structureHeadZ = z;
            placed.push(target);
        }
    }

    return placed;
}

test('power allocation keeps priority housing supplied during a brownout', () => {
    const state = new StateManager({ cheatsEnabled: true }).getMutableState();
    clearWorld(state);

    place(state, 0, 0, BuildingType.GENERATOR); // 10 power
    place(state, 1, 0, BuildingType.POWER_LINE);
    place(state, 1, 1, BuildingType.POWER_LINE);
    place(state, 1, 2, BuildingType.POWER_LINE);
    place(state, 1, 3, BuildingType.POWER_LINE);
    const reservoir = place(state, 2, 0, BuildingType.RESERVOIR); // priority 100, consumes 2
    const housing = place(state, 2, 1, BuildingType.STAFF_QUARTERS); // priority 90, consumes 1
    const washPlant = place(state, 2, 2, BuildingType.WASH_PLANT); // priority 70, consumes 5
    const sawmill = place(state, 2, 3, BuildingType.SAWMILL); // priority 70, consumes 5

    new PowerGridSystem().tick({ time: 1.1 } as any, state);

    assert.equal(state.powerGrid.deficit, 3);
    assert.equal(reservoir.powerStatus, 'CONNECTED');
    assert.equal(housing.powerStatus, 'CONNECTED');
    assert.equal(
        [washPlant.powerStatus, sawmill.powerStatus].filter((status) => status === 'DISCONNECTED').length,
        1
    );
});

test('water allocation keeps priority housing supplied during a shortage', () => {
    const state = new StateManager({ cheatsEnabled: true }).getMutableState();
    clearWorld(state);

    place(state, 0, 5, BuildingType.WATER_WELL); // 10 water
    place(state, 1, 5, BuildingType.PIPE);
    place(state, 1, 6, BuildingType.PIPE);
    place(state, 1, 7, BuildingType.PIPE);
    place(state, 1, 8, BuildingType.PIPE);
    const housing = place(state, 2, 5, BuildingType.STAFF_QUARTERS); // priority 100, consumes 1
    const washPlant = place(state, 2, 6, BuildingType.WASH_PLANT); // priority 65, consumes 5
    const refinery = place(state, 2, 7, BuildingType.GEM_REFINERY); // priority 65, consumes 3
    const trainStation = place(state, 2, 8, BuildingType.TRAIN_STATION); // priority 50, consumes 2

    new WaterNetworkSystem().tick({ time: 1.1 } as any, state);

    assert.equal(state.waterNetwork.deficit, 1);
    assert.equal(housing.waterStatus, 'CONNECTED');
    assert.equal(housing.waterShortage, false);
    assert.equal(washPlant.waterStatus, 'CONNECTED');
    assert.equal(washPlant.waterShortage, false);
    assert.equal(refinery.waterStatus, 'CONNECTED');
    assert.equal(refinery.waterShortage, false);
    assert.equal(trainStation.waterStatus, 'DISCONNECTED');
    assert.equal(trainStation.waterShortage, true);
});

test('water shortage flag stays false when a consumer has no pipe path', () => {
    const state = new StateManager({ cheatsEnabled: true }).getMutableState();
    clearWorld(state);

    const housing = place(state, 8, 5, BuildingType.STAFF_QUARTERS);

    new WaterNetworkSystem().tick({ time: 1.1 } as any, state);

    assert.equal(housing.waterStatus, 'DISCONNECTED');
    assert.equal(housing.waterShortage, false);
});

test('power status assignment reaches every tile in a multi-tile footprint', () => {
    const state = new StateManager({ cheatsEnabled: true }).getMutableState();
    clearWorld(state);

    place(state, 0, 10, BuildingType.GENERATOR);
    place(state, 1, 10, BuildingType.POWER_LINE);
    const housingTiles = placeFootprint(state, 2, 10, BuildingType.STAFF_QUARTERS);

    new PowerGridSystem().tick({ time: 1.1 } as any, state);

    for (const placedTile of housingTiles) {
        assert.equal(placedTile.powerStatus, 'CONNECTED', `expected powered footprint tile ${placedTile.x},${placedTile.z}`);
    }
});

test('water status assignment reaches every tile in a multi-tile footprint', () => {
    const state = new StateManager({ cheatsEnabled: true }).getMutableState();
    clearWorld(state);

    place(state, 0, 14, BuildingType.WATER_WELL);
    place(state, 1, 14, BuildingType.PIPE);
    const housingTiles = placeFootprint(state, 2, 14, BuildingType.STAFF_QUARTERS);

    new WaterNetworkSystem().tick({ time: 1.1 } as any, state);

    for (const placedTile of housingTiles) {
        assert.equal(placedTile.waterStatus, 'CONNECTED', `expected watered footprint tile ${placedTile.x},${placedTile.z}`);
        assert.equal(placedTile.waterShortage, false, `expected no shortage flag on footprint tile ${placedTile.x},${placedTile.z}`);
    }
});

test('power restoration creates positive radio feedback only after a disconnected consumer reconnects', () => {
    const state = new StateManager({ cheatsEnabled: true }).getMutableState();
    clearWorld(state);
    state.newsFeed.length = 0;

    const system = new PowerGridSystem();
    const housing = place(state, 8, 0, BuildingType.STAFF_QUARTERS);
    system.tick({ time: 1.1 } as any, state);
    assert.equal(housing.powerStatus, 'DISCONNECTED');
    assert.equal(state.newsFeed.some((item) => item.headline.includes('Power restored')), false);

    place(state, 6, 0, BuildingType.GENERATOR);
    place(state, 7, 0, BuildingType.POWER_LINE);
    system.tick({ time: 2.2 } as any, state);

    assert.equal(housing.powerStatus, 'CONNECTED');
    assert.equal(state.newsFeed.some((item) => item.headline.includes('Power restored to Staff Quarters')), true);
});

test('water restoration creates positive radio feedback only after a disconnected consumer reconnects', () => {
    const state = new StateManager({ cheatsEnabled: true }).getMutableState();
    clearWorld(state);
    state.newsFeed.length = 0;

    const system = new WaterNetworkSystem();
    const housing = place(state, 8, 5, BuildingType.STAFF_QUARTERS);
    system.tick({ time: 1.1 } as any, state);
    assert.equal(housing.waterStatus, 'DISCONNECTED');
    assert.equal(housing.waterShortage, false);
    assert.equal(state.newsFeed.some((item) => item.headline.includes('Water restored')), false);

    place(state, 6, 5, BuildingType.WATER_WELL);
    place(state, 7, 5, BuildingType.PIPE);
    system.tick({ time: 2.2 } as any, state);

    assert.equal(housing.waterStatus, 'CONNECTED');
    assert.equal(housing.waterShortage, false);
    assert.equal(state.newsFeed.some((item) => item.headline.includes('Water restored to Staff Quarters')), true);
});
