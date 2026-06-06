/**
 * Mission System
 * Handles automated generation of goals and shipping contracts.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { BuildingType, Contract, GameState, GridTile } from '../../../types';
import { generateGoal } from '../logic/AiLogic';

const MAX_ACTIVE_CONTRACTS = 3;
const CONTRACT_WORK_SECONDS = 300;
const CONTRACT_OFFER_SECONDS = 180;
const TERMINAL_DISPLAY_SECONDS = 75;
const FIRST_MINERAL_CONTRACT_AMOUNT = 80;
const FIRST_MINERAL_CONTRACT_REWARD = 2000;

export class MissionSystem extends BaseSimSystem {
    readonly id = 'missions';
    readonly priority = 10;

    private lastGoalCheck = 0;
    private lastContractCheck = 0;

    tick(ctx: FixedContext, state: GameState): void {
        // 1. Goal progress updates every mission tick so objectives reflect live play.
        this.updateGoalProgress(state);
        this.normalizeContracts(state);

        // 2. Goal Generation (Every 30s if none active)
        if (!state.activeGoal && ctx.time - this.lastGoalCheck > 30) {
            this.lastGoalCheck = ctx.time;
            state.activeGoal = generateGoal(ctx, state);
            this.updateGoalProgress(state);
        }

        // 3. Contract Management (Every 60s)
        if (ctx.time - this.lastContractCheck > 60) {
            this.lastContractCheck = ctx.time;
            this.updateContracts(ctx, state);
        }

        // 4. Contract Timers
        this.processContractTimers(ctx, state);
    }

    private updateGoalProgress(state: GameState): void {
        const goal = state.activeGoal;
        if (!goal || goal.completed) return;

        if (goal.type === 'BUILD' && this.isBuildingTarget(goal.targetType)) {
            goal.currentValue = this.countCompletedBuildings(state, goal.targetType);
        } else if (goal.targetType === 'AGT') {
            goal.currentValue = state.resources.agt;
        } else if (goal.targetType === 'MINERALS') {
            goal.currentValue = state.resources.minerals;
        } else if (goal.targetType === 'ECO') {
            goal.currentValue = state.resources.eco;
        } else if (goal.targetType === 'TRUST') {
            goal.currentValue = state.resources.trust;
        } else if (goal.targetType === 'GEMS') {
            goal.currentValue = state.resources.gems;
        }

        goal.completed = goal.currentValue >= goal.targetValue;
    }

    private countCompletedBuildings(state: GameState, type: BuildingType): number {
        return Object.values(state.chunks)
            .flatMap(chunk => chunk.tiles)
            .filter(tile => tile.buildingType === type && !tile.isUnderConstruction && this.isStructureHead(tile))
            .length;
    }

    private isBuildingTarget(targetType: unknown): targetType is BuildingType {
        return Object.values(BuildingType).includes(targetType as BuildingType);
    }

    private isStructureHead(tile: GridTile): boolean {
        return tile.structureHeadX === undefined
            || (tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ);
    }

    private normalizeContracts(state: GameState): void {
        for (const contract of state.contracts) {
            contract.status ??= 'AVAILABLE';
            contract.deliveredAmount ??= contract.status === 'COMPLETED' ? contract.amount : 0;
            contract.trustReward ??= 2;
            contract.trustPenalty ??= 3;
            contract.timeLeft = Math.max(0, contract.timeLeft ?? CONTRACT_OFFER_SECONDS);
            this.updateDeliveryReadiness(state, contract);
        }
    }

    private updateContracts(ctx: FixedContext, state: GameState) {
        const activeCount = state.contracts.filter(contract =>
            contract.status === 'AVAILABLE' || contract.status === 'ACCEPTED' || contract.status === 'READY_TO_DELIVER'
        ).length;

        if (activeCount >= MAX_ACTIVE_CONTRACTS) return;

        const shouldSeedMineralLoop = !state.contracts.some(contract =>
            contract.resource === 'MINERALS' && contract.amount === FIRST_MINERAL_CONTRACT_AMOUNT
        );

        if (shouldSeedMineralLoop) {
            state.contracts.push({
                id: ctx.getNextId?.('cont') || `cont_${Date.now()}`,
                description: `Starter Demand: Deliver ${FIRST_MINERAL_CONTRACT_AMOUNT} Minerals for the first reliable cash injection.`,
                resource: 'MINERALS',
                amount: FIRST_MINERAL_CONTRACT_AMOUNT,
                reward: FIRST_MINERAL_CONTRACT_REWARD,
                timeLeft: CONTRACT_OFFER_SECONDS,
                penalty: 400,
                status: 'AVAILABLE',
                deliveredAmount: 0,
                trustReward: 2,
                trustPenalty: 3,
            });
            return;
        }

        const nextRand = () => ctx.random ? ctx.random.next() : Math.random();
        const roll = nextRand();
        const resource = roll > 0.82 ? 'GEMS' : roll > 0.62 ? 'WOOD' : roll > 0.44 ? 'STONE' : 'MINERALS';
        const amount = resource === 'GEMS'
            ? Math.floor(nextRand() * 5) + 2
            : Math.floor(nextRand() * 90) + 40;
        const reward = resource === 'GEMS' ? amount * 1000 : amount * (resource === 'MINERALS' ? 25 : 12);

        state.contracts.push({
            id: ctx.getNextId?.('cont') || `cont_${Date.now()}`,
            description: `Economic Demand: Deliver ${amount} ${this.formatResource(resource)} for a guaranteed payout.`,
            resource,
            amount,
            reward,
            timeLeft: CONTRACT_OFFER_SECONDS,
            penalty: Math.floor(reward * 0.2),
            status: 'AVAILABLE',
            deliveredAmount: 0,
            trustReward: 2,
            trustPenalty: 3,
        });
    }

    private processContractTimers(ctx: FixedContext, state: GameState) {
        const dt = ctx.fixedDt;
        for (let i = 0; i < state.contracts.length; i++) {
            const contract = state.contracts[i];
            contract.status ??= 'AVAILABLE';
            this.updateDeliveryReadiness(state, contract);
            contract.timeLeft -= dt;

            if (contract.status === 'AVAILABLE' && contract.timeLeft <= 0) {
                state.contracts.splice(i, 1);
                i--;
                continue;
            }

            if ((contract.status === 'ACCEPTED' || contract.status === 'READY_TO_DELIVER') && contract.timeLeft <= 0) {
                const trustPenalty = contract.trustPenalty ?? 3;
                contract.status = 'FAILED';
                contract.failedAtTick = state.tickCount;
                contract.failureReason = 'Timer expired before delivery.';
                contract.timeLeft = TERMINAL_DISPLAY_SECONDS;
                state.resources.agt = Math.max(0, state.resources.agt - contract.penalty);
                state.resources.trust = Math.max(0, state.resources.trust - trustPenalty);
                state.newsFeed.push({
                    id: ctx.getNextId?.('fail') || `fail_${Date.now()}`,
                    headline: `Contract failed: ${this.formatResource(contract.resource)} delivery missed. -${contract.penalty} AGT, -${trustPenalty} Trust.`,
                    type: 'CRITICAL',
                    timestamp: state.tickCount
                });
                continue;
            }

            if ((contract.status === 'COMPLETED' || contract.status === 'FAILED') && contract.timeLeft <= 0) {
                state.contracts.splice(i, 1);
                i--;
            }
        }
    }

    private updateDeliveryReadiness(state: GameState, contract: Contract): void {
        if (contract.status !== 'ACCEPTED' && contract.status !== 'READY_TO_DELIVER') return;
        const stock = state.resources[this.getResourceKey(contract.resource)] || 0;
        contract.deliveredAmount = Math.min(contract.amount, Math.floor(stock));
        contract.status = stock >= contract.amount ? 'READY_TO_DELIVER' : 'ACCEPTED';
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
}