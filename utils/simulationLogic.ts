
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
        BASE: 0.04,
        ROAD: 0.08,  // 2x speed on roads
        ROUGH: 0.02, // 0.5x speed on sand/snow
    },
    DECAY: {
        ENERGY: 0.04,
        HUNGER: 0.03,
        MOOD: 0.02,
        ILLEGAL_MODIFIER: 0.5, // Illegals are tougher
    },
    THRESHOLDS: {
        CRITICAL: 20, // Health risk
        LOW: 40,      // Seek fix
        HIGH: 90      // Stop fixing
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
    return Math.abs(ax - bx) + Math.abs(ay - by);
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
    const MAX_ITERATIONS = 200; // Aggressive limit for performance

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

        // Get Neighbors (4-way)
        const neighbors = [];
        if (cy > 0) neighbors.push(current - GRID_SIZE); // N
        if (cy < GRID_SIZE - 1) neighbors.push(current + GRID_SIZE); // S
        if (cx > 0) neighbors.push(current - 1); // W
        if (cx < GRID_SIZE - 1) neighbors.push(current + 1); // E

        for (const neighbor of neighbors) {
            const tile = grid[neighbor];
            // Walkable check
            if (tile.locked) continue;
            // Can't walk on water unless it's a bridge (future) or we are swimming (not implemented)
            if (tile.buildingType === BuildingType.POND && neighbor !== endIdx) continue;

            // Allow walking through construction sites, roads, empty tiles, and finished buildings (entering them)
            // Implicitly allowed.

            const moveCost = getTileCost(tile);
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

export function createColonist(x: number, z: number, role: AgentRole = 'WORKER'): Agent {
    return {
        id: `col_${Math.random().toString(36).substr(2, 9)}`,
        name: role === 'ILLEGAL_MINER' ? "Infiltrator" : NAMES[Math.floor(Math.random() * NAMES.length)],
        type: role,
        x, z,
        targetTileId: null,
        path: null,
        state: 'IDLE',
        energy: role === 'ILLEGAL_MINER' ? 800 : 100,
        hunger: 100,
        mood: 100,
        skills: {
            mining: Math.floor(Math.random() * 5) + 1,
            construction: Math.floor(Math.random() * 5) + 1,
            plants: Math.floor(Math.random() * 5) + 1,
            intelligence: Math.floor(Math.random() * 5) + 1,
        },
        currentJobId: null
    };
}

// Helper: Find nearest tile of a certain building type
function findNearestBuilding(agent: Agent, type: BuildingType, grid: GridTile[]): number | null {
    let nearestDist = Infinity;
    let nearestIdx = null;

    // Scan grid (Optimization: Maintain a cache of building locations in GameState for O(1) lookup in future)
    // For now, linear scan is acceptable for 45x45 grid.
    for (let i = 0; i < grid.length; i++) {
        if (grid[i].buildingType === type && !grid[i].isUnderConstruction) {
            const d = getDistance(Math.floor(agent.z) * GRID_SIZE + Math.floor(agent.x), i);
            if (d < nearestDist) {
                nearestDist = d;
                nearestIdx = i;
            }
        }
    }
    return nearestIdx;
}

// Helper: Smart Wander
function findWanderTarget(agent: Agent, grid: GridTile[]): number {
    const cx = Math.floor(agent.x);
    const cz = Math.floor(agent.z);

    let attempts = 0;
    while (attempts < 10) {
        attempts++;
        const rad = 8;
        const dx = Math.floor(Math.random() * (rad * 2 + 1)) - rad;
        const dy = Math.floor(Math.random() * (rad * 2 + 1)) - rad;

        const tx = cx + dx;
        const ty = cz + dy;

        if (tx >= 0 && tx < GRID_SIZE && ty >= 0 && ty < GRID_SIZE) {
            const idx = ty * GRID_SIZE + tx;
            const t = grid[idx];
            // Prefer roads for wandering
            if (!t.locked && t.buildingType !== BuildingType.POND) {
                return idx;
            }
        }
    }
    // Fallback: stay put
    return cz * GRID_SIZE + cx;
}

// --- MAIN SIMULATION LOOP ---

export function updateSimulation(state: GameState): { state: GameState, effects: SimulationEffect[], news: NewsItem[] } {
    let nextAgents = [...state.agents];
    const grid = state.grid;
    let nextJobs = [...state.jobs];
    let mineralsDelta = 0;
    let ecoDelta = 0;
    let trustDelta = 0;
    const gridUpdates: Map<number, GridTile> = new Map(); // Use Map for deduping updates
    const effects: SimulationEffect[] = [];
    const newsQueue: NewsItem[] = [];

    // 0. MAP AGENT TARGETS (For congestion control)
    // ---------------------------------------------------------
    const targetingCounts = new Map<number, number>();
    nextAgents.forEach(a => {
        if (a.targetTileId !== null && (a.state === 'MOVING' || a.state === 'WORKING' || a.currentJobId?.startsWith('auto_build_'))) {
            targetingCounts.set(a.targetTileId, (targetingCounts.get(a.targetTileId) || 0) + 1);
        }
    });

    // 1. PRE-CALCULATE CONSTRUCTION NEEDS & GOLD VEINS
    // ---------------------------------------------------------
    const constructionSites: number[] = [];
    const goldVeins: number[] = [];
    for (let i = 0; i < grid.length; i++) {
        const tile = grid[i];
        if (tile.isUnderConstruction && (tile.structureHeadIndex === undefined || tile.id === tile.structureHeadIndex)) {
            const currentWorkers = targetingCounts.get(i) || 0;
            if (currentWorkers < 5) {
                constructionSites.push(i);
            }
        }
        if (tile.foliage === 'GOLD_VEIN') {
            goldVeins.push(i);
        }
    }

    // Pre-cache key building locations to avoid repeated full scans
    const cachedBuildings = new Map<BuildingType, number[]>();
    [BuildingType.STAFF_QUARTERS, BuildingType.CANTEEN, BuildingType.SOCIAL_HUB].forEach(bType => {
        const locations: number[] = [];
        for (let i = 0; i < grid.length; i++) {
            if (grid[i].buildingType === bType && !grid[i].isUnderConstruction) {
                locations.push(i);
            }
        }
        cachedBuildings.set(bType, locations);
    });

    // Helper to find nearest from cache
    const findNearestCached = (agentTileIdx: number, bType: BuildingType): number | null => {
        const locs = cachedBuildings.get(bType);
        if (!locs || locs.length === 0) return null;
        let best = null;
        let bestD = Infinity;
        for (const loc of locs) {
            const d = getDistance(agentTileIdx, loc);
            if (d < bestD) { bestD = d; best = loc; }
        }
        return best;
    };

    // 2. AGENT LOOP
    // ---------------------------------------------------------
    const aliveAgents: Agent[] = [];

    nextAgents.forEach(agent => {
        // ... (Keep existing stats/decay logic) ...
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
        let actionCompleted = false;

        if (aState === 'SLEEPING') {
            energy += 1.5;
            if (energy >= 100) { energy = 100; actionCompleted = true; }
        } else if (aState === 'EATING') {
            hunger += 2.0;
            if (hunger >= 100) { hunger = 100; actionCompleted = true; }
        } else if (aState === 'RELAXING' || aState === 'SOCIALIZING') {
            mood += 1.0;
            if (mood >= 100) { mood = 100; actionCompleted = true; }
        } else if (aState === 'WORKING') {
            // Check if job is still valid
            if (currentJobId) {
                if (currentJobId.startsWith('auto_build_')) {
                    // Check if building is done
                    if (targetTileId !== null && !grid[targetTileId].isUnderConstruction) actionCompleted = true;
                } else if (!nextJobs.some(j => j.id === currentJobId)) {
                    actionCompleted = true;
                }
            } else {
                actionCompleted = true;
            }
        }

        // Interrupt logic or Completion logic
        if (actionCompleted || aState === 'IDLE' || (aState === 'MOVING' && path?.length === 0)) {
            // Reset to Decision Phase
            aState = 'IDLE';
            path = null;
            targetTileId = null;
            if (actionCompleted && currentJobId) {
                // If we finished a survival job (eat/sleep), clear it
                if (currentJobId.startsWith('sys_') || currentJobId.startsWith('auto_build_')) currentJobId = null;
            }
        }

        // --- DECISION PHASE ---
        if (aState === 'IDLE') {
            // 1. CRITICAL NEEDS
            if (!isIllegal && (energy < CONFIG.THRESHOLDS.CRITICAL || hunger < CONFIG.THRESHOLDS.CRITICAL)) {
                if (energy < hunger) {
                    // Sleep
                    const bedIdx = findNearestCached(currentTileIdx, BuildingType.STAFF_QUARTERS);
                    if (bedIdx) {
                        targetTileId = bedIdx;
                        currentJobId = 'sys_sleep';
                        aState = 'MOVING';
                    } else {
                        aState = 'SLEEPING';
                    }
                } else {
                    // Eat
                    const foodIdx = findNearestCached(currentTileIdx, BuildingType.CANTEEN);
                    if (foodIdx) {
                        targetTileId = foodIdx;
                        currentJobId = 'sys_eat';
                        aState = 'MOVING';
                    } else {
                        // Panic wander
                        targetTileId = findWanderTarget(agent, grid);
                        aState = 'MOVING';
                    }
                }
            }
            // 2. EXPLICIT JOBS (Manual commands or events)
            else if (!currentJobId && nextJobs.some(j => !j.assignedAgentId && j.type !== 'MOVE')) {
                const candidates = nextJobs.filter(j => !j.assignedAgentId && j.type !== 'MOVE');
                if (candidates.length > 0) {
                    candidates.sort((a, b) => b.priority - a.priority); // Priority only for manual jobs
                    const job = candidates[0];
                    nextJobs = nextJobs.map(j => j.id === job.id ? { ...j, assignedAgentId: agent.id } : j);
                    currentJobId = job.id;
                    targetTileId = job.targetTileId;
                    aState = 'MOVING';
                }
            }
            // 3. COLLABORATIVE BUILDING (New Logic: "Always looking to build")
            else if (!currentJobId && !isIllegal) {
                let bestSite = null;
                let minD = Infinity;

                // Use pre-calculated site list
                for (let i = 0; i < constructionSites.length; i++) {
                    const siteIdx = constructionSites[i];
                    const liveCount = targetingCounts.get(siteIdx) || 0;
                    if (liveCount < 5) {
                        const d = getDistance(currentTileIdx, siteIdx);
                        if (d < minD) {
                            minD = d;
                            bestSite = siteIdx;
                        }
                    }
                }

                if (bestSite !== null) {
                    targetTileId = bestSite;
                    currentJobId = `auto_build_${bestSite}`;
                    aState = 'MOVING';

                    targetingCounts.set(bestSite, (targetingCounts.get(bestSite) || 0) + 1);
                }

                // 4. SECONDARY NEEDS (if no building to do)
                else if (aState === 'IDLE' && mood < CONFIG.THRESHOLDS.LOW) {
                    const funIdx = findNearestCached(currentTileIdx, BuildingType.SOCIAL_HUB);
                    if (funIdx) {
                        targetTileId = funIdx;
                        currentJobId = 'sys_fun';
                        aState = 'MOVING';
                    } else {
                        // Seek friend
                        const friend = nextAgents.find(a => a.id !== agent.id && a.state === 'IDLE');
                        if (friend) {
                            targetTileId = Math.floor(friend.z) * GRID_SIZE + Math.floor(friend.x);
                            currentJobId = `sys_social_${friend.id}`;
                            aState = 'MOVING';
                        }
                    }
                }

                // 5. WANDER
                if (aState === 'IDLE') {
                    if (isIllegal && goldVeins.length > 0) {
                        // Use pre-cached veins
                        const vIdx = goldVeins[Math.floor(Math.random() * goldVeins.length)];
                        targetTileId = vIdx;
                        currentJobId = `steal_${vIdx}`;
                        aState = 'MOVING';
                    } else {
                        targetTileId = findWanderTarget(agent, grid);
                        aState = 'MOVING';
                    }
                }
            }
            else {
                // Has job, resume
                if (currentJobId?.startsWith('auto_build_')) {
                    aState = 'MOVING';
                } else if (!currentJobId) {
                    // Fallback check
                    if (aState === 'IDLE') {
                        targetTileId = findWanderTarget(agent, grid);
                        aState = 'MOVING';
                    }
                }
            }
        }

        // --- ACTION EXECUTION ---

        if (aState === 'MOVING') {
            // Pathfinding Logic (Identical to before)
            if (targetTileId !== null) {
                if (!path || path.length === 0) {
                    const dist = getDistance(currentTileIdx, targetTileId);
                    if (dist > 0) {
                        // SHORT DISTANCE: Direct movement (no A*)
                        if (dist <= 3) {
                            path = [targetTileId]; // Just go directly
                        } else {
                            path = findPath(currentTileIdx, targetTileId, grid);
                        }
                        if (!path) {
                            // Abandon
                            if (currentJobId && !currentJobId.startsWith('sys_') && !currentJobId.startsWith('auto_build_')) {
                                nextJobs = nextJobs.map(j => j.id === currentJobId ? { ...j, assignedAgentId: null } : j);
                            }
                            currentJobId = null;
                            targetTileId = null;
                            aState = 'IDLE';
                        }
                    } else {
                        // Arrived
                        path = [];
                        aState = 'WORKING';

                        if (currentJobId === 'sys_sleep') aState = 'SLEEPING';
                        else if (currentJobId === 'sys_eat') aState = 'EATING';
                        else if (currentJobId === 'sys_fun') aState = 'RELAXING';
                        else if (currentJobId?.startsWith('sys_social')) aState = 'SOCIALIZING';
                        else if (!currentJobId) aState = 'IDLE';
                    }
                }

                // Move along path
                if (path && path.length > 0) {
                    // ... (Movement Physics) ...
                    const nextNode = path[0];
                    const nX = nextNode % GRID_SIZE;
                    const nY = Math.floor(nextNode / GRID_SIZE);
                    const dx = nX - x;
                    const dy = nY - z;
                    const distSq = dx * dx + dy * dy;

                    const speedMult = getTileCost(currentTile) === 0.5 ? 2.0 : (getTileCost(currentTile) === 2.0 ? 0.5 : 1.0);
                    const speed = CONFIG.SPEED.BASE * speedMult;

                    if (distSq < (speed * speed * 1.5)) {
                        x = nX;
                        z = nY;
                        path.shift();
                    } else {
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
                if (currentJobId.startsWith('auto_build_')) {
                    // COLLABORATIVE BUILD LOGIC
                    if (targetTileId !== null) {
                        const headTile = grid[targetTileId]; // targetTileId is guaranteed to be head for auto_build
                        if (headTile && headTile.isUnderConstruction) {
                            const power = 0.2 + (agent.skills.construction * 0.05);
                            const timeLeft = Math.max(0, (headTile.constructionTimeLeft || 0) - power);

                            // Batch updates
                            const def = BUILDINGS[headTile.buildingType];
                            const w = def.width || 1;
                            const d = def.depth || 1;
                            const hx = headTile.x;
                            const hy = headTile.y;

                            for (let dz = 0; dz < d; dz++) {
                                for (let dx = 0; dx < w; dx++) {
                                    const tIdx = (hy + dz) * GRID_SIZE + (hx + dx);
                                    if (grid[tIdx]) {
                                        const newTile = { ...grid[tIdx], constructionTimeLeft: timeLeft, isUnderConstruction: timeLeft > 0 };
                                        grid[tIdx] = newTile;
                                        gridUpdates.set(tIdx, newTile);
                                    }
                                }
                            }

                            if (timeLeft <= 0) {
                                effects.push({ type: 'AUDIO', sfx: 'BUILD' });
                                currentJobId = null;
                                aState = 'IDLE';
                            }
                        } else {
                            // Done or invalid
                            currentJobId = null;
                            aState = 'IDLE';
                        }
                    }
                }
                else {
                    // STANDARD JOB LOGIC (Keep existing manual jobs)
                    const job = nextJobs.find(j => j.id === currentJobId);
                    if (job) {
                        if (isIllegal && currentJobId.startsWith('steal_')) {
                            // ... (Keep Steal Logic) ...
                            mineralsDelta -= 0.05;
                            if (Math.random() > 0.9) effects.push({ type: 'FX', fxType: 'THEFT', index: currentTileIdx });
                            if (Math.random() > 0.95) {
                                currentJobId = null;
                                aState = 'IDLE';
                            }
                        }
                        else if (job.type === 'REHABILITATE') {
                            // ... (Keep Rehab Logic) ...
                            const tile = grid[job.targetTileId];
                            const power = 0.5 + (agent.skills.plants * 0.1);
                            const progress = Math.min(100, (tile.rehabProgress || 0) + power);
                            const newTile = { ...tile, rehabProgress: progress };
                            grid[tile.id] = newTile;
                            gridUpdates.set(tile.id, newTile);

                            if (Math.random() > 0.8) effects.push({ type: 'FX', fxType: 'ECO_REHAB', index: tile.id });

                            if (progress >= 100) {
                                const finishedTile: GridTile = { ...newTile, foliage: 'NONE', rehabProgress: undefined };
                                grid[tile.id] = finishedTile;
                                gridUpdates.set(tile.id, finishedTile);
                                ecoDelta += 5;
                                nextJobs = nextJobs.filter(j => j.id !== job.id);
                                currentJobId = null;
                                aState = 'IDLE';
                            }
                        }
                        else if (job.type === 'MINE') {
                            // ... (Keep Manual Mine Logic) ...
                            const tile = grid[job.targetTileId];
                            const p = (agent.skills.mining / 40) + 0.15;
                            const integrity = Math.max(0, (tile.integrity ?? 100) - p);
                            const newTile = { ...tile, integrity };
                            grid[tile.id] = newTile;
                            gridUpdates.set(tile.id, newTile);

                            mineralsDelta += tile.foliage === 'GOLD_VEIN' ? 0.15 : 0.05;
                            if (Math.random() > 0.85) effects.push({ type: 'FX', fxType: 'MINING', index: tile.id });

                            if (integrity <= 0) {
                                const finishedTile: GridTile = { ...newTile, foliage: (tile.foliage === 'GOLD_VEIN' ? 'MINE_HOLE' : 'NONE') as any };
                                grid[tile.id] = finishedTile;
                                gridUpdates.set(tile.id, finishedTile);
                                nextJobs = nextJobs.filter(j => j.id !== job.id);
                                currentJobId = null;
                                aState = 'IDLE';
                            }
                        }
                    } else {
                        currentJobId = null;
                        aState = 'IDLE';
                    }
                }
            } else {
                aState = 'IDLE';
            }
        }

        aliveAgents.push({
            ...agent,
            x, z,
            state: aState,
            energy, hunger, mood,
            currentJobId, targetTileId, path
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
    if (gridUpdates.size > 0) {
        effects.push({ type: 'GRID_UPDATE', updates: Array.from(gridUpdates.values()) });
    }

    const nextState: GameState = {
        ...state,
        grid, // Reference update (mutated in place for simplicity in this tight loop, but signaled via effects)
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
