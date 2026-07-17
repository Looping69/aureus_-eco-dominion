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

test('payload schema groundwork does not change runtime command validation yet', () => {
    const validator = source('engine/game-definition/GameCommandValidator.ts');
    const runner = source('scripts/run-contract-tests.js');

    assertContains(validator, 'function hasRequiredPayloadField(payload: unknown, field: string, fields: string[]): boolean');
    assertContains(validator, "['x', 'y', 'z', 'dx', 'dz', 'amount', 'cost', 'optionIndex', 'threshold', 'radius', 'damage']");
    assertContains(runner, 'tests/game-definition-payload-schema-source-contract.test.ts');
});