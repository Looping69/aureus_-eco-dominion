/**
 * Colony System
 * Handles agent recruitment, news generation, and population management.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { GameState, BuildingType, SfxType, AgentRole, Agent, GridTile } from '../../../types';
import { createColonist, MAX_AGENTS, CAPACITY_PER_QUARTERS } from '../logic/SimulationLogic';
import { GRID_SIZE } from '../../utils/GameUtils';

export class ColonySystem extends BaseSimSystem {
    readonly id = 'colony';
    readonly priority = 30;

    private lastRecruitmentCheck = 0;
    private readonly RECRUITMENT_INTERVAL = 30.0; // Increased from 10 to 30 seconds (much slower)
    private readonly RECRUITMENT_COST = 100; // AGT cost to recruit new agent

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

            // Check if we have capacity AND resources
            if (aliveColonists.length < capacity && state.resources.agt >= this.RECRUITMENT_COST) {
                // Deduct recruitment cost
                state.resources.agt -= this.RECRUITMENT_COST;

                const spawnX = Math.floor(GRID_SIZE / 2);
                const spawnZ = Math.floor(GRID_SIZE / 2);

                // Determine specialized role based on buildings
                const role = this.determineNeededRole(grid, agents);
                const newAgent = createColonist(spawnX, spawnZ, role);
                agents.push(newAgent);

                const roleNames: Record<AgentRole, string> = {
                    'WORKER': 'General Worker',
                    'MINER': 'Mining Specialist',
                    'ENGINEER': 'Construction Engineer',
                    'BOTANIST': 'Agricultural Botanist',
                    'SECURITY': 'Security Officer',
                    'ILLEGAL_MINER': 'Infiltrator'
                };

                state.newsFeed.push({
                    id: `arr_${Date.now()}`,
                    headline: `${newAgent.name} has joined as ${roleNames[role]}! (-${this.RECRUITMENT_COST} AGT)`,
                    type: 'POSITIVE',
                    timestamp: Date.now()
                });

                // Audio cue
                state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.UI_CLICK });
            }
        }
    }

    /**
     * Determines what role is most needed based on existing buildings
     */
    private determineNeededRole(grid: GridTile[], agents: Agent[]): AgentRole {
        // Count existing roles
        const roleCounts: Record<AgentRole, number> = {
            'WORKER': 0,
            'MINER': 0,
            'ENGINEER': 0,
            'BOTANIST': 0,
            'SECURITY': 0,
            'ILLEGAL_MINER': 0
        };

        agents.forEach(a => {
            if (a.type !== 'ILLEGAL_MINER') {
                roleCounts[a.type]++;
            }
        });

        // Count relevant buildings
        const washPlants = grid.filter(t => t.buildingType === BuildingType.WASH_PLANT && !t.isUnderConstruction).length;
        const recyclingPlants = grid.filter(t => t.buildingType === BuildingType.RECYCLING_PLANT && !t.isUnderConstruction).length;
        const miningHeadframes = grid.filter(t => t.buildingType === BuildingType.MINING_HEADFRAME && !t.isUnderConstruction).length;
        const gardens = grid.filter(t => t.buildingType === BuildingType.COMMUNITY_GARDEN && !t.isUnderConstruction).length;
        const securityPosts = grid.filter(t => t.buildingType === BuildingType.SECURITY_POST && !t.isUnderConstruction).length;
        const constructionSites = grid.filter(t => t.isUnderConstruction).length;

        // Determine needs
        const needsMiners = (washPlants + recyclingPlants + miningHeadframes) * 2; // 2 miners per mining building
        const needsBotanists = gardens; // 1 botanist per garden
        const needsSecurity = securityPosts; // 1 security per post
        const needsEngineers = Math.min(5, Math.ceil(constructionSites / 2)); // Engineers for construction

        // Priority system: Fill critical roles first
        if (roleCounts.MINER < needsMiners && washPlants > 0) return 'MINER';
        if (roleCounts.ENGINEER < needsEngineers && constructionSites > 0) return 'ENGINEER';
        if (roleCounts.SECURITY < needsSecurity && securityPosts > 0) return 'SECURITY';
        if (roleCounts.BOTANIST < needsBotanists && gardens > 0) return 'BOTANIST';

        // Default to worker if no specialized need
        return 'WORKER';
    }
}
