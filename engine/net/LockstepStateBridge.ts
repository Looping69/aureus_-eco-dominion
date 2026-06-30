import type { GameCommand, GameState } from '../../types';
import type { DeterministicCommandEnvelope, DeterministicCommandInput } from './DeterministicCommand';
import type { LockstepCommandAcceptResult } from './LockstepCommandBuffer';
import { LockstepCommandBuffer } from './LockstepCommandBuffer';

export interface LockstepQueueTarget {
    commandQueue: GameCommand[];
    tickCount: number;
}

export function scheduleLockstepCommand(
    buffer: LockstepCommandBuffer,
    input: DeterministicCommandInput,
    currentTick: number,
): LockstepCommandAcceptResult {
    return buffer.accept(input, currentTick);
}

export function flushLockstepCommandsToQueue(
    buffer: LockstepCommandBuffer,
    state: LockstepQueueTarget | GameState,
    currentTick: number = state.tickCount,
): DeterministicCommandEnvelope[] {
    const ready = buffer.drainReady(currentTick);
    for (const envelope of ready) {
        state.commandQueue.push({
            ...envelope.command,
            issuedAtTick: envelope.command.issuedAtTick ?? envelope.targetTick,
        });
    }
    return ready;
}
