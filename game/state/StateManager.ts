import type { GameState } from '../../types';
import type { ActiveGameDefinitionProvider } from '../../engine/game-definition';
import {
    createQueuedGameCommandCandidateEnvelope,
    GAME_COMMAND_CANDIDATE_SOURCES,
    validateGameCommandForActiveDefinition,
} from '../../engine/game-definition';
import type { DeterministicCommandInput } from '../../engine/net/DeterministicCommand';
import { LockstepCommandBuffer } from '../../engine/net/LockstepCommandBuffer';
import { flushLockstepCommandsToQueue } from '../../engine/net/LockstepStateBridge';
import { createSeededRandom, type SeededRandom } from '../../engine/kernel/SeededRandom';
import { StateStore, type StateListener as GenericStateListener } from '../../engine/state/StateStore';
import { createAureusInitialState } from './createAureusInitialState';

export type StateListener = GenericStateListener<GameState>;

export interface StateManagerOptions {
    lockstepCommandBuffer?: LockstepCommandBuffer | null;
    activeGameDefinitionProvider?: ActiveGameDefinitionProvider | null;
}

type LegacyCommandResultStatus = string | boolean;

export class StateManager extends StateStore<GameState> {
    private rng: SeededRandom;
    private lockstepCommandBuffer: LockstepCommandBuffer | null = null;
    private activeGameDefinitionProvider: ActiveGameDefinitionProvider | null = null;

    constructor(overrides?: Partial<GameState>, options?: StateManagerOptions) {
        super(createAureusInitialState, overrides);
        this.rng = createSeededRandom(this.state.seed);
        this.lockstepCommandBuffer = options?.lockstepCommandBuffer ?? null;
        this.activeGameDefinitionProvider = options?.activeGameDefinitionProvider ?? null;
    }

    getRandom(): SeededRandom {
        return this.rng;
    }

    getNextId(prefix: string): string {
        this.state.idCounter += 1;
        this.markDirty('idCounter');
        return `${prefix}_${this.state.idCounter}`;
    }

    override loadState(newState: GameState): void {
        super.loadState(newState);
        this.rng = createSeededRandom(this.state.seed);
    }

    setActiveGameDefinitionProvider(provider: ActiveGameDefinitionProvider | null): void {
        this.activeGameDefinitionProvider = provider;
    }

    private rejectCommandOutsideActiveDefinition(type: string, payload?: any): boolean {
        if (!this.activeGameDefinitionProvider) return false;

        const validation = validateGameCommandForActiveDefinition(this.activeGameDefinitionProvider, type, payload);
        if (validation.ok) return false;

        const commandId = this.getNextId('cmd_reject');
        const reason = validation.reason ?? `Command type ${type} is not declared by the active game definition.`;
        console.warn(`[StateManager] Rejected command '${type}': ${reason}`);
        this.state.ui.lastCommandResult = {
            commandId,
            type,
            ok: false,
            code: validation.action ? 'COMMAND_PAYLOAD_INVALID' : 'COMMAND_NOT_DECLARED',
            reason,
        };
        this.markDirty('ui');
        return true;
    }

    pushCommand(type: string, payload?: any): void {
        if (this.rejectCommandOutsideActiveDefinition(type, payload)) {
            return;
        }

        const issuedAtTick = this.state.tickCount;
        const command = createQueuedGameCommandCandidateEnvelope(
            type,
            payload,
            GAME_COMMAND_CANDIDATE_SOURCES.UI,
            'StateManager pushCommand',
            issuedAtTick,
            this.state.commandQueue.length,
            this.getNextId('cmd'),
        );
        this.state.commandQueue.push(command as GameState['commandQueue'][number]);
        this.markDirty('commandQueue');
    }

    setLockstepCommandBuffer(buffer: LockstepCommandBuffer | null): void {
        this.lockstepCommandBuffer = buffer;
    }

    scheduleDeterministicCommand(input: DeterministicCommandInput) {
        if (!this.lockstepCommandBuffer) {
            throw new Error('Lockstep command buffer is not enabled for this StateManager');
        }
        return this.lockstepCommandBuffer.accept(input, this.state.tickCount);
    }

    flushReadyLockstepCommands(): void {
        if (!this.lockstepCommandBuffer) return;
        flushLockstepCommandsToQueue(this.lockstepCommandBuffer, this.state);
        this.markDirty('commandQueue');
    }

    drainCommands(): Array<{ type: string; payload?: any }> {
        const commands = this.state.commandQueue.map(({ type, payload }) => ({ type, payload }));
        this.state.commandQueue = [];
        this.markDirty('commandQueue');
        return commands;
    }

    pushEffect(effect: any): void {
        this.state.pendingEffects.push(effect);
        this.markDirty('pendingEffects');
    }

    setCommandResult(status: LegacyCommandResultStatus, message: string): void {
        const statusText = typeof status === 'string' ? status : status ? 'SUCCESS' : 'ERROR';
        this.state.ui.lastCommandResult = {
            commandId: this.getNextId('result'),
            type: 'LEGACY',
            ok: typeof status === 'boolean' ? status : ['SUCCESS', 'OK', 'ACCEPTED'].includes(status),
            code: statusText,
            reason: message || undefined,
        };
        this.markDirty('ui');
    }
}
