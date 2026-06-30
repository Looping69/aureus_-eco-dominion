import type { GameCommand } from '../../types';
import {
    DeterministicCommandEnvelope,
    createDeterministicCommandEnvelope,
} from './DeterministicCommand';

export interface LockstepReplayFrame {
    playerId: string;
    targetTick: number;
    sequence: number;
    payloadHash: string;
    command: GameCommand;
}

export function serializeLockstepReplay(envelopes: DeterministicCommandEnvelope[]): string {
    const frames = envelopes.map((envelope): LockstepReplayFrame => ({
        playerId: envelope.playerId,
        targetTick: envelope.targetTick,
        sequence: envelope.sequence,
        payloadHash: envelope.payloadHash,
        command: envelope.command,
    }));
    return JSON.stringify({ version: 1, frames });
}

export function deserializeLockstepReplay(serialized: string): DeterministicCommandEnvelope[] {
    const parsed = JSON.parse(serialized) as { version?: number; frames?: LockstepReplayFrame[] };
    if (parsed.version !== 1 || !Array.isArray(parsed.frames)) {
        throw new Error('Unsupported lockstep replay format');
    }

    return parsed.frames.map((frame) => {
        const envelope = createDeterministicCommandEnvelope({
            playerId: frame.playerId,
            targetTick: frame.targetTick,
            sequence: frame.sequence,
            command: frame.command,
        });
        if (envelope.payloadHash !== frame.payloadHash) {
            throw new Error(`Lockstep replay payload hash mismatch for ${envelope.id}`);
        }
        return envelope;
    });
}
