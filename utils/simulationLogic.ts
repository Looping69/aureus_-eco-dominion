
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GameState, Agent, BuildingType, GridTile, SimulationEffect, NewsItem, AgentRole } from '../types';
import { GRID_SIZE } from './gameUtils';
import { BUILDINGS } from './voxelConstants';

// --- CONFIGURATION ---
export const MAX_AGENTS = 30;
export const CAPACITY_PER_QUARTERS = 4;

const CONFIG = {
    SPEED: {
        BASE: 0.10,
        ROAD: 0.18,
        ROUGH: 0.05,
    },
    DECAY: {
        ENERGY: 0.015, // Slower decay (approx 1 day of energy)
        HUNGER: 0.012, // Slower decay
        MOOD: 0.01,
        ILLEGAL_MODIFIER: 0.5,
    },
    THRESHOLDS: {
        CRITICAL: 15, // Real emergency
        LOW: 35,      // Seek fix
        HIGH: 95      // Stop fixing
    }
};

const NAMES = ["Cass", "Jax", "Val", "Rya", "Kael", "Nyx", "Zane", "Mira", "Leo", "Sora", "Elara", "Teron", "Muna", "Vael", "Koda", "Orin", "Tali", "Vex"];

// --- TYPES & INTERFACES ---

interface Point { x: number; y: number; }

// --- PATHFINDING ENGINE (A*) ---

const getTileCost = (tile: GridTile): number => {
    if (tile.buildingType === BuildingType.ROAD) return 0.5; // Highways
    if (tile.buildingType !== BuildingType.EMPTY && !tile.isUnderConstruction && tile.buildingType !== BuildingType.POND) return 1.0; // Buildings (indoors)

    switch (tile.biome) {
        case 'SAND': return 2.0;
        case 'SNOW': return 2.0;
        case 'STONE': return 1.5;
        default: return 1.0; // Grass/Dirt
    }
};

const getDistance = (a: number, b: number) => {
    const ax = a % GRID_SIZE, ay = Math.floor(a / GRID_SIZE);
    const bx = b % GRID_SIZE, by = Math.floor(b / GRID_SIZE);
    // Chebyshev distance for 8-way movement (allows diagonals)
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
};

function findPath(startIdx: number, endIdx: number, grid: GridTile[]): number[] | null {
    if (startIdx === endIdx) return [endIdx];

    const openSet: number[] = [startIdx];
    const cameFrom = new Map<number, number>();

    const gScore = new Map<number, number>();
    gScore.set(startIdx, 0);

    const fScore = new Map<number, number>();
    fScore.set(startIdx, getDistance(startIdx, endIdx));

    const openSetHash = new Set<number>(); // For O(1) lookup
    openSetHash.add(startIdx);

    let iterations = 0;
    const MAX_ITERATIONS = 500; // Reduced from 2000 for performance

    while (openSet.length > 0) {
        iterations++;
        if (iterations > MAX_ITERATIONS) return null; // Path too complex or unreachable

        // Get node with lowest fScore
        let current = openSet[0];
        let lowestF = fScore.get(current) ?? Infinity;

        for (let i = 1; i < openSet.length; i++) {
            const score = fScore.get(openSet[i]) ?? Infinity;
            if (score < lowestF) {
                lowestF = score;
                current = openSet[i];
            }
        }

        if (current === endIdx) {
            // Reconstruct path
            const path = [current];
            let curr = current;
            while (cameFrom.has(curr)) {
                curr = cameFrom.get(curr)!;
                path.unshift(curr);
            }
            return path;
        }

        // Remove current
        const idxInOpen = openSet.indexOf(current);
        openSet.splice(idxInOpen, 1);
        openSetHash.delete(current);

        const cx = current % GRID_SIZE;
        const cy = Math.floor(current / GRID_SIZE);

        // Get Neighbors (8-way including diagonals for smoother movement)
        const neighbors: { idx: number; diagonal: boolean }[] = [];

        // Cardinal directions
        if (cy > 0) neighbors.push({ idx: current - GRID_SIZE, diagonal: false }); // N
        if (cy < GRID_SIZE - 1) neighbors.push({ idx: current + GRID_SIZE, diagonal: false }); // S
        if (cx > 0) neighbors.push({ idx: current - 1, diagonal: false }); // W
        if (cx < GRID_SIZE - 1) neighbors.push({ idx: current + 1, diagonal: false }); // E

        // Diagonal directions
        if (cy > 0 && cx > 0) neighbors.push({ idx: current - GRID_SIZE - 1, diagonal: true }); // NW
        if (cy > 0 && cx < GRID_SIZE - 1) neighbors.push({ idx: current - GRID_SIZE + 1, diagonal: true }); // NE
        if (cy < GRID_SIZE - 1 && cx > 0) neighbors.push({ idx: current + GRID_SIZE - 1, diagonal: true }); // SW
        if (cy < GRID_SIZE - 1 && cx < GRID_SIZE - 1) neighbors.push({ idx: current + GRID_SIZE + 1, diagonal: true }); // SE

        for (const { idx: neighbor, diagonal } of neighbors) {
            const tile = grid[neighbor];
            // Walkable check
            if (tile.locked) continue;
            // Can't walk on water unless it's a bridge (future) or we are swimming (not implemented)
            if (tile.buildingType === BuildingType.POND && neighbor !== endIdx) continue;

            // Allow walking through construction sites, roads, empty tiles, and finished buildings (entering them)
            // Implicitly allowed.

            // Diagonal moves cost more (√2 ≈ 1.41)
            const diagonalMultiplier = diagonal ? 1.41 : 1.0;
            const moveCost = getTileCost(tile) * diagonalMultiplier;
            const tentativeG = (gScore.get(current) ?? Infinity) + moveCost;

            if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
                cameFrom.set(neighbor, current);
                gScore.set(neighbor, tentativeG);
                fScore.set(neighbor, tentativeG + getDistance(neighbor, endIdx));

                if (!openSetHash.has(neighbor)) {
                    openSet.push(neighbor);
                    openSetHash.add(neighbor);
                }
            }
        }
    }

    return null;
}

