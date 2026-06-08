import { BaseSimSystem } from '../Simulation';
import { FixedContext, CommandContext, CommandResult } from '../../kernel/Types';
import { Contract, GameCommand, GameState } from '../../../types';

type OverseerMode = 'OBSERVE' | 'CONTRACTS' | 'STABILITY' | 'GROWTH';

type OverseerState = {
    enabled: boolean;
    mode: OverseerMode;
    autoAct: boolean;
    confidence: number;
    currentFocus: string;
    recommendation: string;
    lastAction: string | null;
    nextReviewAt: number;
    actionLog: Array<{ tick: number; label: string }>;
};

const DEFAULT_OVERSEER: OverseerState = {
    enabled: true,
    mode: 'OBSERVE',
    autoAct: false,
    confidence: 0.55,
    currentFocus: 'Reading the colony state',
    recommendation: 'Watching contracts, utilities, workforce, and progression before acting.',
    lastAction: null,
    nextReviewAt: 0,
    actionLog: [],
};

const RESOURCE_KEY: Record<Contract['resource'], 'minerals' | 'gems' | 'wood' | 'stone'> = {
    MINERALS: 'minerals',
    GEMS: 'gems',
    WOOD: 'wood',
    STONE: 'stone',
};

const RESOURCE_LABEL: Record<Contract['resource'], string> = {
    MINERALS: 'Minerals',
    GEMS: 'Gems',
    WOOD: 'Wood',
    STONE: 'Stone',
};

function getOverseer(state: GameState): OverseerState {
    const existing = (state as any).aiOverseer as Partial<OverseerState> | undefined;
    const normalized: OverseerState = {
        ...DEFAULT_OVERSEER,
        ...existing,
        actionLog: Array.isArray(existing?.actionLog) ? existing!.actionLog!.slice(0, 5) : [],
    };
    (state as any).aiOverseer = normalized;
    return normalized;
}

export class AIOverseerSystem extends BaseSimSystem {
    readonly id = 'ai-overseer';
    readonly priority = 9;

    tick(ctx: FixedContext, state: GameState): void {
        const overseer = getOverseer(state);
        if (!overseer.enabled) return;
        if (ctx.time < overseer.nextReviewAt) return;

        overseer.nextReviewAt = ctx.time + 4;
        const insight = this.analyze(state);
        overseer.confidence = insight.confidence;
        overseer.currentFocus = insight.focus;
        overseer.recommendation = insight.recommendation;

        if (overseer.autoAct) {
            this.tryAct(ctx, state, overseer);
        }
    }

    handleCommand(cmd: GameCommand, _ctx: CommandContext, state: GameState): CommandResult | null {
        if ((cmd.type as string) !== 'SET_AI_OVERSEER') return null;
        const overseer = getOverseer(state);
        const payload = cmd.payload || {};

        if (typeof payload.enabled === 'boolean') overseer.enabled = payload.enabled;
        if (typeof payload.autoAct === 'boolean') overseer.autoAct = payload.autoAct;
        if (['OBSERVE', 'CONTRACTS', 'STABILITY', 'GROWTH'].includes(payload.mode)) {
            overseer.mode = payload.mode;
        }
        overseer.nextReviewAt = 0;
        this.log(state, overseer, `AI mode: ${overseer.mode}${overseer.autoAct ? ' with auto act' : ''}`);
        return { ok: true };
    }

