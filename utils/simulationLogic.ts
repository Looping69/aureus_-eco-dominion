
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
                nextJobs.push({ id: jobId, type: 'BUILD', targetTileId: tile.id, priority: 80, assignedAgentId: null });
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
            if (energy >= 100) { energy = 100; actionCompleted = true; }
        } else if (aState === 'EATING') {
            hunger += 2.0;
            if (hunger >= 100) { hunger = 100; actionCompleted = true; }
        } else if (aState === 'RELAXING' || aState === 'SOCIALIZING') {
            mood += 1.0;
            if (mood >= 100) { mood = 100; actionCompleted = true; }
        } else if (aState === 'WORKING') {
            // Working logic handled below, but if job is gone, stop
            if (!currentJobId || !nextJobs.some(j => j.id === currentJobId)) actionCompleted = true;
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

        // --- DECISION PHASE ---
        if (aState === 'IDLE') {
            // 1. CRITICAL NEEDS
            if (!isIllegal && (energy < CONFIG.THRESHOLDS.CRITICAL || hunger < CONFIG.THRESHOLDS.CRITICAL)) {
                if (energy < hunger) {
                    // Sleep
                    const bedIdx = findNearestBuilding(agent, BuildingType.STAFF_QUARTERS, grid);
                    if (bedIdx) {
                        targetTileId = bedIdx;
                        currentJobId = 'sys_sleep';
                        aState = 'MOVING';
                    } else {
                        // Sleep on floor if no bed
                        aState = 'SLEEPING';
                    }
                } else {
                    // Eat
                    const foodIdx = findNearestBuilding(agent, BuildingType.CANTEEN, grid);
                    if (foodIdx) {
                        targetTileId = foodIdx;
                        currentJobId = 'sys_eat';
                        aState = 'MOVING';
                    } else {
                        // Can't find food, panic wander
                        targetTileId = findWanderTarget(agent, grid);
                        aState = 'MOVING';
                    }
                }
            }
            // 2. WORK
            else if (!currentJobId) {
                // Look for jobs
                // Filter jobs that are not assigned
                const candidates = nextJobs.filter(j => !j.assignedAgentId && j.type !== 'MOVE'); // MOVE is manual command

                if (candidates.length > 0) {
                    // Sort by priority then distance
                    candidates.sort((a, b) => {
                        if (a.priority !== b.priority) return b.priority - a.priority;
                        const distA = getDistance(currentTileIdx, a.targetTileId);
                        const distB = getDistance(currentTileIdx, b.targetTileId);
                        return distA - distB;
                    });

                    // Assign best job
                    const job = candidates[0];
                    // Mutate jobs array to assign
                    nextJobs = nextJobs.map(j => j.id === job.id ? { ...j, assignedAgentId: agent.id } : j);

                    currentJobId = job.id;
                    targetTileId = job.targetTileId;
                    aState = 'MOVING';
                }
                // 3. SECONDARY NEEDS (Mood)
                else if (!isIllegal && mood < CONFIG.THRESHOLDS.LOW) {
                    const funIdx = findNearestBuilding(agent, BuildingType.SOCIAL_HUB, grid);
                    if (funIdx) {
                        targetTileId = funIdx;
                        currentJobId = 'sys_fun';
                        aState = 'MOVING';
                    } else {
                        // Seek friend?
                        const friend = nextAgents.find(a => a.id !== agent.id && a.state === 'IDLE' && getDistance(currentTileIdx, Math.floor(a.z) * GRID_SIZE + Math.floor(a.x)) < 10);
                        if (friend) {
                            targetTileId = Math.floor(friend.z) * GRID_SIZE + Math.floor(friend.x);
                            currentJobId = `sys_social_${friend.id}`;
                            aState = 'MOVING';
                        } else {
                            targetTileId = findWanderTarget(agent, grid);
                            aState = 'MOVING';
                        }
                    }
                }
                // 4. WANDER / PATROL
                else {
                    // Illegal miners steal
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
                    } else {
                        // Civilians wander to roads/amenities
                        targetTileId = findWanderTarget(agent, grid);
                        aState = 'MOVING';
                    }
                }
            } else {
                // Has job, but in IDLE state? Resume.
                const job = nextJobs.find(j => j.id === currentJobId);
                if (job) {
                    targetTileId = job.targetTileId;
                    aState = 'MOVING';
                } else {
                    currentJobId = null; // Job invalidated
                }
            }
        }

        // --- ACTION EXECUTION ---

        if (aState === 'MOVING') {
            // Pathfinding Logic
            if (targetTileId !== null) {
                // If no path or path invalid or finished
                if (!path || path.length === 0) {
                    // Only recalc if distant
                    const dist = getDistance(currentTileIdx, targetTileId);
                    if (dist > 0) {
                        path = findPath(currentTileIdx, targetTileId, grid);
                        if (!path) {
                            // Can't reach. Abandon.
                            if (currentJobId && !currentJobId.startsWith('sys_')) {
                                nextJobs = nextJobs.map(j => j.id === currentJobId ? { ...j, assignedAgentId: null } : j);
                            }
                            currentJobId = null;
                            targetTileId = null;
                            aState = 'IDLE';
                        }
                    } else {
                        // Arrived
                        path = [];
                        aState = 'WORKING'; // Assume work, transition below will fix if it's eating/sleeping

                        // Convert ARRIVAL to ACTION
                        if (currentJobId === 'sys_sleep') aState = 'SLEEPING';
                        else if (currentJobId === 'sys_eat') aState = 'EATING';
                        else if (currentJobId === 'sys_fun') aState = 'RELAXING';
                        else if (currentJobId?.startsWith('sys_social')) aState = 'SOCIALIZING';
                        else if (!currentJobId) aState = 'IDLE'; // Just wandering
                    }
                }

                // Follow Path
                if (path && path.length > 0) {
                    const nextNode = path[0];
                    // Check if we reached the next node (simple radius check)
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
                    // Standard Jobs
                    else if (job.type === 'BUILD') {
                        const tile = grid[job.targetTileId];
                        // Find building head if this is part of a larger structure
                        const headIdx = tile.structureHeadIndex !== undefined ? tile.structureHeadIndex : tile.id;
                        const headTile = grid[headIdx];

                        // Construct
                        if (headTile.isUnderConstruction) {
                            const power = 0.2 + (agent.skills.construction * 0.05);
                            const timeLeft = Math.max(0, (headTile.constructionTimeLeft || 0) - power);

                            // We need to update ALL tiles for this building to keep state sync
                            const def = BUILDINGS[headTile.buildingType];
                            const w = def.width || 1;
                            const d = def.depth || 1;
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

                            if (timeLeft <= 0) {
                                // Job Done
                                effects.push({ type: 'AUDIO', sfx: 'BUILD' });
                                nextJobs = nextJobs.filter(j => j.id !== job.id);
                                currentJobId = null;
                                aState = 'IDLE';
                            }
                        } else {
                            // Already done?
                            nextJobs = nextJobs.filter(j => j.id !== job.id);
                            currentJobId = null;
                            aState = 'IDLE';
                        }
                    }
                    else if (job.type === 'REHABILITATE') {
                        const tile = grid[job.targetTileId];
                        const power = 0.5 + (agent.skills.plants * 0.1);
                        const progress = Math.min(100, (tile.rehabProgress || 0) + power);
                        grid[tile.id] = { ...tile, rehabProgress: progress };
                        gridUpdates.push(grid[tile.id]);

                        if (Math.random() > 0.8) effects.push({ type: 'FX', fxType: 'ECO_REHAB', index: tile.id });

                        if (progress >= 100) {
                            grid[tile.id] = { ...tile, foliage: 'NONE', rehabProgress: undefined };
                            gridUpdates.push(grid[tile.id]);
                            ecoDelta += 5;
                            nextJobs = nextJobs.filter(j => j.id !== job.id);
                            currentJobId = null;
                            aState = 'IDLE';
                        }
                    }
                    else if (job.type === 'MINE') {
                        // Manual mining command
                        const tile = grid[job.targetTileId];
                        const p = (agent.skills.mining / 40) + 0.15;
                        const integrity = Math.max(0, (tile.integrity ?? 100) - p);
                        grid[tile.id] = { ...tile, integrity };
                        gridUpdates.push(grid[tile.id]);

                        mineralsDelta += tile.foliage === 'GOLD_VEIN' ? 0.15 : 0.05;
                        if (Math.random() > 0.85) effects.push({ type: 'FX', fxType: 'MINING', index: tile.id });

                        if (integrity <= 0) {
                            grid[tile.id] = { ...tile, foliage: tile.foliage === 'GOLD_VEIN' ? 'MINE_HOLE' : 'NONE' };
                            gridUpdates.push(grid[tile.id]);
                            nextJobs = nextJobs.filter(j => j.id !== job.id);
                            currentJobId = null;
                            aState = 'IDLE';
                        }
                    }
                } else {
                    // Job missing
                    currentJobId = null;
                    aState = 'IDLE';
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
