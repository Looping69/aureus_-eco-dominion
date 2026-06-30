import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function source(relativePath: string): string {
    const filePath = path.join(root, relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} is missing`);
    return readFileSync(filePath, 'utf8');
}

test('engine exposes deterministic network primitives without socket coupling', () => {
    const envelope = source('engine/net/DeterministicCommand.ts');
    const buffer = source('engine/net/LockstepCommandBuffer.ts');
    const exports = source('engine/net/index.ts');

    assert.match(envelope, /DeterministicCommandEnvelope/);
    assert.match(envelope, /targetTick/);
    assert.match(envelope, /payloadHash/);
    assert.match(envelope, /stableStringify/);
    assert.match(buffer, /LockstepCommandBuffer/);
    assert.match(buffer, /drainReadyCommands/);
    assert.match(buffer, /DUPLICATE_SEQUENCE/);
    assert.match(exports, /DeterministicCommand/);
    assert.match(exports, /LockstepCommandBuffer/);

    for (const text of [envelope, buffer]) {
        assert.equal(/WebSocket|BroadcastChannel|fetch\(/.test(text), false);
    }
});

test('command pipeline documentation names lockstep as the deterministic multiplayer path', () => {
    const commandDoc = source('COMMAND_PIPELINE.md');
    assert.match(commandDoc, /Multiplayer/);
    assert.match(commandDoc, /command stream/);
});