    private analyze(state: GameState): { focus: string; recommendation: string; confidence: number } {
        const ready = state.contracts.find(contract => this.isReady(contract, state));
        if (ready) {
            return {
                focus: `Ready delivery: ${RESOURCE_LABEL[ready.resource]}`,
                recommendation: `Deliver ${ready.amount} ${RESOURCE_LABEL[ready.resource]} for ${ready.reward.toLocaleString()} AGT.`,
                confidence: 0.94,
            };
        }

        const available = state.contracts.find(contract => (contract.status || 'AVAILABLE') === 'AVAILABLE');
        if (available) {
            const stock = state.resources[RESOURCE_KEY[available.resource]] || 0;
            const coverage = Math.min(1, stock / Math.max(1, available.amount));
            return {
                focus: `Available contract: ${RESOURCE_LABEL[available.resource]}`,
                recommendation: coverage >= 0.5
                    ? `Accept the ${RESOURCE_LABEL[available.resource]} contract; current stock already covers ${Math.round(coverage * 100)}%.`
                    : `Prepare ${RESOURCE_LABEL[available.resource]} production before accepting that contract.`,
                confidence: coverage >= 0.5 ? 0.82 : 0.62,
            };
        }

        if (state.powerGrid?.deficit > 0) {
            return {
                focus: 'Power instability',
                recommendation: `Power deficit detected: ${Math.ceil(state.powerGrid.deficit)} units. Stabilize utilities before expanding production.`,
                confidence: 0.78,
            };
        }

        if (state.waterNetwork?.deficit > 0) {
            return {
                focus: 'Water instability',
                recommendation: `Water deficit detected: ${Math.ceil(state.waterNetwork.deficit)} units. Add supply or reduce demand before scaling.`,
                confidence: 0.76,
            };
        }

        const idleWorkers = state.agents.filter(agent => agent.state === 'IDLE' && agent.type !== 'ILLEGAL_MINER').length;
        if (idleWorkers > 0 && state.jobs.length > 0) {
            return {
                focus: 'Workforce routing',
                recommendation: `${idleWorkers} worker${idleWorkers === 1 ? '' : 's'} idle while ${state.jobs.length} job${state.jobs.length === 1 ? '' : 's'} exist. Inspect unreachable jobs or missing resources.`,
                confidence: 0.7,
            };
        }

        if (state.activeGoal && !state.activeGoal.completed) {
            return {
                focus: state.activeGoal.title,
                recommendation: state.activeGoal.description,
                confidence: 0.68,
            };
        }

        return {
            focus: 'Balanced operations',
            recommendation: 'No urgent bottleneck. Expand deliberately or switch AI to Growth for next-step pressure.',
            confidence: 0.58,
        };
    }

    private tryAct(ctx: FixedContext, state: GameState, overseer: OverseerState): void {
        if (overseer.mode === 'OBSERVE') return;

        if (overseer.mode === 'CONTRACTS' || overseer.mode === 'GROWTH') {
            const ready = state.contracts.find(contract => this.isReady(contract, state));
            if (ready) {
                this.queueCommand(ctx, state, 'DELIVER_CONTRACT', { contractId: ready.id });
                this.log(state, overseer, `Delivered ${ready.amount} ${RESOURCE_LABEL[ready.resource]}`);
                return;
            }

            const acceptable = state.contracts.find(contract => this.shouldAccept(contract, state));
            if (acceptable) {
                this.queueCommand(ctx, state, 'ACCEPT_CONTRACT', { contractId: acceptable.id });
                this.log(state, overseer, `Accepted ${RESOURCE_LABEL[acceptable.resource]} contract`);
                return;
            }
        }

        if (overseer.mode === 'STABILITY') {
            if (state.powerGrid?.deficit > 0 || state.waterNetwork?.deficit > 0) {
                this.log(state, overseer, 'Held expansion: utilities need attention');
            }
        }
    }

    private isReady(contract: Contract, state: GameState): boolean {
        const status = contract.status || 'AVAILABLE';
        if (status !== 'ACCEPTED' && status !== 'READY_TO_DELIVER') return false;
        return (state.resources[RESOURCE_KEY[contract.resource]] || 0) >= contract.amount;
    }

    private shouldAccept(contract: Contract, state: GameState): boolean {
        if ((contract.status || 'AVAILABLE') !== 'AVAILABLE') return false;
        const stock = state.resources[RESOURCE_KEY[contract.resource]] || 0;
        const coverage = stock / Math.max(1, contract.amount);
        if (coverage >= 0.8) return true;
        return contract.resource === 'MINERALS' && coverage >= 0.5 && contract.reward >= contract.penalty * 3;
    }

    private queueCommand(ctx: FixedContext, state: GameState, type: 'ACCEPT_CONTRACT' | 'DELIVER_CONTRACT', payload: any): void {
        state.commandQueue.push({
            id: ctx.getNextId?.('ai_cmd') || `ai_cmd_${Date.now()}`,
            type: type as any,
            payload,
            issuedAtTick: state.tickCount,
        });
    }

    private log(state: GameState, overseer: OverseerState, label: string): void {
        if (overseer.lastAction === label) return;
        overseer.lastAction = label;
        overseer.actionLog = [{ tick: state.tickCount, label }, ...overseer.actionLog].slice(0, 5);
        state.newsFeed.unshift({
            id: `ai_overseer_${Date.now()}_${state.tickCount}`,
            headline: `AI Overseer: ${label}`,
            type: 'NEUTRAL',
            timestamp: state.tickCount,
        });
        state.newsFeed = state.newsFeed.slice(0, 8);
    }
}
