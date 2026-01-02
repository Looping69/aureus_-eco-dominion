/**
 * Agent Decision-Making Logic (Utility AI)
 * Migrated from simulationLogic.ts
 */

import { Agent, GridTile, BuildingType, AgentRole, Job } from '../../../types';
import { GRID_SIZE } from '../algorithms/Pathfinding';

// --- CONFIGURATION ---
const CONFIG = {
    // Utility Scoring Constants
    SCORES: {
        SLEEP_CRITICAL: 2.0, // Multiplier
        EAT_CRITICAL: 2.0,
        WORK_BASE: 1.0,
        WORK_DISTANCE_PENALTY: 0.5,
        WORK_SKILL_BONUS: 3,
        WORK_ROLE_BONUS: 20,
        ABANDONED_PENALTY: 100,
        SOCIAL_BASE: 50,
        SOCIAL_FRIEND_BONUS: 20,
        RELAX_BASE: 40,
        WANDER_BASE: 5,
        WANDER_LAZY_BONUS: 15
    }
};

// --- HELPER TYPES ---
export interface ActionOption {
    type: 'SLEEP' | 'EAT' | 'WORK' | 'SOCIALIZE' | 'RELAX' | 'WANDER' | 'PATROL';
    targetTileId: number | null;
    jobId: string | null;
    score: number;
}

// --- HELPER FUNCTIONS ---

export function getDistance(a: number, b: number): number {
    const ax = a % GRID_SIZE, ay = Math.floor(a / GRID_SIZE);
    const bx = b % GRID_SIZE, by = Math.floor(b / GRID_SIZE);
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/**
 * Find nearest tile of a certain building type (with memory caching)
 */
export function findNearestBuilding(agent: Agent, type: BuildingType, grid: GridTile[]): number | null {
    let nearestDist = Infinity;
    let nearestIdx = null;

    // Check memory first for known locations
    const typeKey = type.toString();
    if (agent.memory?.knownBuildings.has(typeKey)) {
        const cached = agent.memory.knownBuildings.get(typeKey)!;
        for (const idx of cached) {
            if (grid[idx]?.buildingType === type && !grid[idx].isUnderConstruction) {
                const d = getDistance(Math.floor(agent.z) * GRID_SIZE + Math.floor(agent.x), idx);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestIdx = idx;
                }
            }
        }
        if (nearestIdx !== null) return nearestIdx;
    }

    // Full scan and update memory
    const foundLocations: number[] = [];
    for (let i = 0; i < grid.length; i++) {
        if (grid[i].buildingType === type && !grid[i].isUnderConstruction) {
            foundLocations.push(i);
            const d = getDistance(Math.floor(agent.z) * GRID_SIZE + Math.floor(agent.x), i);
            if (d < nearestDist) {
                nearestDist = d;
                nearestIdx = i;
            }
        }
    }

    // Update memory
    if (agent.memory && foundLocations.length > 0) {
        agent.memory.knownBuildings.set(typeKey, foundLocations);
    }

    return nearestIdx;
}

/**
 * Smart Wander (avoids recently visited, prefers interesting spots)
 */
export function findWanderTarget(agent: Agent, grid: GridTile[]): number {
    const cx = Math.floor(agent.x);
    const cz = Math.floor(agent.z);
    const currentIdx = cz * GRID_SIZE + cx;

    // Sociable agents prefer social hubs and populated areas
    if (agent.personality && agent.personality.sociability > 0.6) {
        const socialHub = findNearestBuilding(agent, BuildingType.SOCIAL_HUB, grid);
        if (socialHub && Math.random() < agent.personality.sociability) {
            return socialHub;
        }
    }

    // Check for favorite spots
    if (agent.memory?.favoriteSpots.length && Math.random() > 0.7) {
        const fav = agent.memory.favoriteSpots[Math.floor(Math.random() * agent.memory.favoriteSpots.length)];
        if (grid[fav] && !grid[fav].locked) return fav;
    }

    let attempts = 0;
    let bestTarget = currentIdx;
    let bestScore = -Infinity;

    while (attempts < 15) {
        attempts++;
        const rad = 8 + Math.floor((agent.personality?.bravery || 0.5) * 6); // Brave agents wander further
        const dx = Math.floor(Math.random() * (rad * 2 + 1)) - rad;
        const dy = Math.floor(Math.random() * (rad * 2 + 1)) - rad;

        const tx = cx + dx;
        const ty = cz + dy;

        if (tx >= 0 && tx < GRID_SIZE && ty >= 0 && ty < GRID_SIZE) {
            const idx = ty * GRID_SIZE + tx;
            const t = grid[idx];

            if (t && !t.locked && t.buildingType !== BuildingType.POND) {
                let score = 0;

                // Prefer roads
                if (t.buildingType === BuildingType.ROAD) score += 2;

                // Avoid recently visited
                if (agent.memory?.recentlyVisited.includes(idx)) score -= 5;

                // Prefer grass biome
                if (t.biome === 'GRASS') score += 1;

                // Add some randomness
                score += Math.random() * 3;

                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = idx;
                }
            }
        }
    }

    return bestTarget;
}

/**
 * Calculate Score for all possible actions
 */
