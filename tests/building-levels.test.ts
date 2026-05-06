import test from 'node:test';
import assert from 'node:assert/strict';

import { Era, BuildingType } from '../types.ts';
import { BUILDINGS } from '../engine/data/VoxelConstants.ts';
import { StateManager } from '../engine/state/StateManager.ts';
import { ConstructionSystem } from '../engine/sim/systems/ConstructionSystem.ts';
import { getVisualBuildingLevel, resolveBuildingDefinition } from '../engine/utils/buildingLevels.ts';

test('placeBuilding initializes upgradeable buildings at level 1', () => {
    const stateManager = new StateManager();
    const state = stateManager.getMutableState();
    const constructionSystem = new ConstructionSystem();

    constructionSystem.placeBuilding(100, BuildingType.STAFF_QUARTERS, state, false);

    assert.equal(state.grid[100].level, 1);
    assert.equal(state.grid[100].buildingType, BuildingType.STAFF_QUARTERS);
    assert.equal(state.grid[100].isUnderConstruction, true);
});

test('upgradeBuilding advances the building level and syncs multi-tile footprints', () => {
    const stateManager = new StateManager();
    const state = stateManager.getMutableState();
    const constructionSystem = new ConstructionSystem();

    state.resources.agt = 10000;
    state.resources.minerals = 1000;
    state.resources.gems = 100;
    state.unlockedEras = [Era.SETTLEMENT, Era.GROWTH, Era.INDUSTRY, Era.SUSTAINABILITY];

    constructionSystem.placeBuilding(100, BuildingType.STAFF_QUARTERS, state, true);
    constructionSystem.upgradeBuilding(100, state);

    assert.equal(state.grid[100].level, 2);
    assert.equal(state.grid[101].level, 2);
    assert.equal(state.grid[145].level, 2);
    assert.equal(state.grid[146].level, 2);
});

test('resolveBuildingDefinition returns the upgrade stats for the current level', () => {
    const resolved = resolveBuildingDefinition(BUILDINGS[BuildingType.STAFF_QUARTERS], 3);

    assert.equal(resolved.name, 'Row Housing');
    assert.equal(resolved.maintenance, 8);
    assert.equal(resolved.power?.consumes, 4);
});

test('getVisualBuildingLevel uses staged construction progress for four-level buildings', () => {
    const def = BUILDINGS[BuildingType.STAFF_QUARTERS];

    assert.equal(getVisualBuildingLevel(def, 1, true, 0), 1);
    assert.equal(getVisualBuildingLevel(def, 1, true, 0.26), 2);
    assert.equal(getVisualBuildingLevel(def, 1, true, 0.51), 3);
    assert.equal(getVisualBuildingLevel(def, 1, true, 0.76), 4);
    assert.equal(getVisualBuildingLevel(def, 2, false, 1), 2);
});