// --- BEHAVIOR TREE / UTILITY AI ---

// Generate random personality with role-based tendencies
function generatePersonality(role: AgentRole): { diligence: number; sociability: number; bravery: number; patience: number } {
    const base = () => 0.3 + Math.random() * 0.4; // 0.3-0.7 base

    let personality = {
        diligence: base(),
        sociability: base(),
        bravery: base(),
        patience: base()
    };

    // Role-based personality modifiers
    switch (role) {
        case 'ENGINEER':
            personality.patience += 0.2;
            personality.diligence += 0.15;
            break;
        case 'MINER':
            personality.bravery += 0.2;
            personality.patience -= 0.1;
            break;
        case 'BOTANIST':
            personality.patience += 0.25;
            personality.sociability += 0.1;
            break;
        case 'SECURITY':
            personality.bravery += 0.3;
            personality.diligence += 0.1;
            break;
        case 'ILLEGAL_MINER':
            personality.bravery += 0.4;
            personality.diligence = 0.9; // Very driven
            personality.sociability = 0.1; // Loner
            break;
    }

    // Clamp all values
    return {
        diligence: Math.max(0, Math.min(1, personality.diligence)),
        sociability: Math.max(0, Math.min(1, personality.sociability)),
        bravery: Math.max(0, Math.min(1, personality.bravery)),
        patience: Math.max(0, Math.min(1, personality.patience))
    };
}

// Generate role-appropriate skills
function generateSkills(role: AgentRole): { mining: number; construction: number; plants: number; intelligence: number } {
    const base = () => Math.floor(Math.random() * 3) + 1; // 1-3 base
    const bonus = () => Math.floor(Math.random() * 3) + 2; // 2-4 bonus

    let skills = {
        mining: base(),
        construction: base(),
        plants: base(),
        intelligence: base()
    };

    // Role specialization
    switch (role) {
        case 'ENGINEER':
            skills.construction = bonus() + 2;
            skills.intelligence = bonus();
            break;
        case 'MINER':
            skills.mining = bonus() + 2;
            break;
        case 'BOTANIST':
            skills.plants = bonus() + 2;
            skills.intelligence = bonus();
            break;
        case 'SECURITY':
            skills.mining = bonus(); // Combat/strength
            break;
        case 'WORKER':
            // Workers are generalists - boost one random skill
            const skillKey = ['mining', 'construction', 'plants'][Math.floor(Math.random() * 3)] as keyof typeof skills;
            skills[skillKey] = bonus();
            break;
    }

    return skills;
}

export function createColonist(x: number, z: number, role: AgentRole = 'WORKER'): Agent {
    const isIllegal = role === 'ILLEGAL_MINER';

    // Assign shift based on role
    let shift: 'DAY' | 'NIGHT' | 'FLEXIBLE' = 'FLEXIBLE';
    if (role === 'BOTANIST') {
        shift = 'DAY'; // Plants need sunlight
    } else if (role === 'SECURITY') {
        shift = 'NIGHT'; // Security patrols at night
    } else if (role === 'MINER' || role === 'ENGINEER') {
        // Mix of shifts for essential workers
        shift = Math.random() > 0.5 ? 'DAY' : 'NIGHT';
    }

    return {
        id: `col_${Math.random().toString(36).substr(2, 9)}`,
        name: isIllegal ? "Infiltrator" : NAMES[Math.floor(Math.random() * NAMES.length)],
        type: role,
        x, z,
        targetTileId: null,
        path: null,
        state: 'IDLE',
        energy: isIllegal ? 800 : 100,
        hunger: 100,
        mood: 80 + Math.random() * 20, // Start with good mood (80-100)
        skills: generateSkills(role),
        currentJobId: null,

        // New intelligence features
        personality: generatePersonality(role),
        memory: {
            knownBuildings: new Map(),
            favoriteSpots: [],
            recentlyVisited: [],
            friendIds: [],
            lastMealTile: null,
            lastSleepTile: null
        },
        experience: {
            buildingsConstructed: 0,
            resourcesMined: 0,
            plantsGrown: 0,
            totalWorkTicks: 0,
            // Skill progress (0-100)
            miningProgress: 0,
            constructionProgress: 0,
            plantsProgress: 0
        },
        workEfficiency: 1.0,
        moveSpeed: 0.9 + Math.random() * 0.2, // 0.9-1.1 individual variation

        // Shift system
        shift: isIllegal ? 'FLEXIBLE' : shift,
        consecutiveWorkTicks: 0,
        lastBreakTick: 0,

        // No active request initially
        activeRequest: undefined,
        lastAbandonedJobId: null
    };
}

