/**
 * Mission System
 * Handles automated generation of goals and shipping contracts.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { BuildingType, Contract, GameState, GridTile } from '../../../types';
import { generateGoal } from '../logic/AiLogic';
import { BUILDINGS } from '../../data/VoxelConstants';

const MAX_ACTIVE_CONTRACTS = 3;
const CONTRACT_WORK_SECONDS = 300;
const CONTRACT_OFFER_SECONDS = 180;
const TERMINAL_DISPLAY_SECONDS = 75;
const FIRST_MINERAL_CONTRACT_AMOUNT = 80;
const FIRST_MINERAL_CONTRACT_REWARD = 2000;
const OPENING_DISPATCH_ID = 'story_opening_dispatch';
const UTILITY_GUIDANCE_DISPATCH_ID = 'starter_utility_connection_dispatch';

export class MissionSystem extends BaseSimSystem {
    readonly id = 'missions';
    readonly priority = 10;

    private lastGoalCheck = 0;
    private lastContractCheck = 0;

    tick(ctx: FixedContext, state: GameState): void {
        this.seedOpeningDispatch(state);
        this.seedUtilityGuidanceDispatch(state);

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

    private seedOpeningDispatch(state: GameState): void {
        if (state.newsFeed.some(item => item.id === OPENING_DISPATCH_ID)) return;
        state.newsFeed.unshift({
            id: OPENING_DISPATCH_ID,
            headline: 'RADIO: Sani Dispatch online. This claim is not empty land; people, payroll, and reputation are now tied to every build order.',
            type: 'NEUTRAL',
            timestamp: state.tickCount,
        });
    }

    private seedUtilityGuidanceDispatch(state: GameState): void {
        if (state.unlockedEras?.includes('GROWTH' as any)) return;
        if (state.newsFeed.some(item => item.id === UTILITY_GUIDANCE_DISPATCH_ID)) return;

        const needsUtilityConnection = Object.values(state.chunks)
            .flatMap(chunk => chunk.tiles)
            .some(tile => this.isUtilityStarvedStructure(tile));

        if (!needsUtilityConnection) return;

        state.newsFeed.unshift({
            id: UTILITY_GUIDANCE_DISPATCH_ID,
            headline: 'RADIO: Utility warning. If a building says Offline or Water-starved, buy a Generator or Water Well, then connect it with Power Line or Pipe from Supply Command.',
            type: 'NEUTRAL',
            timestamp: state.tickCount,
        });
    }

    private isUtilityStarvedStructure(tile: GridTile): boolean {
        if (tile.buildingType === BuildingType.EMPTY || tile.isUnderConstruction || !this.isStructureHead(tile)) return false;
        const def = BUILDINGS[tile.buildingType];
        if (!def) return false;
        const needsPower = Boolean(def.power?.consumes) && tile.powerStatus !== 'CONNECTED';
        const needsWater = Boolean(def.water?.consumes) && tile.waterStatus !== 'CONNECTED';
        return needsPower || needsWater;
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
                description: `Sani District Works needs ${FIRST_MINERAL_CONTRACT_AMOUNT} Minerals to repair a collapsed bridge before the next heatwave. Deliver it and the first people outside the fence will know Aureus keeps promises.`,
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
            description: this.createContractStory(resource, amount),
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

    private createContractStory(resource: Contract['resource'], amount: number): string {
        if (resource === 'MINERALS') {
            return `A rail crew east of the concession needs ${amount} Minerals for track braces. Fast delivery means safer trains and a louder Aureus name on the freight band.`;
        }
        if (resource === 'WOOD') {
            return `A settlement clinic has requested ${amount} Wood for temporary wards and shade frames. It is not glamorous, but it will be remembered.`;
        }
        if (resource === 'STONE') {
            return `Sani District Works needs ${amount} Stone to reinforce flood channels before the next storm line. The payout is cash; the reward is trust.`;
        }
        return `A private research courier is paying high for ${amount} Gems. The manifest is sealed, but every completed premium run funds the next leap.`;
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
                    headline: `RADIO: Missed delivery. ${this.formatResource(contract.resource)} buyers are reporting breach of trust. -${contract.penalty} AGT, -${trustPenalty} Trust.`,
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
