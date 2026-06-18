import test from 'node:test';
import assert from 'node:assert/strict';

import { BUILDINGS } from '../engine/data/VoxelConstants.ts';
import { getUtilityReadability } from '../engine/sim/utility/UtilityReadability.ts';
import { BuildingType } from '../types.ts';
import type { GridTile } from '../types.ts';

function tile(buildingType: BuildingType, powerStatus: GridTile['powerStatus'], waterStatus: GridTile['waterStatus']): GridTile {
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
