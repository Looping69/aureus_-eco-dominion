import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getInfrastructureLinePlan, isInfrastructureLineType } from '../game/world/infrastructureLine.ts';
import { BuildingType } from '../types.ts';
import type { GameState } from '../types.ts';

function stateWithInventory(inventory: Partial<Record<BuildingType, number>>, cheatsEnabled = false): GameState {
    return {
        cheatsEnabled,
        inventory,
    } as GameState;
}

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
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

test('pipe line preview shows the underground layer and three tile supplied area', () => {
    const preview = source('game/render/LinePlacementPreview.ts');

    assert.match(preview, /const PIPE_SUPPLY_RADIUS = 3;/);
    assert.match(preview, /const PIPE_UNDERGROUND_PREVIEW_OFFSET = -0\.35;/);
    assert.match(preview, /pipeCoverageMaterial/);
    assert.match(preview, /collectPipeCoverage/);
    assert.match(preview, /addPipeCoverageTiles/);
    assert.match(preview, /type === BuildingType\.PIPE/);
});

test('AureusWorld delegates infrastructure line math to the shared helper', () => {
    const aureusWorld = source('game/AureusWorld.ts');

    assert.match(aureusWorld, /getInfrastructureLinePlan/);
    assert.match(aureusWorld, /isInfrastructureLineType/);
    assert.equal(aureusWorld.includes('const deltaX = endX - startX'), false);
    assert.equal(aureusWorld.includes('const deltaZ = endZ - startZ'), false);
    assert.equal(aureusWorld.includes('Math.abs(deltaX) >= Math.abs(deltaZ)'), false);
    assert.equal(
        aureusWorld.includes('Math.max(Math.abs(finalX - startX), Math.abs(finalZ - startZ)) + 1'),
        false
    );
});