// Helper: Find nearest tile of a certain building type (with memory caching)
function findNearestBuilding(agent: Agent, type: BuildingType, grid: GridTile[]): number | null {
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

// Helper: Smart Wander (avoids recently visited, prefers interesting spots)
function findWanderTarget(agent: Agent, grid: GridTile[]): number {
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

            if (!t.locked && t.buildingType !== BuildingType.POND) {
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

// ============================================================================
// SHIFT SYSTEM HELPERS
// ============================================================================

// Check if an agent is currently on their active shift
function isAgentOnShift(agent: Agent, isDaytime: boolean): boolean {
    const shift = agent.shift || 'FLEXIBLE';

    if (shift === 'FLEXIBLE') return true; // Always available
    if (shift === 'DAY' && isDaytime) return true;
    if (shift === 'NIGHT' && !isDaytime) return true;

    return false;
}

// ============================================================================
// SKILL LEVELING SYSTEM
// When an agent gains enough experience in a task, their skill improves
// ============================================================================

function updateSkillProgress(agent: Agent, skillType: 'mining' | 'construction' | 'plants', amount: number): void {
    if (!agent.experience) return;

    const progressKey = `${skillType}Progress` as keyof typeof agent.experience;
    const currentProgress = (agent.experience[progressKey] as number) || 0;
    const newProgress = currentProgress + amount;

    if (newProgress >= 100) {
        // Level up!
        agent.skills[skillType] = Math.min(10, agent.skills[skillType] + 1);
        (agent.experience[progressKey] as number) = newProgress - 100;

        // Mood boost from learning
        agent.mood = Math.min(100, agent.mood + 5);
    } else {
        (agent.experience[progressKey] as number) = newProgress;
    }
}

// ============================================================================
// AGENT REQUEST SYSTEM
// Agents can make requests when they're struggling
// ============================================================================

interface AgentRequestResult {
    type: 'NEED_BREAK' | 'WANT_FRIEND' | 'WANT_BETTER_FOOD' | 'WANT_BETTER_BED' | 'LOW_MORALE' | 'OVERWORKED';
    message: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

function checkForAgentRequest(agent: Agent, grid: GridTile[], tickCount: number): AgentRequestResult | null {
    // Don't spam requests - only check occasionally
    if (tickCount % 50 !== 0) return null;

    // Illegal miners don't make requests
    if (agent.type === 'ILLEGAL_MINER') return null;

    // Already has an active request
    if (agent.activeRequest && !agent.activeRequest.resolved) return null;

    const personality = agent.personality || { diligence: 0.5, sociability: 0.5, bravery: 0.5, patience: 0.5 };

    // Check for overworked (more than 200 consecutive work ticks without break)
    const workTicks = agent.consecutiveWorkTicks || 0;
    if (workTicks > 200 && Math.random() < 0.3) {
        return {
            type: 'OVERWORKED',
            message: `${agent.name} says: "I've been working non-stop. I need a break!"`,
            priority: 'HIGH'
        };
    }

    // Check for needing a break (low energy or patience ran out)
    if (agent.energy < 25 && Math.random() < 0.4) {
        const hasBed = findNearestBuilding(agent, BuildingType.STAFF_QUARTERS, grid) !== null;
        if (!hasBed) {
            return {
                type: 'WANT_BETTER_BED',
                message: `${agent.name} says: "There's nowhere for me to rest properly!"`,
                priority: 'MEDIUM'
            };
        }
        return {
            type: 'NEED_BREAK',
            message: `${agent.name} says: "I'm exhausted. I need some rest."`,
            priority: 'MEDIUM'
        };
    }

    // Check for wanting food
    if (agent.hunger < 25 && Math.random() < 0.4) {
        const hasFood = findNearestBuilding(agent, BuildingType.CANTEEN, grid) !== null;
        if (!hasFood) {
            return {
                type: 'WANT_BETTER_FOOD',
                message: `${agent.name} says: "We need a canteen! I'm starving."`,
                priority: 'HIGH'
            };
        }
    }

    // Check for loneliness (high sociability + low mood + no nearby friends)
    if (personality.sociability > 0.6 && agent.mood < 50 && Math.random() < 0.3) {
        const hasFriends = agent.memory?.friendIds.length && agent.memory.friendIds.length > 0;
        if (!hasFriends) {
            return {
                type: 'WANT_FRIEND',
                message: `${agent.name} says: "I feel lonely. I wish I had someone to talk to."`,
                priority: 'LOW'
            };
        }
    }

    // General low morale
    if (agent.mood < 20 && Math.random() < 0.3) {
        return {
            type: 'LOW_MORALE',
            message: `${agent.name} says: "I'm really unhappy. Something needs to change."`,
            priority: 'MEDIUM'
        };
    }

    return null;
}

// ============================================================================
// UTILITY AI SCORING SYSTEM
// Each possible action gets a score, agent picks the highest scoring action
// ============================================================================

interface ActionOption {
    type: 'SLEEP' | 'EAT' | 'WORK' | 'SOCIALIZE' | 'RELAX' | 'WANDER' | 'PATROL';
    targetTileId: number | null;
    jobId: string | null;
    score: number;
}

function calculateUtilityScores(agent: Agent, grid: GridTile[], jobs: readonly { id: string; type: string; targetTileId: number; priority: number; assignedAgentId: string | null }[], allAgents: Agent[]): ActionOption[] {
    const options: ActionOption[] = [];
    const currentTileIdx = Math.floor(agent.z) * GRID_SIZE + Math.floor(agent.x);
    const personality = agent.personality || { diligence: 0.5, sociability: 0.5, bravery: 0.5, patience: 0.5 };

    // Calculate need urgencies (0-1 scale, higher = more urgent)
    const energyUrgency = Math.max(0, (100 - agent.energy) / 100);
    const hungerUrgency = Math.max(0, (100 - agent.hunger) / 100);
    const moodUrgency = Math.max(0, (100 - agent.mood) / 100);

    // 1. SLEEP option
    const bedIdx = findNearestBuilding(agent, BuildingType.STAFF_QUARTERS, grid);
    const sleepScore = energyUrgency * 100 * (1 + (agent.energy < 30 ? 2 : 0)); // Critical boost if very tired
    options.push({
        type: 'SLEEP',
        targetTileId: bedIdx ?? currentTileIdx,
        jobId: 'sys_sleep',
        score: sleepScore
    });

    // 2. EAT option
    const foodIdx = findNearestBuilding(agent, BuildingType.CANTEEN, grid);
    const eatScore = hungerUrgency * 100 * (1 + (agent.hunger < 30 ? 2 : 0)); // Critical boost if starving
    options.push({
        type: 'EAT',
        targetTileId: foodIdx,
        jobId: 'sys_eat',
        score: eatScore
    });

    // 3. WORK options (for each available job)
    const availableJobs = jobs.filter(j => {
        if (j.type === 'MOVE') return false;
        // Shared building: Multiple agents can help build, but only one can MINE/FARM/REHAB
        if (j.type === 'BUILD') return true;
        return !j.assignedAgentId || j.assignedAgentId === agent.id;
    });

    for (const job of availableJobs) {
        let workScore = job.priority;

        // Distance penalty
        const dist = getDistance(currentTileIdx, job.targetTileId);
        workScore -= dist * 0.5;

        // Penalty for recently abandoned jobs (Anti-Stuck)
        if (agent.lastAbandonedJobId === job.id) {
            workScore -= 100; // Heavy penalty to prevent loops
        }

        // Skill bonus
        if (job.type === 'BUILD') {
            workScore += agent.skills.construction * 3;
            if (agent.type === 'ENGINEER') workScore += 20;
        } else if (job.type === 'MINE') {
            workScore += agent.skills.mining * 3;
            if (agent.type === 'MINER') workScore += 20;
        } else if (job.type === 'REHABILITATE' || job.type === 'FARM') {
            workScore += agent.skills.plants * 3;
            if (agent.type === 'BOTANIST') workScore += 20;
        }

        // Personality: Diligent agents love work
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

        let socialScore = moodUrgency * 50 * personality.sociability;
        if (agent.memory?.friendIds.includes(friend.id)) socialScore += 20; // Bonus for friends

        options.push({
            type: 'SOCIALIZE',
            targetTileId: friendIdx,
            jobId: `sys_social_${friend.id}`,
            score: socialScore
        });
    }

    // 5. RELAX option
    const funIdx = findNearestBuilding(agent, BuildingType.SOCIAL_HUB, grid);
    const relaxScore = moodUrgency * 40;
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

    // 7. WANDER (fallback, always available)
    const wanderScore = 5 + (1 - personality.diligence) * 15; // Lazy agents prefer wandering
    options.push({
        type: 'WANDER',
        targetTileId: findWanderTarget(agent, grid),
        jobId: null,
        score: wanderScore
    });

    // Sort by score descending
    return options.sort((a, b) => b.score - a.score);
}

// --- MAIN SIMULATION LOOP ---

export function updateSimulation(state: GameState): { state: GameState, effects: SimulationEffect[], news: NewsItem[] } {
    let nextAgents = [...state.agents];
    const grid = state.grid;
    let nextJobs = [...state.jobs];
    let mineralsDelta = 0;
    let ecoDelta = 0;
    let trustDelta = 0;
    const gridUpdates: GridTile[] = [];
    const effects: SimulationEffect[] = [];
    const newsQueue: NewsItem[] = [];

    // 1. GENERATE JOBS
    // ---------------------------------------------------------
    grid.forEach(tile => {
        // Construction Jobs
        if (tile.isUnderConstruction && (tile.structureHeadIndex === undefined || tile.id === tile.structureHeadIndex)) {
            const jobId = `build_${tile.id}`;
            if (!nextJobs.some(j => j.id === jobId)) {
                // HIGH PRIORITY: Construction jobs should be done ASAP
                nextJobs.push({ id: jobId, type: 'BUILD', targetTileId: tile.id, priority: 90, assignedAgentId: null });
            }
        }
    });

    // 2. AGENT LOOP
    // ---------------------------------------------------------
    const aliveAgents: Agent[] = [];

    nextAgents.forEach(agent => {
        let { x, z, state: aState, type: role, energy, hunger, mood, currentJobId, targetTileId, path } = agent;
        const isIllegal = role === 'ILLEGAL_MINER';
        const currentTileIdx = Math.floor(z) * GRID_SIZE + Math.floor(x);
        const currentTile = grid[currentTileIdx];

        // --- STAT DECAY ---
        const decayMod = isIllegal ? CONFIG.DECAY.ILLEGAL_MODIFIER : 1.0;
        energy = Math.max(0, energy - CONFIG.DECAY.ENERGY * decayMod);
        hunger = Math.max(0, hunger - CONFIG.DECAY.HUNGER * decayMod);
        mood = Math.max(0, mood - CONFIG.DECAY.MOOD * decayMod);

        // --- DEATH CHECK ---
        if (hunger <= 0 && !isIllegal) {
            if (currentJobId) nextJobs = nextJobs.map(j => j.id === currentJobId ? { ...j, assignedAgentId: null } : j);
            effects.push({ type: 'AUDIO', sfx: 'DEATH' });
            effects.push({ type: 'FX', fxType: 'DEATH', index: currentTileIdx });
            newsQueue.push({ id: `death_${agent.id}`, headline: `Casualty: ${agent.name} has starved.`, type: 'CRITICAL', timestamp: Date.now() });
            return; // Agent removed from aliveAgents
        }

        // --- STATE EVALUATION (THE BRAIN) ---
        // If we are performing a sustained action (sleeping, eating), check for completion
        let actionCompleted = false;

        if (aState === 'SLEEPING') {
            energy += 1.5;
            // Remember this sleep location
            if (agent.memory && targetTileId !== null) {
                agent.memory.lastSleepTile = targetTileId;
            }
            if (energy >= 100) { energy = 100; actionCompleted = true; }
        } else if (aState === 'EATING') {
            hunger += 2.0;
            // Remember this eating location
            if (agent.memory && targetTileId !== null) {
                agent.memory.lastMealTile = targetTileId;
            }
            if (hunger >= 100) { hunger = 100; actionCompleted = true; }
        } else if (aState === 'RELAXING') {
            mood += 1.0;
            if (mood >= 100) { mood = 100; actionCompleted = true; }
        } else if (aState === 'SOCIALIZING') {
            mood += 1.5; // Socializing is more mood-boosting

            // Build friendships - extract friend ID from job
            if (currentJobId?.startsWith('sys_social_') && agent.memory) {
                const friendId = currentJobId.replace('sys_social_', '');
                if (!agent.memory.friendIds.includes(friendId)) {
                    agent.memory.friendIds.push(friendId);
                    // Cap at 5 friends
                    if (agent.memory.friendIds.length > 5) {
                        agent.memory.friendIds.shift();
                    }
                }
            }

            if (mood >= 100) { mood = 100; actionCompleted = true; }
        } else if (aState === 'PATROLLING') {
            // Security patrol - slightly improves mood from sense of purpose
            mood = Math.min(100, mood + 0.2);
            // Patrol completes when reaching destination
            if (!path || path.length === 0) {
                actionCompleted = true;
            }
        } else if (aState === 'WORKING') {
            // Working logic handled below, but if job is gone, stop
            // IMPORTANT: BUILD jobs are handled separately and check tile state, not job list
            // This prevents agents from freezing when another agent removes the job from the list
            const isBuildJob = currentJobId?.startsWith('build_');
            if (!isBuildJob && (!currentJobId || !nextJobs.some(j => j.id === currentJobId))) actionCompleted = true;
        }

        // Interrupt logic or Completion logic
        if (actionCompleted || aState === 'IDLE' || (aState === 'MOVING' && path?.length === 0)) {
            // Reset to Decision Phase
            aState = 'IDLE';
            path = null;
            targetTileId = null;
            if (actionCompleted && currentJobId) {
                // If we finished a survival job (eat/sleep), clear it
                if (currentJobId.startsWith('sys_')) currentJobId = null;
            }
        }

        // INTERRUPT: Wandering agents should drop what they're doing for BUILD jobs
        // If agent is just wandering (no real job) and BUILD jobs exist, interrupt to go build
        if (!isIllegal && aState === 'MOVING' && !currentJobId) {
            const hasBuildJobs = nextJobs.some(j => j.type === 'BUILD');
            if (hasBuildJobs) {
                // Stop wandering, go to decision phase to pick up BUILD job
                aState = 'IDLE';
                path = null;
                targetTileId = null;
            }
        }

        // --- DECISION PHASE (UTILITY AI) ---
        if (aState === 'IDLE') {
            // Calculate work efficiency based on needs
            const efficiency = Math.max(0.5, Math.min(1.5,
                (agent.energy / 100) * 0.4 +
                (agent.hunger / 100) * 0.4 +
                (agent.mood / 100) * 0.2
            ));

            // Check for agent requests (struggling agents)
            const maybeRequest = checkForAgentRequest(agent, grid, state.tickCount);
            if (maybeRequest) {
                agent.activeRequest = {
                    id: `req_${agent.id}_${state.tickCount}`,
                    type: maybeRequest.type,
                    message: maybeRequest.message,
                    priority: maybeRequest.priority,
                    timestamp: Date.now(),
                    resolved: false
                };
                // Add to news feed if high priority
                if (maybeRequest.priority === 'HIGH') {
                    newsQueue.push({
                        id: `request_${agent.id}_${state.tickCount}`,
                        headline: maybeRequest.message,
                        type: 'CRITICAL',
                        timestamp: Date.now()
                    });
                }
            }

            // Check if agent is on their active shift
            const isDaytime = state.dayNightCycle?.isDaytime ?? true;
            const onShift = isAgentOnShift(agent, isDaytime);

            // Illegal miners have special behavior
            if (isIllegal) {
                const veins = grid.filter(t => t.foliage === 'GOLD_VEIN');
                if (veins.length > 0) {
                    const v = veins[Math.floor(Math.random() * veins.length)];
                    targetTileId = v.id;
                    currentJobId = `steal_${v.id}`;
                    aState = 'MOVING';
                } else {
                    targetTileId = findWanderTarget(agent, grid);
                    aState = 'MOVING';
                }
            }
            // OFF DUTY - agents should rest but they have "Work Focus"
            // If they are almost done with a building, they continue working
            const headIdx = currentJobId?.startsWith('build_') ? parseInt(currentJobId.replace('build_', '')) : null;
            const focusTile = headIdx !== null ? grid[headIdx] : null;
            const isAlmostDone = focusTile?.isUnderConstruction && (focusTile.constructionTimeLeft || 0) < 5;

            if (!onShift && !isAlmostDone) {
                // Standardized system IDs: sys_sleep, sys_eat, sys_social
                if (energy < 80) {
                    const bedIdx = findNearestBuilding(agent, BuildingType.STAFF_QUARTERS, grid);
                    if (bedIdx !== null) {
                        targetTileId = bedIdx;
                        currentJobId = 'sys_sleep';
                        aState = 'MOVING';
                    } else {
                        aState = 'SLEEPING';
                        currentJobId = 'sys_sleep';
                    }
                } else if (hunger < 80) {
                    const foodIdx = findNearestBuilding(agent, BuildingType.CANTEEN, grid);
                    if (foodIdx !== null) {
                        targetTileId = foodIdx;
                        currentJobId = 'sys_eat';
                        aState = 'MOVING';
                    } else {
                        targetTileId = findWanderTarget(agent, grid);
                        currentJobId = 'sys_wander';
                        aState = 'MOVING';
                    }
                } else {
                    const socialHub = findNearestBuilding(agent, BuildingType.SOCIAL_HUB, grid);
                    if (socialHub !== null && Math.random() > 0.5) {
                        targetTileId = socialHub;
                        currentJobId = 'sys_social';
                        aState = 'MOVING';
                    } else {
                        targetTileId = findWanderTarget(agent, grid);
                        currentJobId = 'sys_wander';
                        aState = 'MOVING';
                    }
                }
                agent.consecutiveWorkTicks = 0;
            }
            else {
                // ON SHIFT - Use Utility AI to pick the best action
                const options = calculateUtilityScores(
                    { ...agent, energy, hunger, mood },
                    grid,
                    nextJobs,
                    nextAgents
                );

                // Pick the best option (first in sorted list)
                const bestOption = options[0];

                if (bestOption) {
                    targetTileId = bestOption.targetTileId;
                    currentJobId = bestOption.jobId;

                    switch (bestOption.type) {
                        case 'SLEEP':
                            if (targetTileId) {
                                aState = 'MOVING';
                            } else {
                                // No bed, sleep on floor
                                aState = 'SLEEPING';
                            }
                            break;
                        case 'EAT':
                            if (targetTileId) {
                                aState = 'MOVING';
                            } else {
                                // No food, panic wander
                                targetTileId = findWanderTarget(agent, grid);
                                currentJobId = null;
                                aState = 'MOVING';
                            }
                            break;
                        case 'WORK':
                            // Assign job unconditionally (now including BUILD)
                            if (currentJobId) {
                                nextJobs = nextJobs.map(j => j.id === currentJobId ? { ...j, assignedAgentId: agent.id } : j);
                            }
                            aState = 'MOVING';
                            break;
                        case 'SOCIALIZE':
                            aState = 'MOVING';
                            break;
                        case 'RELAX':
                            if (targetTileId) {
                                aState = 'MOVING';
                            } else {
                                // No social hub, just relax in place
                                aState = 'RELAXING';
                            }
                            break;
                        case 'PATROL':
                            aState = 'MOVING';
                            break;
                        case 'WANDER':
                        default:
                            aState = 'MOVING';
                            break;
                    }
                }
            }

            // Update memory: track recently visited tiles
            if (agent.memory) {
                agent.memory.recentlyVisited = [currentTileIdx, ...agent.memory.recentlyVisited].slice(0, 5);
            }
        } else if (aState === 'IDLE' && currentJobId) {
            // Has job, but in IDLE state? Resume.
            const job = nextJobs.find(j => j.id === currentJobId);
            if (job) {
                targetTileId = job.targetTileId;
                aState = 'MOVING';
            } else {
                currentJobId = null; // Job invalidated
            }
        }

        // --- ACTION EXECUTION ---

        if (aState === 'MOVING') {
            // Pathfinding Logic
            if (targetTileId !== null) {
                const dist = getDistance(currentTileIdx, targetTileId);
                const isBuildJob = currentJobId?.startsWith('build_');
                const buildWorkDistance = 2;

                // Path recal/init
                if (!path || path.length === 0) {
                    if (isBuildJob && dist <= buildWorkDistance && dist > 0) {
                        path = [];
                        aState = 'WORKING';
                    } else if (dist > 0) {
                        path = findPath(currentTileIdx, targetTileId, grid);
                        if (!path) {
                            // Can't reach. For BUILD jobs, try working from current position if close
                            if (isBuildJob && dist <= buildWorkDistance + 1) {
                                path = [];
                                aState = 'WORKING';
                            } else {
                                // Abandon other jobs
                                if (currentJobId && !currentJobId.startsWith('sys_')) {
                                    nextJobs = nextJobs.map(j => j.id === currentJobId ? { ...j, assignedAgentId: null } : j);
                                }

                                // ANTI-STUCK: Mark this job as failed and Wander instead of IDLE
                                agent.lastAbandonedJobId = currentJobId;

                                // Force wander to change position
                                targetTileId = findWanderTarget(agent, grid);
                                currentJobId = 'sys_recovery_wander';
                                aState = 'MOVING';
                            }
                        }
                    } else {
                        // Arrived
                        path = [];
                        aState = 'WORKING';
                        agent.lastAbandonedJobId = null;

                        if (currentJobId === 'sys_sleep') aState = 'SLEEPING';
                        else if (currentJobId === 'sys_eat') aState = 'EATING';
                        else if (currentJobId === 'sys_social') aState = 'SOCIALIZING';
                        else if (currentJobId === 'sys_wander' || currentJobId === 'sys_recovery_wander') aState = 'IDLE';
                        else if (!currentJobId) aState = 'IDLE';
                    }
                }

                // Check mid-path if close enough for BUILD jobs
                if (path && path.length > 0 && isBuildJob && dist <= buildWorkDistance) {
                    path = [];
                    aState = 'WORKING';
                }

                // Follow Path
                if (path && path.length > 0 && aState === 'MOVING') {
                    const nextNode = path[0];
                    const nX = nextNode % GRID_SIZE;
                    const nY = Math.floor(nextNode / GRID_SIZE);
                    const dx = nX - x;
                    const dy = nY - z;
                    const distSq = dx * dx + dy * dy;

                    const speedMult = getTileCost(currentTile) === 0.5 ? 2.0 : (getTileCost(currentTile) === 2.0 ? 0.5 : 1.0);
                    const speed = CONFIG.SPEED.BASE * speedMult;

                    if (distSq < (speed * speed * 1.5)) {
                        // Snap and advance
                        x = nX;
                        z = nY;
                        path.shift();
                    } else {
                        // Move towards
                        const angle = Math.atan2(dy, dx);
                        x += Math.cos(angle) * speed;
                        z += Math.sin(angle) * speed;
                    }
                }
            } else {
                aState = 'IDLE';
            }
        }

        if (aState === 'WORKING') {
            // Process Job Progress
            if (currentJobId) {
                // For BUILD jobs, check directly if the building exists instead of relying on job list
                // This fixes the bug where multiple agents stop working when one agent's tick removes the job
                if (currentJobId.startsWith('build_')) {
                    // Extract tile ID from job ID
                    const buildTileId = parseInt(currentJobId.replace('build_', ''));
                    const tile = grid[buildTileId];

                    if (tile) {
                        // Find building head if this is part of a larger structure
                        const headIdx = tile.structureHeadIndex !== undefined ? tile.structureHeadIndex : tile.id;

                        // CRITICAL: Always read the LATEST grid state, not a cached snapshot
                        // Multiple agents may work on the same building in one tick, so we need
                        // to read the current constructionTimeLeft after other agents may have updated it
                        const headTile = grid[headIdx];

                        // Construct if still under construction
                        if (headTile && headTile.isUnderConstruction) {
                            // Re-read the current time left from the grid (may have been updated by other agents this tick)
                            const currentTimeLeft = grid[headIdx].constructionTimeLeft || 0;

                            // Each worker contributes based on their skill
                            const power = 0.2 + (agent.skills.construction * 0.05);
                            const timeLeft = Math.max(0, currentTimeLeft - power);

                            // Show construction dust particles (more workers = more particles)
                            if (Math.random() > 0.7) {
                                effects.push({ type: 'FX', fxType: 'DUST', index: headIdx });
                            }

                            // We need to update ALL tiles for this building to keep state sync
                            const def = BUILDINGS[headTile.buildingType];

                            // Defensive check: if building def is missing, treat it as 1x1
                            if (!def) {
                                console.warn(`Missing building definition for type: ${headTile.buildingType}`);
                            }

                            const w = def?.width || 1;
                            const d = def?.depth || 1;
                            const hx = headTile.x;
                            const hy = headTile.y;

                            for (let dz = 0; dz < d; dz++) {
                                for (let dx = 0; dx < w; dx++) {
                                    const tIdx = (hy + dz) * GRID_SIZE + (hx + dx);
                                    if (grid[tIdx]) {
                                        grid[tIdx] = { ...grid[tIdx], constructionTimeLeft: timeLeft, isUnderConstruction: timeLeft > 0 };
                                        gridUpdates.push(grid[tIdx]);
                                    }
                                }
                            }

                            // Track experience and consecutive work
                            if (agent.experience) {
                                agent.experience.totalWorkTicks++;
                            }
                            agent.consecutiveWorkTicks = (agent.consecutiveWorkTicks || 0) + 1;

                            // Skill progress - engineers learn faster
                            const skillGain = agent.type === 'ENGINEER' ? 2 : 1;
                            updateSkillProgress(agent, 'construction', skillGain);

                            if (timeLeft <= 0) {
                                // Job Done - remove the job from the list
                                effects.push({ type: 'AUDIO', sfx: 'BUILD' });
                                nextJobs = nextJobs.filter(j => j.id !== currentJobId);

                                // Completion Announcement
                                const bType = headTile.buildingType;
                                newsQueue.push({
                                    id: `finish_${headIdx}_${state.tickCount}`,
                                    headline: `${bType.replace(/_/g, ' ')} Construction Complete!`,
                                    type: 'POSITIVE',
                                    timestamp: Date.now()
                                });

                                // Track building completion experience
                                if (agent.experience) {
                                    agent.experience.buildingsConstructed++;
                                }

                                // Big skill boost on completion
                                updateSkillProgress(agent, 'construction', 10);

                                // Mood boost for completing work
                                mood = Math.min(100, mood + 10);
                                trustDelta += 5;

                                // Reset work counter after completing a job
                                agent.consecutiveWorkTicks = 0;

                                currentJobId = null;
                                aState = 'IDLE';
                            }
                        } else {
                            // Building already completed (by other workers) - go back to IDLE
                            currentJobId = null;
                            aState = 'IDLE';
                        }
                    } else {
                        // Tile doesn't exist - abandon
                        currentJobId = null;
                        aState = 'IDLE';
                    }
                }
                // Non-BUILD jobs use the standard job lookup
                else {
                    const job = nextJobs.find(j => j.id === currentJobId);
                    if (job) {
                        // Special logic for Illegal Stealing
                        if (isIllegal && currentJobId.startsWith('steal_')) {
                            mineralsDelta -= 0.05;
                            if (Math.random() > 0.9) effects.push({ type: 'FX', fxType: 'THEFT', index: currentTileIdx });
                            if (Math.random() > 0.95) { // Finished stealing
                                currentJobId = null;
                                aState = 'IDLE';
                            }
                        }
                        else if (job.type === 'REHABILITATE') {
                            const tile = grid[job.targetTileId];
                            // Work efficiency affects rehabilitation speed
                            const workEff = agent.workEfficiency || 1.0;
                            const power = (0.5 + (agent.skills.plants * 0.1)) * workEff;
                            const progress = Math.min(100, (tile.rehabProgress || 0) + power);
                            grid[tile.id] = { ...tile, rehabProgress: progress };
                            gridUpdates.push(grid[tile.id]);

                            if (Math.random() > 0.8) effects.push({ type: 'FX', fxType: 'ECO_REHAB', index: tile.id });

                            // Track experience
                            if (agent.experience) {
                                agent.experience.totalWorkTicks++;
                            }
                            agent.consecutiveWorkTicks = (agent.consecutiveWorkTicks || 0) + 1;

                            // Skill progress - botanists learn faster
                            const plantSkillGain = agent.type === 'BOTANIST' ? 2 : 1;
                            updateSkillProgress(agent, 'plants', plantSkillGain);

                            if (progress >= 100) {
                                grid[tile.id] = { ...tile, foliage: 'NONE', rehabProgress: undefined };
                                gridUpdates.push(grid[tile.id]);
                                ecoDelta += 5;
                                nextJobs = nextJobs.filter(j => j.id !== job.id);

                                // Track plant experience
                                if (agent.experience) {
                                    agent.experience.plantsGrown++;
                                }

                                // Big skill boost on completion
                                updateSkillProgress(agent, 'plants', 15);
                                agent.consecutiveWorkTicks = 0;

                                currentJobId = null;
                                aState = 'IDLE';
                            }
                        }
                        else if (job.type === 'MINE') {
                            // Manual mining command
                            const tile = grid[job.targetTileId];
                            // Work efficiency affects mining speed
                            const workEff = agent.workEfficiency || 1.0;
                            const p = ((agent.skills.mining / 40) + 0.15) * workEff;
                            const integrity = Math.max(0, (tile.integrity ?? 100) - p);
                            grid[tile.id] = { ...tile, integrity };
                            gridUpdates.push(grid[tile.id]);

                            mineralsDelta += tile.foliage === 'GOLD_VEIN' ? 0.15 : 0.05;
                            if (Math.random() > 0.85) effects.push({ type: 'FX', fxType: 'MINING', index: tile.id });

                            // Track experience and work
                            if (agent.experience) {
                                agent.experience.totalWorkTicks++;
                            }
                            agent.consecutiveWorkTicks = (agent.consecutiveWorkTicks || 0) + 1;

                            // Skill progress - miners learn faster
                            const miningSkillGain = agent.type === 'MINER' ? 2 : 1;
                            updateSkillProgress(agent, 'mining', miningSkillGain);

                            if (integrity <= 0) {
                                grid[tile.id] = { ...tile, foliage: tile.foliage === 'GOLD_VEIN' ? 'MINE_HOLE' : 'NONE' };
                                gridUpdates.push(grid[tile.id]);
                                nextJobs = nextJobs.filter(j => j.id !== job.id);

                                // Track mining experience
                                if (agent.experience) {
                                    agent.experience.resourcesMined++;
                                }

                                // Big skill boost on completion
                                updateSkillProgress(agent, 'mining', 15);
                                agent.consecutiveWorkTicks = 0;

                                currentJobId = null;
                                aState = 'IDLE';
                            }
                        }
                    } else {
                        // Job missing
                        currentJobId = null;
                        aState = 'IDLE';
                    }
                }
            } else {
                aState = 'IDLE';
            }
        }

        // Calculate updated work efficiency based on current stats
        const updatedWorkEfficiency = Math.max(0.5, Math.min(1.5,
            (energy / 100) * 0.4 +
            (hunger / 100) * 0.4 +
            (mood / 100) * 0.2
        ));

        // JOB RECONCILIATION: Ensure we release any jobs we are no longer working on
        // This fixes the issue where agents going off-duty would leave buildings locked
        nextJobs = nextJobs.map(j => {
            if (j.assignedAgentId === agent.id && j.id !== currentJobId) {
                return { ...j, assignedAgentId: null };
            }
            return j;
        });

        aliveAgents.push({
            ...agent,
            x, z,
            state: aState,
            energy, hunger, mood,
            currentJobId, targetTileId, path,
            workEfficiency: updatedWorkEfficiency,
            // Preserve and update memory/experience
            memory: agent.memory,
            experience: agent.experience,
            personality: agent.personality,
            // Preserve shift system data
            shift: agent.shift,
            consecutiveWorkTicks: agent.consecutiveWorkTicks,
            lastBreakTick: agent.lastBreakTick,
            activeRequest: agent.activeRequest
        });
    });

    // 3. SPAWN LOGIC (Recruitment)
    if (aliveAgents.filter(a => a.type !== 'ILLEGAL_MINER').length < MAX_AGENTS && state.tickCount % 1500 === 0) {
        const quarters = grid.filter(t => t.buildingType === BuildingType.STAFF_QUARTERS && !t.isUnderConstruction).length;
        const capacity = (quarters * CAPACITY_PER_QUARTERS) + 4;
        if (aliveAgents.length < capacity) {
            const spawnX = Math.floor(GRID_SIZE / 2);
            const spawnZ = Math.floor(GRID_SIZE / 2);
            aliveAgents.push(createColonist(spawnX, spawnZ));
            newsQueue.push({ id: `arr_${Date.now()}`, headline: "New colonist arrived.", type: 'POSITIVE', timestamp: Date.now() });
        }
    }

    // 4. BATCH GRID UPDATES
    if (gridUpdates.length > 0) {
        effects.push({ type: 'GRID_UPDATE', updates: gridUpdates });
    }

    const nextState: GameState = {
        ...state,
        grid, // Reference update
        agents: aliveAgents,
        jobs: nextJobs,
        tickCount: state.tickCount + 1,
        resources: {
            ...state.resources,
            minerals: Math.max(0, state.resources.minerals + mineralsDelta),
            eco: Math.min(100, state.resources.eco + ecoDelta),
            trust: Math.min(100, state.resources.trust + trustDelta)
        }
    };

    return { state: nextState, effects, news: newsQueue };
}
