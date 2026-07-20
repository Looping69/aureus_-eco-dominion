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

test('game command candidates are generic validation inputs', () => {
    const candidate = source('engine/game-definition/GameCommandCandidate.ts');
    const index = source('engine/game-definition/index.ts');

    for (const snippet of [
        'export interface GameCommandCandidate',
        'commandType: string;',
        'payload?: unknown;',
        'source?: string;',
        'reason?: string;',
        'export interface GameCommandCandidateValidationResult extends GameCommandValidationResult',
        'candidate: GameCommandCandidate;',
        'export function createGameCommandCandidate(',
        'export function validateGameCommandCandidate(',
        'validateGameCommandType(definition, candidate.commandType, candidate.payload, context)',
        'export function isValidGameCommandCandidate(',
        'return validateGameCommandCandidate(definition, candidate, context).ok;',
    ]) {
        assertContains(candidate, snippet);
    }

    for (const snippet of [
        'createGameCommandCandidate,',
        'isValidGameCommandCandidate,',
        'validateGameCommandCandidate,',
        'GameCommandCandidate,',
        'GameCommandCandidateValidationResult,',
    ]) {
        assertContains(index, snippet);
    }
});
