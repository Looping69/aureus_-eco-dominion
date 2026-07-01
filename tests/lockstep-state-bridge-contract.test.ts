import assert from 'node:assert/strict';
import test from 'node:test';

import { LockstepCommandBuffer, flushLockstepCommandsToQueue, scheduleLockstepCommand } from '../engine/net/index.ts';
import type { GameCommand } from '../types.ts';

function command(id: string, type: GameCommand['type'], payload: GameCommand['payload']): GameCommand {
    return { id, type, payload };
}

test('lockstep bridge flushes ready envelopes into the game command queue deterministically', () => {
    const buffer = new LockstepCommandBuffer();
    const state = { commandQueue: [] as GameCommand[], tickCount: 20 };

    scheduleLockstepCommand(buffer, {
        playerId: 'player-b',
        targetTick: 20,
        sequence: 2,
        command: command('cmd-b2', 'BULLDOZE', { x: 2, z: 2 }),
    }, state.tickCount);
    scheduleLockstepCommand(buffer, {
        playerId: 'player-a',
        targetTick: 20,
        sequence: 1,
        command: command('cmd-a1', 'PLACE_BUILDING', { x: 1, z: 1, buildingType: 'ROAD' }),
    }, state.tickCount);
    scheduleLockstepCommand(buffer, {
        playerId: 'player-b',
        targetTick: 21,
        sequence: 3,
        command: command('cmd-b3', 'COMMAND_AGENT', { agentId: 'agent-1', x: 3, z: 3 }),
    }, state.tickCount);

    const flushed = flushLockstepCommandsToQueue(buffer, state);

    assert.deepEqual(flushed.map((envelope) => envelope.id), ['20:player-a:1', '20:player-b:2']);
    assert.deepEqual(state.commandQueue.map((cmd) => cmd.id), ['cmd-a1', 'cmd-b2']);
    assert.deepEqual(state.commandQueue.map((cmd) => cmd.issuedAtTick), [20, 20]);
    assert.equal(buffer.size, 1);

    state.tickCount = 21;
    flushLockstepCommandsToQueue(buffer, state);
    assert.deepEqual(state.commandQueue.map((cmd) => cmd.id), ['cmd-a1', 'cmd-b2', 'cmd-b3']);
});

test('lockstep bridge preserves explicit issuedAtTick when replaying imported commands', () => {
    const buffer = new LockstepCommandBuffer();
    const state = { commandQueue: [] as GameCommand[], tickCount: 10 };

    scheduleLockstepCommand(buffer, {
        playerId: 'player-a',
        targetTick: 10,
        sequence: 1,
        command: { ...command('cmd-a1', 'SELL_RESOURCE', { resource: 'minerals', amount: 3 }), issuedAtTick: 7 },
    }, state.tickCount);

    flushLockstepCommandsToQueue(buffer, state);
    assert.equal(state.commandQueue[0].issuedAtTick, 7);
});

test('lockstep bridge keeps stable ordering for equal target tick commands', () => {
    const buffer = new LockstepCommandBuffer();

    scheduleLockstepCommand(buffer, {
        playerId: 'player-b',
        targetTick: 8,
        sequence: 2,
        command: command('cmd-b2', 'BULLDOZE', { x: 2, z: 2 }),
    }, 8);
    scheduleLockstepCommand(buffer, {
        playerId: 'player-a',
        targetTick: 8,
        sequence: 1,
        command: command('cmd-a1', 'PLACE_BUILDING', { x: 1, z: 1, buildingType: 'ROAD' }),
    }, 8);

    assert.deepEqual(buffer.drainReady(8).map((envelope) => envelope.command.id), ['cmd-a1', 'cmd-b2']);
});
