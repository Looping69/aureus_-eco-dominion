import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { BuildingType } from '../types.ts';
import { COMBAT_PERIMETER_DEFS, RAW_COMBAT_PERIMETER_SCHEMA, getCombatPerimeterDef } from '../engine/data/combatPerimeters.ts';

const root = process.cwd();

function source(relativePath: string): string {
    const filePath = path.join(root, relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} is missing`);
    return readFileSync(filePath, 'utf8');
}

test('combat perimeter schema defines defensive infrastructure data', () => {
    assert.equal(RAW_COMBAT_PERIMETER_SCHEMA.some(def => def.buildingType === 'FENCE'), true);
    assert.equal(RAW_COMBAT_PERIMETER_SCHEMA.some(def => def.buildingType === 'SECURITY_POST'), true);

    const fence = getCombatPerimeterDef(BuildingType.FENCE);
    const securityPost = getCombatPerimeterDef(BuildingType.SECURITY_POST);
    assert.ok(fence);
    assert.ok(securityPost);
    assert.equal(fence.hostileAttackPenalty > 0, true);
    assert.equal(securityPost.controlRadius > fence.controlRadius, true);
    assert.equal(securityPost.colonyScanRangeBonus > 0, true);
    assert.equal(COMBAT_PERIMETER_DEFS.every(def => typeof def.controlRadius === 'number'), true);
});

test('combat system delegates defensive perimeter math to perimeter schema', () => {
    const combat = source('engine/sim/systems/CombatSystem.ts');

    assert.match(combat, /getPerimeterCombatModifier/);
    assert.equal(combat.includes('BuildingType.FENCE'), false);
    assert.equal(combat.includes('BuildingType.SECURITY_POST'), false);
    assert.equal(combat.includes('hostileAttackPenalty: 2'), false);
});
