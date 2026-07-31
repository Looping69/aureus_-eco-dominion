import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const panelPath = path.join(root, 'components', 'AIOverseerPanel.tsx');
const systemPath = path.join(root, 'engine', 'sim', 'systems', 'AIOverseerPlaySystem.ts');

function source(filePath: string): string {
    assert.equal(existsSync(filePath), true, `${filePath} is missing`);
    return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string): void {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('AI Overseer UI settings are queued through the shared command-candidate envelope', () => {
    const text = source(panelPath);

    for (const snippet of [
        'createGameCommandCandidate,',
        'createGameCommandCandidateEnvelope,',
        'createGameCommandCandidateId,',
        'GAME_COMMAND_CANDIDATE_SOURCES,',
        "const candidate = createGameCommandCandidate(",
        "'SET_AI_OVERSEER'",
        'GAME_COMMAND_CANDIDATE_SOURCES.UI',
        "'AI Overseer panel settings'",
        'const command = createGameCommandCandidateEnvelope(',
        "createGameCommandCandidateId(GAME_COMMAND_CANDIDATE_SOURCES.UI, 'SET_AI_OVERSEER', issuedAtTick, gameState.commandQueue.length)",
        'gameState.commandQueue.push(command as GameCommand);',
    ]) {
        assertSnippet(text, snippet);
    }

    assert.doesNotMatch(text, /id:\s*`ui_ai_overseer_\$\{Date\.now\(\)\}`/);
});

test('heuristic AI Overseer auto-act commands are queued through shared envelopes', () => {
    const text = source(systemPath);

    for (const snippet of [
        'createGameCommandCandidate,',
        'createGameCommandCandidateEnvelope,',
        'createGameCommandCandidateId,',
        'GAME_COMMAND_CANDIDATE_SOURCES,',
        "const HEURISTIC_OVERSEER_COMMAND_REASON = 'AI Overseer heuristic autopilot';",
        'this.isQueuedHeuristicCommand(command)',
        'GAME_COMMAND_CANDIDATE_SOURCES.HEURISTIC_OVERSEER',
        "String(command.id).startsWith('ai_cmd_')",
        'const candidate = createGameCommandCandidate(type, payload, GAME_COMMAND_CANDIDATE_SOURCES.HEURISTIC_OVERSEER, HEURISTIC_OVERSEER_COMMAND_REASON);',
        "const commandId = ctx.getNextId?.('ai_cmd') || createGameCommandCandidateId(",
        'const command = createGameCommandCandidateEnvelope(candidate, commandId, issuedAtTick);',
        'state.commandQueue.push(command as GameCommand);',
    ]) {
        assertSnippet(text, snippet);
    }
});
