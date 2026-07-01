import type { GameCommand } from '../../types';
import {
    DeterministicCommandEnvelope,
    DeterministicCommandInput,
    compareDeterministicCommands,
    createDeterministicCommandEnvelope,
    getDeterministicCommandKey,
} from './DeterministicCommand';

export type LockstepCommandAcceptResult =
    | { ok: true; envelope: DeterministicCommandEnvelope }
    | { ok: false; reason: 'DUPLICATE_SEQUENCE' | 'PAST_TICK'; envelope: DeterministicCommandEnvelope };

export class LockstepCommandBuffer {
    private readonly queued = new Map<string, DeterministicCommandEnvelope>();
    private readonly acceptedSequences = new Map<string, string>();

    accept(input: DeterministicCommandInput, currentTick = 0): LockstepCommandAcceptResult {
        const envelope = createDeterministicCommandEnvelope(input);
        if (envelope.targetTick < currentTick) {
            return { ok: false, reason: 'PAST_TICK', envelope };
        }

        const sequenceKey = getDeterministicCommandKey(envelope);
        const existingEnvelopeId = this.acceptedSequences.get(sequenceKey);
        if (existingEnvelopeId && existingEnvelopeId !== envelope.id) {
            return { ok: false, reason: 'DUPLICATE_SEQUENCE', envelope };
        }

        this.acceptedSequences.set(sequenceKey, envelope.id);
        this.queued.set(envelope.id, envelope);
        return { ok: true, envelope };
    }

    drainReady(currentTick: number): DeterministicCommandEnvelope[] {
        const ready = Array.from(this.queued.values())
            .filter((envelope) => envelope.targetTick <= currentTick)
            .sort(compareDeterministicCommands);

        for (const envelope of ready) {
            this.queued.delete(envelope.id);
        }

        return ready;
    }

    drainReadyCommands(currentTick: number): GameCommand[] {
        return this.drainReady(currentTick).map((envelope) => envelope.command);
    }

    peekReady(currentTick: number): DeterministicCommandEnvelope[] {
        return Array.from(this.queued.values())
            .filter((envelope) => envelope.targetTick <= currentTick)
            .sort(compareDeterministicCommands);
    }

    get size(): number {
        return this.queued.size;
    }
}
