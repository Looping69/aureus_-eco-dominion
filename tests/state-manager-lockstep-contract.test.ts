import assert from 'node:assert/strict';
import test from 'node:test';

import { StateManager } from '../engine/state/StateManager.ts';
import { LockstepCommandBuffer } from '../engine/net/index.ts';
import { GAME_DEFINITION_REGISTRY } from '../game-definitions/activeGameDefinition.ts';
import type { GameCommand } from '../types.ts';

function command(id: string, type: GameCommand['type'], payload: GameCommand['payload'], meta: Partial<GameCommand> = {}): GameCommand {
    return { id, type, payload, ...meta };
}

test('state manager pushCommand still queues immediately by default', () => {
    const stateManager = new StateManager();

    stateManager.pushCommand('PLACE_BUILDING', { x: 1, z: 1, buildingType: 'ROAD' });

    const [queued] = stateManager.getMutableState().commandQueue;
    assert.equal(stateManager.getMutableState().commandQueue.length, 1);
    assert.equal(queued.id.startsWith('cmd_'), true);
    assert.equal(queued.issuedAtTick, 0);
    assert.equal(queued.source, 'ui');
    assert.equal(queued.reason, 'StateManager pushCommand');
});

test('state manager can validate queued commands against the active game definition', () => {
    const stateManager = new StateManager(undefined, { activeGameDefinitionProvider: GAME_DEFINITION_REGISTRY });

    stateManager.pushCommand('PLACE_BUILDING', { x: 1, z: 1, buildingType: 'ROAD' });
    stateManager.pushCommand('NOT_A_PACK_ACTION', { debug: true });

    assert.equal(stateManager.getMutableState().commandQueue.length, 1);
    assert.equal(stateManager.getMutableState().commandQueue[0].type, 'PLACE_BUILDING');
    assert.equal(stateManager.getMutableState().commandQueue[0].source, 'ui');
    assert.equal(stateManager.getMutableState().ui.lastCommandResult?.ok, false);
    assert.equal(stateManager.getMutableState().ui.lastCommandResult?.code, 'COMMAND_NOT_DECLARED');
    assert.match(stateManager.getMutableState().ui.lastCommandResult?.reason ?? '', /not declared by active game definition/);
});

test('state manager rejects active game definition commands with missing payload fields', () => {
    const stateManager = new StateManager(undefined, { activeGameDefinitionProvider: GAME_DEFINITION_REGISTRY });

    stateManager.pushCommand('PLACE_BUILDING', { x: 1, buildingType: 'ROAD' });

    assert.equal(stateManager.getMutableState().commandQueue.length, 0);
    assert.equal(stateManager.getMutableState().ui.lastCommandResult?.ok, false);
    assert.equal(stateManager.getMutableState().ui.lastCommandResult?.code, 'COMMAND_PAYLOAD_INVALID');
    assert.match(stateManager.getMutableState().ui.lastCommandResult?.reason ?? '', /missing required payload field\(s\): z/);
});

test('state manager lockstep commands stay out of the queue until targetTick', () => {
    const stateManager = new StateManager();
    const buffer = new LockstepCommandBuffer();

    stateManager.setLockstepCommandBuffer(buffer);
    stateManager.scheduleDeterministicCommand({
        playerId: 'player-a',
        targetTick: 3,
        sequence: 1,
        command: command('cmd-a1', 'PLACE_BUILDING', { x: 1, z: 1, buildingType: 'ROAD' }),
    });

    stateManager.getMutableState().tickCount = 2;
    stateManager.flushReadyLockstepCommands();

    assert.deepEqual(stateManager.getMutableState().commandQueue, []);
});

test('state manager flushes ready lockstep commands in deterministic order', () => {
    const stateManager = new StateManager();
    const buffer = new LockstepCommandBuffer();

    stateManager.setLockstepCommandBuffer(buffer);
    stateManager.scheduleDeterministicCommand({
        playerId: 'player-b',
        targetTick: 4,
        sequence: 2,
        command: command('cmd-b2', 'BULLDOZE', { x: 2, z: 2 }, { source: 'network', reason: 'remote player' }),
    });
    stateManager.scheduleDeterministicCommand({
        playerId: 'player-a',
        targetTick: 4,
        sequence: 1,
        command: command('cmd-a1', 'PLACE_BUILDING', { x: 1, z: 1, buildingType: 'ROAD' }, { source: 'replay', reason: 'recorded command' }),
    });

    stateManager.getMutableState().tickCount = 4;
    stateManager.flushReadyLockstepCommands();

    assert.deepEqual(stateManager.getMutableState().commandQueue.map((cmd) => cmd.id), ['cmd-a1', 'cmd-b2']);
    assert.deepEqual(stateManager.getMutableState().commandQueue.map((cmd) => cmd.issuedAtTick), [4, 4]);
    assert.deepEqual(stateManager.getMutableState().commandQueue.map((cmd) => cmd.source), ['replay', 'network']);
    assert.deepEqual(stateManager.getMutableState().commandQueue.map((cmd) => cmd.reason), ['recorded command', 'remote player']);
});

test('state manager rejects duplicate lockstep player sequences', () => {
    const stateManager = new StateManager();
    const buffer = new LockstepCommandBuffer();

    stateManager.setLockstepCommandBuffer(buffer);

    const first = stateManager.scheduleDeterministicCommand({
        playerId: 'player-a',
        targetTick: 5,
        sequence: 1,
        command: command('cmd-a1', 'PLACE_BUILDING', { x: 1, z: 1, buildingType: 'ROAD' }),
    });
    const duplicate = stateManager.scheduleDeterministicCommand({
        playerId: 'player-a',
        targetTick: 6,
        sequence: 1,
        command: command('cmd-a1-dup', 'BULLDOZE', { x: 2, z: 2 }),
    });

    assert.equal(first.ok, true);
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.ok ? '' : duplicate.reason, 'DUPLICATE_SEQUENCE');
});
