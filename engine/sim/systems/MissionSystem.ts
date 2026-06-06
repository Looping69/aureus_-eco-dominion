/**
 * Mission System
 * Handles automated generation of goals and shipping contracts.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { BuildingType, GameState, GridTile } from '../../../types';
import { generateGoal } from '../logic/AiLogic';

export class MissionSystem extends BaseSimSystem {
    readonly id = 'missions';
    readonly priority = 10;

    private lastGoalCheck = 0;
    private lastContractCheck = 0;

    tick(ctx: FixedContext, state: GameState): void {
        // 1. Goal progress updates every mission tick so objectives reflect live play.
        this.updateGoalProgress(state);

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

    private updateContracts(ctx: FixedContext, state: GameState) {
        if (state.contracts.length < 3) {
            const nextRand = () => ctx.random ? ctx.random.next() : Math.random();
            const isGem = nextRand() > 0.7;
            const amount = isGem ? Math.floor(nextRand() * 5) + 2 : Math.floor(nextRand() * 100) + 50;
            const reward = isGem ? amount * 1000 : amount * 25;

            state.contracts.push({
                id: ctx.getNextId?.('cont') || `cont_${Date.now()}`,
                description: `Economic Demand: Needs ${amount} ${isGem ? 'Gems' : 'Minerals'} immediately.`,
                resource: isGem ? 'GEMS' : 'MINERALS',
                amount,
                reward,
                timeLeft: 300,
                penalty: Math.floor(reward * 0.2)
            });
        }
    }

    private processContractTimers(ctx: FixedContext, state: GameState) {
        const dt = ctx.fixedDt;
        for (let i = 0; i < state.contracts.length; i++) {
            const contract = state.contracts[i];
            contract.timeLeft -= dt;

            if (contract.timeLeft <= 0) {
                // Fail contract
                state.contracts.splice(i, 1);
                i--;
                state.resources.agt = Math.max(0, state.resources.agt - contract.penalty);
                state.newsFeed.push({
                    id: ctx.getNextId?.('fail') || `fail_${Date.now()}`,
                    headline: `Contract Failed: Penalized ${contract.penalty} AGT.`,
                    type: 'CRITICAL',
                    timestamp: state.tickCount
                });
            }
        }
    }
}