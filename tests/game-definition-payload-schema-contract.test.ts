import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { BuildingType } from '../types.ts';
import { AUREUS_GAME_DEFINITION } from '../game-definitions/aureus.ts';
import {
    collectGameDefinitionIssues,
    findActionForCommandType,
    findInvalidPayloadFields,
    validateGameCommandType,
    type GameDefinition,
} from '../engine/game-definition/index.ts';

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

test('command payload validation is driven by game action schemas instead of Aureus field names', () => {
    const validator = source('engine/game-definition/GameCommandValidator.ts');
    const types = source('engine/game-definition/types.ts');
    const aureus = source('game-definitions/aureus.ts');

    assert.match(types, /export interface GameActionPayloadFieldDefinition/);
    assert.match(types, /payloadSchema\?: GameActionPayloadSchema/);
    assert.match(validator, /getPayloadFieldSchema/);
    assert.match(validator, /matchesPayloadFieldSchema/);
    assert.equal(validator.includes("['x', 'y', 'z'"), false);
    assert.equal(validator.includes("['enabled']"), false);
    assert.match(aureus, /withAureusPayloadSchema/);
    assert.match(aureus, /AUREUS_PAYLOAD_FIELD_TYPES/);
});

test('Aureus declares payload schemas for every command payload field', () => {
    for (const action of AUREUS_GAME_DEFINITION.actions) {
        assert.ok(action.payloadSchema, `${action.id} should declare a payload schema`);
        for (const field of action.payloadFields) {
            assert.ok(action.payloadSchema?.[field], `${action.id} should declare schema for ${field}`);
        }
    }

    const placeBuilding = findActionForCommandType(AUREUS_GAME_DEFINITION, 'PLACE_BUILDING');
    assert.equal(placeBuilding?.payloadSchema?.x.type, 'number');
    assert.equal(placeBuilding?.payloadSchema?.z.type, 'number');
    assert.equal(placeBuilding?.payloadSchema?.buildingType.type, 'string');
    assert.equal(placeBuilding?.payloadSchema?.buildingType.values?.includes(BuildingType.STAFF_QUARTERS), true);

    const attack = findActionForCommandType(AUREUS_GAME_DEFINITION, 'COMBAT_ATTACK_TARGET');
    assert.equal(attack?.payloadSchema?.agentIds.type, 'string[]');

    const autoSell = findActionForCommandType(AUREUS_GAME_DEFINITION, 'SET_AUTO_SELL');
    assert.equal(autoSell?.payloadSchema?.enabled.type, 'boolean');
    assert.equal(autoSell?.payloadSchema?.threshold.type, 'number');
});

test('schema-driven command validation rejects invalid values without engine-specific field rules', () => {
    const placeBuilding = findActionForCommandType(AUREUS_GAME_DEFINITION, 'PLACE_BUILDING');
    assert.ok(placeBuilding);

    assert.deepEqual(findInvalidPayloadFields(placeBuilding, { x: 1, z: Number.NaN, buildingType: BuildingType.ROAD }), ['z']);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'PLACE_BUILDING', { x: 1, z: 2, buildingType: 'NOT_A_BUILDING' }).ok, false);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'PLACE_BUILDING', { x: 1, z: 2, buildingType: BuildingType.ROAD }).ok, true);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'SET_AUTO_SELL', { enabled: 'yes', threshold: 100 }).ok, false);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'COMBAT_ATTACK_TARGET', { agentIds: [] }).ok, false);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'SELL_RESOURCE', { resource: 'not-real' }).ok, false);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'ACCEPT_CONTRACT', 'contract-1').ok, true);
});

test('game definition validation catches malformed payload schemas before registration', () => {
    const malformed = {
        ...AUREUS_GAME_DEFINITION,
        actions: [
            {
                ...AUREUS_GAME_DEFINITION.actions[0],
                payloadSchema: {
                    x: { type: 'number' },
                    z: { type: 'wat' },
                },
            },
            ...AUREUS_GAME_DEFINITION.actions.slice(1),
        ],
    } as GameDefinition;

    const issues = collectGameDefinitionIssues(malformed);
    assert.equal(issues.some((issue) => issue.path.includes('payloadSchema.buildingType')), true);
    assert.equal(issues.some((issue) => issue.path.includes('payloadSchema.z.type')), true);
});