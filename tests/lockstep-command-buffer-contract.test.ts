import assert from 'node:assert/strict';
import test from 'node:test';

import { LockstepCommandBuffer, createDeterministicCommandEnvelope, hashCommandPayload } from '../engine/net/index.ts';
import type { GameCommand } from '../types.ts';

function command(id: string, type: GameCommand['type'], payload: GameCommand['payload']): GameCommand {
    return { id, type, payload };
}

test('lockstep command buffer drains identically regardless of arrival order', () => {
    const a = new LockstepCommandBuffer();
    const b = new LockstepCommandBuffer();
    const inputs = [
        { playerId: 'player-b', targetTick: 12, sequence: 2, command: command('cmd-b2', 'BULLDOZE', { z: 2, x: 1 }) },
        { playerId: 'player-a', targetTick: 12, sequence: 1, command: command('cmd-a1', 'PLACE_BUILDING', { buildingType: 'ROAD', x: 1, z: 2 }) },
        { playerId: 'player-b', targetTick: 12, sequence: 1, command: command('cmd-b1', 'COMMAND_AGENT', { agentId: 'agent-1', x: 4, z: 4 }) },
        { playerId: 'player-a', targetTick: 13, sequence: 2, command: command('cmd-a2', 'SELL_RESOURCE', { resource: 'minerals', amount: 5 }) },
    ];

    for (const input of inputs) assert.equal(a.accept(input).ok, true);
    for (const input of [...inputs].reverse()) assert.equal(b.accept(input).ok, true);

    assert.deepEqual(
        a.drainReady(12).map((envelope) => envelope.command.id),
        ['cmd-a1', 'cmd-b1', 'cmd-b2'],
    );
    assert.deepEqual(
        b.drainReady(12).map((envelope) => envelope.command.id),
        ['cmd-a1', 'cmd-b1', 'cmd-b2'],
    );
    assert.deepEqual(a.drainReadyCommands(13).map((cmd) => cmd.id), ['cmd-a2']);
    assert.deepEqual(b.drainReadyCommands(13).map((cmd) => cmd.id), ['cmd-a2']);
});

test('lockstep command buffer does not drain future commands early', () => {
    const buffer = new LockstepCommandBuffer();
    buffer.accept({
        playerId: 'player-a',
        targetTick: 8,
        sequence: 1,
        command: command('cmd-a1', 'PLACE_BUILDING', { x: 0, z: 0, buildingType: 'ROAD' }),
    });

    assert.deepEqual(buffer.peekReady(7), []);
    assert.deepEqual(buffer.drainReadyCommands(7), []);
    assert.equal(buffer.size, 1);
    assert.deepEqual(buffer.drainReadyCommands(8).map((cmd) => cmd.id), ['cmd-a1']);
    assert.equal(buffer.size, 0);
});

test('lockstep command buffer rejects stale ticks and duplicate player sequences', () => {
    const buffer = new LockstepCommandBuffer();
    const first = buffer.accept({
        playerId: 'player-a',
        targetTick: 5,
        sequence: 1,
        command: command('cmd-a1', 'PLACE_BUILDING', { x: 0, z: 0, buildingType: 'ROAD' }),
    }, 5);
    const duplicate = buffer.accept({
        playerId: 'player-a',
        targetTick: 6,
        sequence: 1,
        command: command('cmd-a1-duplicate', 'BULLDOZE', { x: 0, z: 0 }),
    }, 5);
    const stale = buffer.accept({
        playerId: 'player-b',
        targetTick: 4,
        sequence: 1,
        command: command('cmd-b1', 'BULLDOZE', { x: 1, z: 1 }),
    }, 5);

    assert.equal(first.ok, true);
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.ok ? '' : duplicate.reason, 'DUPLICATE_SEQUENCE');
    assert.equal(stale.ok, false);
    assert.equal(stale.ok ? '' : stale.reason, 'PAST_TICK');
});

test('command payload hashes are stable for equivalent object key order', () => {
    const left = command('cmd-left', 'PLACE_BUILDING', { x: 1, z: 2, buildingType: 'ROAD' });
    const right = command('cmd-right', 'PLACE_BUILDING', { buildingType: 'ROAD', z: 2, x: 1 });

    assert.equal(hashCommandPayload(left), hashCommandPayload(right));
    assert.equal(
        createDeterministicCommandEnvelope({ playerId: 'player-a', targetTick: 1, sequence: 1, command: left }).payloadHash,
        createDeterministicCommandEnvelope({ playerId: 'player-a', targetTick: 1, sequence: 1, command: right }).payloadHash,
    );
});
