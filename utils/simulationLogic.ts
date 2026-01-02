
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


const NAMES = ["Cass", "Jax", "Val", "Rya", "Kael", "Nyx", "Zane", "Mira", "Leo", "Sora", "Elara", "Teron", "Muna", "Vael", "Koda", "Orin", "Tali", "Vex"];

// --- TYPES & INTERFACES ---

interface Point { x: number; y: number; }


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
        visualX: x,
        visualZ: z,
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

// ============================================================================
// AI HELPERS -- DEPRECATED (Moved to AgentAI.ts / AgentSystem.ts)
// ============================================================================

// Keeping updateSimulation for GameReducer bridge


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
    // Scan grid periodically (every ~0.6s / 3 ticks) to save perf
    if (state.tickCount % 3 === 0) {
        for (let i = 0; i < grid.length; i++) {
            const tile = grid[i];
            if (tile.isUnderConstruction && (tile.structureHeadIndex === undefined || tile.id === tile.structureHeadIndex)) {
                const jobId = `build_${tile.id}`;
                // Check if job exists
                let exists = false;
                for (let j = 0; j < nextJobs.length; j++) {
                    if (nextJobs[j].id === jobId) {
                        exists = true;
                        break;
                    }
                }

                if (!exists) {
                    nextJobs.push({
                        id: jobId,
                        type: 'BUILD',
                        targetTileId: tile.id,
                        priority: 90,
                        assignedAgentId: null
                    });
                }
            }
        }
    }

    // 2. AGENT LOOP (LEGACY - Disabled, moved to AgentSystem.ts)
    // ---------------------------------------------------------
    const aliveAgents: Agent[] = [...nextAgents];



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
