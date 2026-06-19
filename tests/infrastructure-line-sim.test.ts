import test from 'node:test';
import assert from 'node:assert/strict';

import { getInfrastructureLinePlan, isInfrastructureLineType } from '../game/world/infrastructureLine.ts';
import { BuildingType } from '../types.ts';
import type { GameState } from '../types.ts';

function stateWithInventory(inventory: Partial<Record<BuildingType, number>>, cheatsEnabled = false): GameState {
    return {
        cheatsEnabled,
        inventory,
    } as GameState;
}

test('infrastructure line helper recognizes only line-placeable building types', () => {
    assert.equal(isInfrastructureLineType(BuildingType.ROAD), true);
    assert.equal(isInfrastructureLineType(BuildingType.PIPE), true);
    assert.equal(isInfrastructureLineType(BuildingType.POWER_LINE), true);
    assert.equal(isInfrastructureLineType(BuildingType.FENCE), true);
    assert.equal(isInfrastructureLineType(BuildingType.STAFF_QUARTERS), false);
    assert.equal(isInfrastructureLineType(null), false);
});

test('infrastructure line helper snaps diagonal drags to the dominant axis', () => {
    const plan = getInfrastructureLinePlan(
        5,
        5,
        9,
        7,
        BuildingType.ROAD,
        stateWithInventory({ [BuildingType.ROAD]: 20 })
    );

    assert.ok(plan);
    assert.equal(plan.finalX, 9);
    assert.equal(plan.finalZ, 5);
    assert.equal(plan.stepX, 1);
    assert.equal(plan.stepZ, 0);
    assert.equal(plan.requestedLength, 5);
    assert.equal(plan.placeCount, 5);
});

test('infrastructure line helper limits placement by inventory unless cheats are enabled', () => {
    const limitedPlan = getInfrastructureLinePlan(
        0,
        0,
        0,
        6,
        BuildingType.PIPE,
        stateWithInventory({ [BuildingType.PIPE]: 3 })
    );

    assert.ok(limitedPlan);
    assert.equal(limitedPlan.requestedLength, 7);
    assert.equal(limitedPlan.available, 3);
    assert.equal(limitedPlan.placeCount, 3);

    const cheatPlan = getInfrastructureLinePlan(
        0,
        0,
        0,
        6,
        BuildingType.PIPE,
        stateWithInventory({}, true)
    );

    assert.ok(cheatPlan);
    assert.equal(cheatPlan.available, 7);
    assert.equal(cheatPlan.placeCount, 7);
});