export function calculateUtilityScores(
    agent: Agent,
    grid: GridTile[],
    jobs: Job[],
    allAgents: Agent[]
): ActionOption[] {
    const options: ActionOption[] = [];
    const currentTileIdx = Math.floor(agent.z) * GRID_SIZE + Math.floor(agent.x);
    const personality = agent.personality || { diligence: 0.5, sociability: 0.5, bravery: 0.5, patience: 0.5 };

    // Calculate need urgencies (0-1 scale, higher = more urgent)
    const energyUrgency = Math.max(0, (100 - agent.energy) / 100);
    const hungerUrgency = Math.max(0, (100 - agent.hunger) / 100);
    const moodUrgency = Math.max(0, (100 - agent.mood) / 100);

    // 1. SLEEP option
    const bedIdx = findNearestBuilding(agent, BuildingType.STAFF_QUARTERS, grid);
    const sleepScore = energyUrgency * 100 * (1 + (agent.energy < 30 ? CONFIG.SCORES.SLEEP_CRITICAL : 0));
    options.push({
        type: 'SLEEP',
        targetTileId: bedIdx ?? currentTileIdx, // Fallback to floor
        jobId: 'sys_sleep',
        score: sleepScore
    });

    // 2. EAT option
    const foodIdx = findNearestBuilding(agent, BuildingType.CANTEEN, grid);
    const eatScore = hungerUrgency * 100 * (1 + (agent.hunger < 30 ? CONFIG.SCORES.EAT_CRITICAL : 0));
    options.push({
        type: 'EAT',
        targetTileId: foodIdx,
        jobId: 'sys_eat',
        score: eatScore
    });

    // 3. WORK options
    const availableJobs = jobs.filter(j => {
        if (j.type === 'MOVE') return false;
        if (j.type === 'BUILD') return true; // Shared
        return !j.assignedAgentId || j.assignedAgentId === agent.id;
    });

    for (const job of availableJobs) {
        let workScore = job.priority;

        // Distance penalty
        const dist = getDistance(currentTileIdx, job.targetTileId);
        workScore -= dist * CONFIG.SCORES.WORK_DISTANCE_PENALTY;

        // Penalty for recently abandoned jobs
        if (agent.lastAbandonedJobId === job.id) {
            workScore -= CONFIG.SCORES.ABANDONED_PENALTY;
        }

        // Skill bonus
        if (job.type === 'BUILD') {
            workScore += agent.skills.construction * CONFIG.SCORES.WORK_SKILL_BONUS;
            if (agent.type === 'ENGINEER') workScore += CONFIG.SCORES.WORK_ROLE_BONUS;
        } else if (job.type === 'MINE') {
            workScore += agent.skills.mining * CONFIG.SCORES.WORK_SKILL_BONUS;
            if (agent.type === 'MINER') workScore += CONFIG.SCORES.WORK_ROLE_BONUS;
        } else if (job.type === 'REHABILITATE' || job.type === 'FARM') {
            workScore += agent.skills.plants * CONFIG.SCORES.WORK_SKILL_BONUS;
            if (agent.type === 'BOTANIST') workScore += CONFIG.SCORES.WORK_ROLE_BONUS;
        }

        // Personality
        workScore *= (0.7 + personality.diligence * 0.6);

        // Reduce work desire when tired/hungry
        workScore *= Math.max(0.3, Math.min(agent.energy, agent.hunger) / 100);

        options.push({
            type: 'WORK',
            targetTileId: job.targetTileId,
            jobId: job.id,
            score: workScore
        });
    }

    // 4. SOCIALIZE option
    const nearbyAgents = allAgents.filter(a =>
        a.id !== agent.id &&
        a.type !== 'ILLEGAL_MINER' &&
        a.state !== 'SLEEPING' &&
        getDistance(currentTileIdx, Math.floor(a.z) * GRID_SIZE + Math.floor(a.x)) < 15
    );

    if (nearbyAgents.length > 0) {
        const friend = nearbyAgents.find(a => agent.memory?.friendIds.includes(a.id)) || nearbyAgents[0];
        const friendIdx = Math.floor(friend.z) * GRID_SIZE + Math.floor(friend.x);

        let socialScore = moodUrgency * CONFIG.SCORES.SOCIAL_BASE * personality.sociability;
        if (agent.memory?.friendIds.includes(friend.id)) socialScore += CONFIG.SCORES.SOCIAL_FRIEND_BONUS;

        options.push({
            type: 'SOCIALIZE',
            targetTileId: friendIdx,
            jobId: `sys_social_${friend.id}`,
            score: socialScore
        });
    }

    // 5. RELAX option
    const funIdx = findNearestBuilding(agent, BuildingType.SOCIAL_HUB, grid);
    const relaxScore = moodUrgency * CONFIG.SCORES.RELAX_BASE;
    options.push({
        type: 'RELAX',
        targetTileId: funIdx,
        jobId: 'sys_fun',
        score: relaxScore
    });

    // 6. PATROL option (Security only)
    if (agent.type === 'SECURITY') {
        const patrolScore = 30 * personality.diligence;
        options.push({
            type: 'PATROL',
            targetTileId: findWanderTarget(agent, grid),
            jobId: 'sys_patrol',
            score: patrolScore
        });
    }

    // 7. WANDER option
    const wanderScore = CONFIG.SCORES.WANDER_BASE + (1 - personality.diligence) * CONFIG.SCORES.WANDER_LAZY_BONUS + 500; // FORCE HIGH SCORE FOR DEBUG
    options.push({
        type: 'WANDER',
        targetTileId: findWanderTarget(agent, grid),
        jobId: 'sys_wander',
        score: wanderScore
    });

    // Sort descending
    return options.sort((a, b) => b.score - a.score);
}
