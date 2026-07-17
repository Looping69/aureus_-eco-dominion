import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

function assertContains(text: string, snippet: string): void {
    assert.equal(text.includes(snippet), true, `Expected source to include: ${snippet}`);
}

test('game-definition action payload schemas are part of the generic engine contract', () => {
    const types = source('engine/game-definition/types.ts');
    const index = source('engine/game-definition/index.ts');

    for (const snippet of [
        "export type GameActionPayloadFieldType = 'string' | 'number' | 'boolean' | 'string[]' | 'number[]' | 'object' | 'any';",
        'export interface GameActionPayloadFieldDefinition',
        'type: GameActionPayloadFieldType;',
        'required?: boolean;',
        'allowPrimitive?: boolean;',
        'export type GameActionPayloadSchema = Record<string, GameActionPayloadFieldDefinition>;',
        'payloadSchema?: GameActionPayloadSchema;',
    ]) {
        assertContains(types, snippet);
    }

    for (const snippet of [
        'GameActionPayloadFieldDefinition,',
        'GameActionPayloadFieldType,',
        'GameActionPayloadSchema,',
    ]) {
        assertContains(index, snippet);
    }
});

test('contract commands declare payload schemas in the Aureus game pack', () => {
    const aureus = source('game-definitions/aureus.ts');

    for (const snippet of [
        'const contractIdPayloadSchema: GameActionDefinition',
        "type: 'string',",
        'allowPrimitive: true,',
        "commandType: 'ACCEPT_CONTRACT'",
        "commandType: 'DELIVER_CONTRACT'",
        "commandType: 'ABANDON_CONTRACT'",
        'payloadSchema: contractIdPayloadSchema',
    ]) {
        assertContains(aureus, snippet);
    }
});

test('screen and dialogue commands declare payload schemas in the Aureus game pack', () => {
    const aureus = source('game-definitions/aureus.ts');

    for (const snippet of [
        'function singleStringPayloadSchema(field: string, description: string)',
        'const optionIndexPayloadSchema: GameActionDefinition',
        'const popupIdPayloadSchema = singleStringPayloadSchema',
        'const permitIdPayloadSchema = singleStringPayloadSchema',
        'const npcIdPayloadSchema = singleStringPayloadSchema',
        "commandType: 'DISMISS_POPUP'",
        'payloadSchema: popupIdPayloadSchema',
        "commandType: 'SUBMIT_PERMIT'",
        'payloadSchema: permitIdPayloadSchema',
        "commandType: 'TALK_TO_NPC'",
        'payloadSchema: npcIdPayloadSchema',
        "commandType: 'CHOOSE_DIALOGUE'",
        'payloadSchema: optionIndexPayloadSchema',
    ]) {
        assertContains(aureus, snippet);
    }
});

test('payload schema validation is opt-in and keeps the legacy path for undeclared actions', () => {
    const validator = source('engine/game-definition/GameCommandValidator.ts');
    const runner = source('scripts/run-contract-tests.js');

    for (const snippet of [
        'function actionHasPayloadSchema(action: GameActionDefinition): boolean',
        'function hasLegacyRequiredPayloadField(payload: unknown, field: string, fields: string[]): boolean',
        'function hasSchemaRequiredPayloadField(action: GameActionDefinition, payload: unknown, field: string): boolean',
        'function matchesPayloadFieldSchema(schema: GameActionPayloadFieldDefinition, value: unknown): boolean',
        'if (actionHasPayloadSchema(action))',
        "['x', 'y', 'z', 'dx', 'dz', 'amount', 'cost', 'optionIndex', 'threshold', 'radius', 'damage']",
        'Command type ${commandType} has invalid payload field(s): ${invalidFields.join(\', \')}.',
    ]) {
        assertContains(validator, snippet);
    }

    assertContains(runner, 'tests/game-definition-payload-schema-source-contract.test.ts');
});