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

test('build commands declare payload schemas in the Aureus game pack', () => {
    const aureus = source('game-definitions/aureus.ts');

    for (const snippet of [
        'const tilePayloadSchema: NonNullable<GameActionDefinition',
        'const placeBuildingPayloadSchema: GameActionDefinition',
        "buildingType: {",
        "commandType: 'PLACE_BUILDING'",
        'payloadSchema: placeBuildingPayloadSchema',
        "commandType: 'BULLDOZE'",
        "commandType: 'SPEED_UP'",
        "commandType: 'REHABILITATE'",
        "commandType: 'UPGRADE_BUILDING'",
        'payloadSchema: tilePayloadSchema',
    ]) {
        assertContains(aureus, snippet);
    }
});

test('world and progression commands declare payload schemas in the Aureus game pack', () => {
    const aureus = source('game-definitions/aureus.ts');

    for (const snippet of [
        'const voxelPayloadSchema: NonNullable<GameActionDefinition',
        'const buyBuildingPayloadSchema: GameActionDefinition',
        'const explodeTilePayloadSchema: GameActionDefinition',
        'const techIdPayloadSchema = singleStringPayloadSchema',
        "commandType: 'BUY_BUILDING'",
        'payloadSchema: buyBuildingPayloadSchema',
        "commandType: 'EXPLODE_TILE'",
        'payloadSchema: explodeTilePayloadSchema',
        "commandType: 'DIG_VOXEL'",
        "commandType: 'CLEAR_RUBBLE'",
        "commandType: 'DESIGNATE_RUBBLE_DUMP'",
        "commandType: 'FILL_VOXEL'",
        'payloadSchema: voxelPayloadSchema',
        "commandType: 'MARK_HARVEST'",
        "commandType: 'RESEARCH_TECH'",
        'payloadSchema: techIdPayloadSchema',
    ]) {
        assertContains(aureus, snippet);
    }
});

test('agent movement and combat commands declare payload schemas in the Aureus game pack', () => {
    const aureus = source('game-definitions/aureus.ts');

    for (const snippet of [
        'const agentMovePayloadSchema: GameActionDefinition',
        'const agentGroupMovePayloadSchema: GameActionDefinition',
        "type: 'string[]',",
        'const manualMovePayloadSchema: GameActionDefinition',
        'const agentIdsPayloadSchema: GameActionDefinition',
        "commandType: 'COMMAND_AGENT'",
        'payloadSchema: agentMovePayloadSchema',
        "commandType: 'COMMAND_AGENTS'",
        'payloadSchema: agentGroupMovePayloadSchema',
        "commandType: 'MANUAL_MOVE_AGENT'",
        'payloadSchema: manualMovePayloadSchema',
        "commandType: 'COMBAT_ATTACK_TARGET'",
        "commandType: 'COMBAT_HOLD_POSITION'",
        "commandType: 'COMBAT_CLEAR_ORDERS'",
        'payloadSchema: agentIdsPayloadSchema',
    ]) {
        assertContains(aureus, snippet);
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

test('market commands declare payload schemas in the Aureus game pack', () => {
    const aureus = source('game-definitions/aureus.ts');

    for (const snippet of [
        'const buyResourcePayloadSchema: GameActionDefinition',
        'const autoSellPayloadSchema: GameActionDefinition',
        'const resourcePayloadSchema = singleStringPayloadSchema',
        "commandType: 'SELL_RESOURCE'",
        'payloadSchema: resourcePayloadSchema',
        "commandType: 'BUY_RESOURCE'",
        'payloadSchema: buyResourcePayloadSchema',
        "commandType: 'SET_AUTO_SELL'",
        'payloadSchema: autoSellPayloadSchema',
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

test('schema-backed command diagnostics describe expected payload field types', () => {
    const validator = source('engine/game-definition/GameCommandValidator.ts');

    for (const snippet of [
        'function describePayloadFieldExpectation(schema: GameActionPayloadFieldDefinition | null): string',
        "if (!schema) return 'declared payload field';",
        'if (schema.allowPrimitive) return `${schema.type} or primitive ${schema.type}`;',
        'function formatPayloadFieldDiagnostic(action: GameActionDefinition, field: string): string',
        'return `${field} expected ${describePayloadFieldExpectation(getPayloadFieldSchema(action, field))}`;',
        'function findMissingPayloadFieldDiagnostics(action: GameActionDefinition, payload: unknown): string[]',
        'function findInvalidPayloadFieldDiagnostics(action: GameActionDefinition, payload: unknown): string[]',
        'const missingFields = findMissingPayloadFieldDiagnostics(action, payload);',
        'const invalidFields = findInvalidPayloadFieldDiagnostics(action, payload);',
    ]) {
        assertContains(validator, snippet);
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