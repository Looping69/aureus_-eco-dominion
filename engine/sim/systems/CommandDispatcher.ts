/**
 * Command Dispatcher System
 * Centralizes command processing, captures results, and logs trace.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext, CommandContext, CommandResult, CommandErrorCode } from '../../kernel/Types';
import { Contract, GameState, GameCommand, SfxType } from '../../../types';
import { designateRubbleDropZone, fillSubsurfaceCellWithRubble, queueSubsurfaceExcavationJob, queueSubsurfaceRubbleClearJob } from '../../subsurface/SubsurfaceModel';
import { applySectorPolicyCommand } from '../logic/sectorPolicyCommand';

const CONTRACT_COMPLETION_TTL = 75;
const CONTRACT_WORK_SECONDS = 300;

export class CommandDispatcher extends BaseSimSystem {
    readonly id = 'command-dispatcher';
    readonly priority = 100; // Run first to process input before logic systems

    private systems: any[] = [];

    /**
     * Register systems that can handle commands.
     * Order matters for handling priority.
     */
    setSystems(systems: any[]) {
        this.systems = systems;
    }

    tick(ctx: FixedContext, state: GameState): void {
        if (!state.commandQueue || state.commandQueue.length === 0) return;

        const queue = [...state.commandQueue];
        state.commandQueue = [];

        const commandCtx: CommandContext = {
            ...ctx,
            tick: state.tickCount,
            reportResult: (commandId, result) => this.reportResult(commandId, result, state)
        };

        for (let sequence = 0; sequence < queue.length; sequence += 1) {
            const cmd = queue[sequence];
            cmd.issuedAtTick = cmd.issuedAtTick ?? state.tickCount;
            this.dispatchCommand(cmd, commandCtx, state, sequence);
        }
    }

    private dispatchCommand(cmd: GameCommand, ctx: CommandContext, state: GameState, sequence: number) {
        let handledBy: string | null = null;
        let result: CommandResult | null = null;
        const commandType = cmd.type as string;

        if (commandType === 'CLAIM_GOAL') {
            result = this.claimGoal(state);
            handledBy = this.id;
        } else if (commandType === 'UPDATE_SECTOR_POLICY') {
            result = this.updateSectorPolicy(cmd, state);
            handledBy = this.id;
        } else if (commandType === 'ACCEPT_CONTRACT') {
            result = this.acceptContract(cmd, state);
            handledBy = this.id;
        } else if (commandType === 'DELIVER_CONTRACT') {
            result = this.deliverContract(cmd, state);
            handledBy = this.id;
        } else if (commandType === 'ABANDON_CONTRACT') {
            result = this.abandonContract(cmd, state);
            handledBy = this.id;
        } else if (commandType === 'DIG_VOXEL') {
            result = this.digVoxel(cmd, state);
            handledBy = this.id;
        } else if (commandType === 'CLEAR_RUBBLE') {
            result = this.clearRubble(cmd, state);
            handledBy = this.id;
        } else if (commandType === 'DESIGNATE_RUBBLE_DUMP') {
            result = this.designateRubbleDump(cmd, state);
            handledBy = this.id;
        } else if (commandType === 'FILL_VOXEL') {
            result = this.fillVoxel(cmd, state);
            handledBy = this.id;
        }

        // Try each registered system in order
        if (result === null) {
            for (const system of this.systems) {
                if (system && system.enabled && system.handleCommand) {
                    result = system.handleCommand(cmd, ctx, state);
                    if (result) {
                        handledBy = system.id;
                        break;
                    }
                }
            }
        }

        // If not handled, report failure
        if (result === null) {
            result = {
                ok: false,
                code: CommandErrorCode.UNKNOWN,
                reason: `No system handled command type: ${cmd.type}`
            };
            handledBy = 'NONE';
        }

        this.reportResult(cmd.id, result, state, handledBy, cmd, sequence);
    }

    private updateSectorPolicy(cmd: GameCommand, state: GameState): CommandResult {
        const result = applySectorPolicyCommand(state.factory?.sectors, cmd.payload);
        if (result.ok === false) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: result.reason };
        }
        return { ok: true };
    }

    private claimGoal(state: GameState): CommandResult {
        const goal = state.activeGoal;
        if (!goal) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'No active goal to claim.' };
        }
        if (!goal.completed) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Active goal is not complete yet.' };
        }

        if (goal.reward.type === 'AGT') {
            state.resources.agt += goal.reward.amount;
        } else {
            state.resources.gems += goal.reward.amount;
        }

        state.newsFeed.unshift({
            id: `goal_claim_${state.tickCount}_${goal.id}`,
            headline: `MISSION COMPLETE: ${goal.title} reward claimed.`,
            type: 'POSITIVE',
            timestamp: state.tickCount,
        });
        if (state.newsFeed.length > 8) {
            state.newsFeed.length = 8;
        }
        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.COMPLETE });
        state.activeGoal = null;
        return { ok: true };
    }

    private getVoxelTarget(cmd: GameCommand): { x: number; y: number; z: number } | CommandResult {
        const x = Math.round(Number(cmd.payload?.x));
        const y = Math.round(Number(cmd.payload?.y));
        const z = Math.round(Number(cmd.payload?.z));
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Voxel target must include x, y, and z.' };
        }
        return { x, y, z };
    }

    private digVoxel(cmd: GameCommand, state: GameState): CommandResult {
        const target = this.getVoxelTarget(cmd);
        if ('ok' in target) return target;
        return queueSubsurfaceExcavationJob(state, target.x, target.y, target.z);
    }

    private clearRubble(cmd: GameCommand, state: GameState): CommandResult {
        const target = this.getVoxelTarget(cmd);
        if ('ok' in target) return target;
        return queueSubsurfaceRubbleClearJob(state, target.x, target.y, target.z);
    }

    private designateRubbleDump(cmd: GameCommand, state: GameState): CommandResult {
        const target = this.getVoxelTarget(cmd);
        if ('ok' in target) return target;
        return designateRubbleDropZone(state, target.x, target.y, target.z);
    }

    private fillVoxel(cmd: GameCommand, state: GameState): CommandResult {
        const target = this.getVoxelTarget(cmd);
        if ('ok' in target) return target;
        return fillSubsurfaceCellWithRubble(state, target.x, target.y, target.z);
    }

    private acceptContract(cmd: GameCommand, state: GameState): CommandResult {
        const contract = this.findContract(cmd, state);
        if (!contract) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Contract not found.' };
        }
        contract.status ??= 'AVAILABLE';
        if (contract.status !== 'AVAILABLE') {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: `Contract is already ${contract.status.toLowerCase().replace(/_/g, ' ')}.` };
        }

        contract.status = 'ACCEPTED';
        contract.acceptedAtTick = state.tickCount;
        contract.deliveredAmount = 0;
        contract.trustReward ??= 2;
        contract.trustPenalty ??= 3;
        contract.failureReason = undefined;
        contract.timeLeft = CONTRACT_WORK_SECONDS;
        state.newsFeed.unshift({
            id: `contract_accept_${Date.now()}_${contract.id}`,
            headline: `Contract accepted: deliver ${contract.amount} ${this.formatResource(contract.resource)}.`,
            type: 'NEUTRAL',
            timestamp: state.tickCount,
        });
        return { ok: true };
    }

    private deliverContract(cmd: GameCommand, state: GameState): CommandResult {
        const contract = this.findContract(cmd, state);
        if (!contract) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Contract not found.' };
        }
        contract.status ??= 'AVAILABLE';
        if (contract.status === 'AVAILABLE') {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Accept the contract before delivering.' };
        }
        if (contract.status !== 'ACCEPTED' && contract.status !== 'READY_TO_DELIVER') {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: `Contract is already ${contract.status.toLowerCase().replace(/_/g, ' ')}.` };
        }

        const resourceKey = this.getResourceKey(contract.resource);
        if (state.resources[resourceKey] < contract.amount) {
            const missing = Math.ceil(contract.amount - state.resources[resourceKey]);
            return { ok: false, code: CommandErrorCode.INSUFFICIENT_RESOURCES, reason: `Need ${missing} more ${this.formatResource(contract.resource)}.` };
        }

        const trustReward = contract.trustReward ?? 2;
        state.resources[resourceKey] -= contract.amount;
        state.resources.agt += contract.reward;
        state.resources.trust = Math.min(100, state.resources.trust + trustReward);
        contract.status = 'COMPLETED';
        contract.completedAtTick = state.tickCount;
        contract.deliveredAmount = contract.amount;
        contract.failureReason = undefined;
        contract.timeLeft = CONTRACT_COMPLETION_TTL;
        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.COMPLETE });
        state.newsFeed.unshift({
            id: `contract_done_${Date.now()}_${contract.id}`,
            headline: `Contract complete: +${contract.reward} AGT, +${trustReward} Trust for ${this.formatResource(contract.resource)} delivery.`,
            type: 'POSITIVE',
            timestamp: state.tickCount,
        });
        return { ok: true };
    }

    private abandonContract(cmd: GameCommand, state: GameState): CommandResult {
        const contract = this.findContract(cmd, state);
        if (!contract) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Contract not found.' };
        }
        contract.status ??= 'AVAILABLE';
        if (contract.status !== 'ACCEPTED' && contract.status !== 'READY_TO_DELIVER') {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: `Only accepted contracts can be abandoned.` };
        }

        const trustPenalty = contract.trustPenalty ?? 3;
        contract.status = 'FAILED';
        contract.failedAtTick = state.tickCount;
        contract.abandonedAtTick = state.tickCount;
        contract.failureReason = 'Abandoned by player.';
        contract.timeLeft = CONTRACT_COMPLETION_TTL;
        state.resources.agt = Math.max(0, state.resources.agt - contract.penalty);
        state.resources.trust = Math.max(0, state.resources.trust - trustPenalty);
        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.ERROR });
        state.newsFeed.unshift({
            id: `contract_abandon_${Date.now()}_${contract.id}`,
            headline: `Contract abandoned: -${contract.penalty} AGT, -${trustPenalty} Trust.`,
            type: 'NEGATIVE',
            timestamp: state.tickCount,
        });
        return { ok: true };
    }

    private findContract(cmd: GameCommand, state: GameState): Contract | undefined {
        const contractId = cmd.payload?.contractId ?? cmd.payload;
        return state.contracts.find(contract => contract.id === contractId);
    }

    private getResourceKey(resource: Contract['resource']): 'minerals' | 'gems' | 'wood' | 'stone' {
        if (resource === 'GEMS') return 'gems';
        if (resource === 'WOOD') return 'wood';
        if (resource === 'STONE') return 'stone';
        return 'minerals';
    }

    private formatResource(resource: Contract['resource']): string {
        if (resource === 'GEMS') return 'Gems';
        if (resource === 'WOOD') return 'Wood';
        if (resource === 'STONE') return 'Stone';
        return 'Minerals';
    }

    private reportResult(
        commandId: string,
        result: CommandResult,
        state: GameState,
        handledBy: string = 'UNKNOWN',
        cmd?: GameCommand,
        sequence = -1,
    ) {
        // 1. Prepare result data with safe narrowing
        const ok = result.ok;
        const code = result.ok ? undefined : (result as any).code;
        const reason = result.ok ? undefined : (result as any).reason;

        // 2. Update UI-safe feedback
        const feedbackTypes = ['PLACE_BUILDING', 'BUY_BUILDING', 'BULLDOZE', 'BULLDOZE_SUB', 'PLACE_SUB_BUILDING', 'UPGRADE_BUILDING', 'SELL_RESOURCE', 'BUY_RESOURCE', 'CLAIM_GOAL', 'UPDATE_SECTOR_POLICY', 'ACCEPT_CONTRACT', 'DELIVER_CONTRACT', 'ABANDON_CONTRACT', 'DIG_VOXEL', 'CLEAR_RUBBLE', 'DESIGNATE_RUBBLE_DUMP', 'FILL_VOXEL'];
        if (!ok || (cmd && feedbackTypes.includes(cmd.type as string))) {
            state.ui.lastCommandResult = {
                commandId,
                type: cmd?.type || 'UNKNOWN',
                ok,
                code,
                reason
            };
        }

        // 3. Log to Debug Trace (Ring Buffer)
        state.debug.commandTrace.push({
            tick: state.tickCount,
            issuedAtTick: cmd?.issuedAtTick ?? state.tickCount,
            sequence,
            source: this.getCommandSource(cmd),
            commandId,
            commandType: cmd?.type || 'UNKNOWN',
            payloadSummary: this.summarizePayload(cmd?.payload),
            handledBy,
            validationResult: ok ? 'accepted' : 'rejected',
            rejectionReason: reason,
            result: { ok, code, reason }
        });

        if (state.debug.commandTrace.length > 200) {
            state.debug.commandTrace.shift();
        }

        // 4. Console Log for development
        if (!ok) {
            console.warn(`[CommandDispatcher] Command ${commandId} (${cmd?.type}) REJECTED: ${reason}`, result);
        } else {
            console.log(`[CommandDispatcher] Command ${commandId} (${cmd?.type}) ACCEPTED by ${handledBy}`);
        }
    }

    private getCommandSource(cmd?: GameCommand): string {
        return typeof cmd?.source === 'string' && cmd.source.length > 0 ? cmd.source : 'unknown';
    }

    private summarizePayload(payload: any): string {
        if (!payload) return 'none';
        const str = JSON.stringify(payload);
        return str.length > 60 ? str.substring(0, 57) + '...' : str;
    }
}
