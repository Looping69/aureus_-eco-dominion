import test from 'node:test';
import assert from 'node:assert/strict';

import { BUILDINGS } from '../engine/data/VoxelConstants.ts';
import { getUtilityReadability } from '../engine/sim/utility/UtilityReadability.ts';
import { getWaterDiagnostic } from '../engine/sim/utility/WaterDiagnostics.ts';
import { BuildingType } from '../types.ts';
import type { GridTile } from '../types.ts';

function tile(buildingType: BuildingType, powerStatus: GridTile['powerStatus'], waterStatus: GridTile['waterStatus'], waterShortage = false): GridTile {
    return {
        id: 1,
        x: 0,
        z: 0,
        buildingType,
        level: 1,
        terrainHeight: 0,
        biome: 'GRASS',
        foliage: 'NONE',
        powerStatus,
        waterStatus,
        waterShortage,
    };
}

test('utility readability reports local consumer failures', () => {
    const washPlant = BUILDINGS[BuildingType.WASH_PLANT];
    assert.ok(washPlant, 'expected wash plant building definition');

    const reasons = getUtilityReadability(
        tile(BuildingType.WASH_PLANT, 'DISCONNECTED', 'DISCONNECTED'),
        washPlant
    );

    assert.deepEqual(reasons, ['Offline: no power', 'Water-starved']);
});

test('utility readability stays quiet for fully supplied consumers', () => {
    const washPlant = BUILDINGS[BuildingType.WASH_PLANT];
    assert.ok(washPlant, 'expected wash plant building definition');

    const reasons = getUtilityReadability(
        tile(BuildingType.WASH_PLANT, 'CONNECTED', 'CONNECTED'),
        washPlant
    );

    assert.deepEqual(reasons, []);
});

test('utility readability explains underpowered reservoir output', () => {
    const reservoir = BUILDINGS[BuildingType.RESERVOIR];
    assert.ok(reservoir, 'expected reservoir building definition');

    const reasons = getUtilityReadability(
        tile(BuildingType.RESERVOIR, 'DISCONNECTED', 'CONNECTED'),
        reservoir
    );

    assert.deepEqual(reasons, ['Reservoir underpowered: 25% output']);
});

test('water diagnostics distinguish missing pipes from supply shortages', () => {
    const washPlant = BUILDINGS[BuildingType.WASH_PLANT];
    assert.ok(washPlant, 'expected wash plant building definition');

    assert.deepEqual(
        getWaterDiagnostic(tile(BuildingType.WASH_PLANT, 'CONNECTED', 'DISCONNECTED'), washPlant),
        { code: 'NO_PIPE_CONNECTION', label: 'No pipe connection', blocksProduction: true }
    );

    assert.deepEqual(
        getWaterDiagnostic(tile(BuildingType.WASH_PLANT, 'CONNECTED', 'DISCONNECTED', true), washPlant),
        { code: 'SUPPLY_SHORTAGE', label: 'Water shortage: add supply', blocksProduction: true }
    );
});

test('water diagnostics stay quiet when water is connected or not required', () => {
    const washPlant = BUILDINGS[BuildingType.WASH_PLANT];
    const road = BUILDINGS[BuildingType.ROAD];
    assert.ok(washPlant, 'expected wash plant building definition');
    assert.ok(road, 'expected road building definition');

    assert.deepEqual(
        getWaterDiagnostic(tile(BuildingType.WASH_PLANT, 'CONNECTED', 'CONNECTED'), washPlant),
        { code: 'NONE', label: null, blocksProduction: false }
    );

    assert.deepEqual(
        getWaterDiagnostic(tile(BuildingType.ROAD, undefined, undefined), road),
        { code: 'NO_WATER_NEED', label: null, blocksProduction: false }
    );
});
