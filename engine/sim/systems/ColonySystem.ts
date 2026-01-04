/**
 * Colony System
 * Handles agent recruitment, news generation, and population management.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { GameState, BuildingType, SfxType } from '../../../types';
import { createColonist, MAX_AGENTS, CAPACITY_PER_QUARTERS } from '../logic/SimulationLogic';
import { GRID_SIZE } from '../../utils/GameUtils';

export class ColonySystem extends BaseSimSystem {
    readonly id = 'colony';
    readonly priority = 30;

    private lastRecruitmentCheck = 0;
    private readonly RECRUITMENT_INTERVAL = 10.0; // Seconds

    tick(ctx: FixedContext, state: GameState): void {
        if (ctx.time - this.lastRecruitmentCheck < this.RECRUITMENT_INTERVAL) return;
        this.lastRecruitmentCheck = ctx.time;

        const agents = state.agents;
        const grid = state.grid;
        if (!agents || !grid) return;

        // Recruitment Logic
        const aliveColonists = agents.filter(a => a.type !== 'ILLEGAL_MINER');
        if (aliveColonists.length < MAX_AGENTS) {
            const quarters = grid.filter(t => t.buildingType === BuildingType.STAFF_QUARTERS && !t.isUnderConstruction).length;
            const capacity = (quarters * CAPACITY_PER_QUARTERS) + 4;

            if (aliveColonists.length < capacity) {
                const spawnX = Math.floor(GRID_SIZE / 2);
                const spawnZ = Math.floor(GRID_SIZE / 2);

                const newAgent = createColonist(spawnX, spawnZ);
                agents.push(newAgent);

                state.newsFeed.push({
                    id: `arr_${Date.now()}`,
                    headline: `Welcome, ${newAgent.name}! A new colonist has arrived.`,
                    type: 'POSITIVE',
                    timestamp: Date.now()
                });

                // Audio cue
                state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.UI_CLICK });
            }
        }
    }
}
