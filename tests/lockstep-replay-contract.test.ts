import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createDeterministicCommandEnvelope,
    deserializeLockstepReplay,
    serializeLockstepReplay,
} from '../engine/net/index.ts';
import type { GameCommand } from '../types.ts';

function command(id: string, type: GameCommand['type'], payload: GameCommand['payload']): GameCommand {
    return { id, type, payload };
}

test('lockstep replay serialization round-trips deterministic command envelopes', () => {
    const envelopes = [
        createDeterministicCommandEnvelope({
            playerId: 'player-a',
            targetTick: 30,
            sequence: 1,
            command: command('cmd-a1', 'PLACE_BUILDING', { buildingType: 'ROAD', x: 1, z: 2 }),
        }),
        createDeterministicCommandEnvelope({
            playerId: 'player-b',
            targetTick: 31,
            sequence: 4,
            command: command('cmd-b4', 'COMMAND_AGENT', { agentId: 'agent-1', x: 4, z: 5 }),
        }),
    ];

    const restored = deserializeLockstepReplay(serializeLockstepReplay(envelopes));

    assert.deepEqual(restored.map((envelope) => envelope.id), envelopes.map((envelope) => envelope.id));
    assert.deepEqual(restored.map((envelope) => envelope.payloadHash), envelopes.map((envelope) => envelope.payloadHash));
    assert.deepEqual(restored.map((envelope) => envelope.command), envelopes.map((envelope) => envelope.command));
});

test('lockstep replay rejects payload hash mismatches', () => {
    const envelope = createDeterministicCommandEnvelope({
        playerId: 'player-a',
        targetTick: 30,
        sequence: 1,
        command: command('cmd-a1', 'PLACE_BUILDING', { buildingType: 'ROAD', x: 1, z: 2 }),
    });
    const replay = JSON.parse(serializeLockstepReplay([envelope]));
    replay.frames[0].command.payload.x = 9;

    assert.throws(
        () => deserializeLockstepReplay(JSON.stringify(replay)),
        /payload hash mismatch/,
    );
});
