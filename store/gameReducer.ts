
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GameState, GameStep, BuildingType, Action, Goal, GridTile, Job, JobType, SimulationEffect } from '../types';
import { BUILDINGS, INITIAL_RESOURCES, TECHNOLOGIES } from '../utils/voxelConstants';
import { generateInitialGrid, getEcoMultiplier, updateWaterConnectivity, GRID_SIZE } from '../utils/gameUtils';
import { generateGoal, checkAndGenerateEvent } from '../utils/aiLogic';
import { updateSimulation, createColonist } from '../utils/simulationLogic';

export const initialState: GameState = {
    resources: { ...INITIAL_RESOURCES, agt: 1200 }, // Reduced from 2500
    grid: generateInitialGrid(),
    agents: [
        createColonist(GRID_SIZE / 2, GRID_SIZE / 2),
        createColonist(GRID_SIZE / 2 + 1, GRID_SIZE / 2),
        createColonist(GRID_SIZE / 2, GRID_SIZE / 2 + 1)
    ],
    jobs: [],
    inventory: {},
    selectedBuilding: null,
    selectedAgentId: null,
    interactionMode: 'INSPECT',
    step: GameStep.INTRO,
    tickCount: 0,
    viewMode: 'SURFACE',
    logistics: {
        autoSell: false,
        sellThreshold: 50
    },
    activeGoal: null,
    newsFeed: [{ id: 'init', headline: "Welcome to Aureus Prime. Colony system online.", type: 'NEUTRAL', timestamp: Date.now() }],
    activeEvents: [],
    research: {
        unlocked: []
    },
    debugMode: false,
    cheatsEnabled: false,
    pendingEffects: [],
    // Galactic Trade System Init
    market: {
        minerals: { basePrice: 15, currentPrice: 15, trend: 'STABLE', history: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15], volatility: 0.5 },
        gems: { basePrice: 80, currentPrice: 80, trend: 'STABLE', history: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80], volatility: 2.0 },
        eventDuration: 0
    },
    contracts: [
        {
            id: 'contract_init',
            description: "Startup: Local Authority requests 50 Minerals.",
            resource: 'MINERALS',
            amount: 50,
            reward: 1200, // Good starter boost
            timeLeft: 300, // 5 minutes
            penalty: 0
        }
    ],
    weather: {
        current: 'CLEAR',
        timeLeft: 0,
        intensity: 0
    }
};

// Helper to diff pipe updates
function diffWaterUpdates(oldGrid: GridTile[], newGrid: GridTile[]): SimulationEffect | null {
    const updates: GridTile[] = [];
    newGrid.forEach((tile, i) => {
        if (tile.waterStatus !== oldGrid[i].waterStatus) {
            updates.push(tile);
        }
    });
    if (updates.length > 0) {
        return { type: 'GRID_UPDATE', updates };
    }
    return null;
}

// Fog of War Logic
function updateExploration(grid: GridTile[], agents: any[], radius: number = 3): GridTile[] {
    let changed = false;
    const newGrid = [...grid];

    const reveal = (idx: number) => {
        if (newGrid[idx] && !newGrid[idx].explored) {
            newGrid[idx] = { ...newGrid[idx], explored: true };
            changed = true;
        }
    };

    agents.forEach(a => {
        const cx = Math.floor(a.x);
        const cy = Math.floor(a.z);
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tx = cx + dx;
                const ty = cy + dy;
                if (tx >= 0 && tx < GRID_SIZE && ty >= 0 && ty < GRID_SIZE) {
                    // Circular mask
                    if (dx * dx + dy * dy <= radius * radius) {
                        reveal(ty * GRID_SIZE + tx);
                    }
                }
            }
        }
    });

    return changed ? newGrid : grid;
}

export function gameReducer(state: GameState, action: Action): GameState {
    // Clear effects from previous tick/action to avoid duplication if consumer has processed them
    const baseState = { ...state, pendingEffects: [] };

    switch (action.type) {
        case 'TICK': {
            if (baseState.step === GameStep.GAME_OVER) return baseState;

            const { state: nextState, effects, news } = updateSimulation(baseState);

            let finalState = { ...nextState, pendingEffects: [...effects] };

            finalState.newsFeed = [...finalState.newsFeed, ...news];

            // -------------------------------------------------------------
            // MARKET SIMULATION (Every 10 Ticks = 2 seconds)
            // -------------------------------------------------------------
            let market = finalState.market;
            if (finalState.tickCount % 10 === 0) {
                const fluctuate = (m: any) => {
                    const change = (Math.random() - 0.5) * m.volatility + (m.trend === 'RISING' ? 1.5 : m.trend === 'FALLING' ? -1.5 : 0);
                    let newPrice = Math.max(1, Math.min(m.basePrice * 3, m.currentPrice + change));
                    newPrice = Math.round(newPrice * 10) / 10;

                    const history = [...m.history.slice(1), newPrice];
                    return { ...m, currentPrice: newPrice, history };
                };

                // Random trend shift
                const updateTrend = (m: any) => {
                    if (Math.random() < 0.05) { // 5% chance to change trend
                        const r = Math.random();
                        if (r < 0.3) return 'STABLE';
                        if (r < 0.6) return 'RISING';
                        return 'FALLING';
                    }
                    return m.trend;
                };

                market = {
                    ...market,
                    minerals: { ...fluctuate(market.minerals), trend: updateTrend(market.minerals) },
                    gems: { ...fluctuate(market.gems), trend: updateTrend(market.gems) }
                };
            }
            finalState.market = market;

            // Exploration Update (Periodic optimization)
            if (finalState.tickCount % 5 === 0) {
                const newGrid = updateExploration(finalState.grid, finalState.agents);
                if (newGrid !== finalState.grid) {
                    finalState.grid = newGrid;
                }
            }

            if (finalState.tickCount % 20 === 0) {
                const newGrid = updateWaterConnectivity(finalState.grid);
                const waterDiff = diffWaterUpdates(finalState.grid, newGrid);
                if (waterDiff) finalState.pendingEffects.push(waterDiff);
                finalState.grid = newGrid;
            }

            if (!finalState.activeGoal && finalState.tickCount % 500 === 0) {
                finalState.activeGoal = generateGoal(finalState);
            }

            if (finalState.tickCount % 1000 === 0) {
                const { event, news, newGrid, newAgents } = checkAndGenerateEvent(finalState);
                if (event) finalState.activeEvents.push(event);
                if (news) finalState.newsFeed.push(news);
                if (newGrid) {
                    const updates: GridTile[] = [];
                    newGrid.forEach((t, i) => { if (t !== finalState.grid[i]) updates.push(t); });
                    if (updates.length) finalState.pendingEffects.push({ type: 'GRID_UPDATE', updates });
                    finalState.grid = updateWaterConnectivity(newGrid);
                }
                if (newAgents) finalState.agents = newAgents;
                if (newAgents) finalState.agents = newAgents;
            }

            // ----------------------------------------------------------------
            // CONTRACT GENERATION (Every ~60 seconds = 300 ticks)
            // ----------------------------------------------------------------
            if (finalState.tickCount % 300 === 0 && finalState.contracts.length < 3) {
                const isGem = Math.random() > 0.7;
                const baseAmt = isGem ? 50 : 200;
                const amount = Math.floor(baseAmt * (1 + Math.random()));
                const rewardMult = 1.3 + (Math.random() * 0.5); // 1.3x to 1.8x market price benefit

                const newContract: Contract = {
                    id: `contract_${Date.now()}`,
                    description: isGem
                        ? `Urgent: Jewelry Corp needs ${amount} Gems for luxury production.`
                        : `Logistics: Construction firm requires ${amount} tons of Minerals.`,
                    resource: isGem ? 'GEMS' : 'MINERALS',
                    amount,
                    reward: Math.floor(amount * (isGem ? finalState.market.gems.currentPrice : finalState.market.minerals.currentPrice) * rewardMult),
                    timeLeft: 120, // 2 minutes to accept/complete
                    penalty: 10 // Trust hit
                };
                finalState.contracts = [...finalState.contracts, newContract];
                finalState.pendingEffects.push({ type: 'AUDIO', sfx: 'UI_CLICK' }); // Notification sound
                finalState.newsFeed.push({
                    id: `news_${Date.now()}`,
                    headline: "NEW CONTRACT AVAILABLE: Check Global Exchange.",
                    type: 'GOOD',
                    timestamp: Date.now()
                });
            }

            // ----------------------------------------------------------------
            // CONTRACT TIMERS (Every second = 5 ticks)
            // ----------------------------------------------------------------
            if (finalState.tickCount % 5 === 0) {
                finalState.contracts = finalState.contracts.map(c => ({ ...c, timeLeft: c.timeLeft - 1 }));
                const failed = finalState.contracts.filter(c => c.timeLeft <= 0);
                if (failed.length > 0) {
                    finalState.resources.trust = Math.max(0, finalState.resources.trust - (failed.length * 5));
                    finalState.newsFeed.push({ id: `fail_${Date.now()}`, headline: "CONTRACT EXPIRED: Trust Penalty Applied.", type: 'BAD', timestamp: Date.now() });
                }
                finalState.contracts = finalState.contracts.filter(c => c.timeLeft > 0);
            }


            // ----------------------------------------------------------------
            // WEATHER SYSTEM (Check every 10 seconds = 50 ticks)
            // ----------------------------------------------------------------
            if (finalState.weather.timeLeft > 0) {
                finalState.weather.timeLeft--;
                // Weather Effects applied below in maintenance stats
            } else if (finalState.tickCount % 50 === 0) {
                const eco = finalState.resources.eco;
                const roll = Math.random();

                // Acid Rain: Only if Eco < 60. Chance increases as Eco drops.
                // Max 10% chance at 0 Eco.
                const acidChance = eco < 60 ? (60 - eco) / 600 : 0;

                // Dust Storm: Constant 2% chance
                const dustChance = 0.02;

                if (roll < acidChance) {
                    finalState.weather = { current: 'ACID_RAIN', timeLeft: 300, intensity: 1 }; // 60s duration
                    finalState.newsFeed.push({ id: `w_${Date.now()}`, headline: "WARNING: ACID RAIN DETECTED. Shelter recommended.", type: 'BAD', timestamp: Date.now() });
                    finalState.pendingEffects.push({ type: 'AUDIO', sfx: 'ALARM' });
                } else if (roll < acidChance + dustChance) {
                    finalState.weather = { current: 'DUST_STORM', timeLeft: 200, intensity: 0.8 }; // 40s duration
                    finalState.newsFeed.push({ id: `w_${Date.now()}`, headline: "ALERT: DUST STORM APPROACHING. Systems efficiency dropping.", type: 'NEUTRAL', timestamp: Date.now() });
                } else {
                    finalState.weather = { current: 'CLEAR', timeLeft: 0, intensity: 0 };
                }
            }

            // Game Over Check (Disabled if cheats enabled)
            if (finalState.resources.eco <= 0 && finalState.tickCount > 100 && !state.cheatsEnabled) {
                return { ...finalState, step: GameStep.GAME_OVER };
            }

            let activeEvents = finalState.activeEvents
                .map(e => ({ ...e, duration: e.duration - 1 }))
                .filter(e => e.duration > 0);

            const modifiers = { production: 1, sellPrice: 1, ecoRegen: 1, trustGain: 1, pollution: 1, upkeep: 1 };

            // Apply Weather Modifiers
            if (finalState.weather.current === 'DUST_STORM') {
                modifiers.upkeep *= 1.5; // Sand damages machinery
                modifiers.production *= 0.7; // Efficiency loss
            } else if (finalState.weather.current === 'ACID_RAIN') {
                modifiers.upkeep *= 2.0; // Corrosion
                modifiers.ecoRegen *= 0; // No regen during acid rain
            }

            activeEvents.forEach(e => {
                if (e.modifiers) {
                    if (e.modifiers.productionMult) modifiers.production *= e.modifiers.productionMult;
                    if (e.modifiers.sellPriceMult) modifiers.sellPrice *= e.modifiers.sellPriceMult;
                    if (e.modifiers.ecoRegenMult) modifiers.ecoRegen *= e.modifiers.ecoRegenMult;
                    if (e.modifiers.trustGainMult) modifiers.trustGain *= e.modifiers.trustGainMult;
                }
            });

            let mineralProd = 0;
            let ecoChange = 0;
            let totalMaintenance = 0;

            finalState.grid.forEach((tile) => {
                if (tile.foliage === 'MINE_HOLE') ecoChange += 0.05;
                if (tile.foliage === 'ILLEGAL_CAMP') {
                    totalMaintenance += 2; // Siphoning AGT
                    ecoChange += 1.0; // Heavy pollution from unrefined methods
                }

                if (tile.buildingType === BuildingType.EMPTY || tile.isUnderConstruction) return;
                const def = BUILDINGS[tile.buildingType];
                if (tile.structureHeadIndex !== undefined && tile.id !== tile.structureHeadIndex) return;

                totalMaintenance += (def.maintenance / 5) * modifiers.upkeep;
                ecoChange += (def.pollution > 0 ? (def.pollution * 0.1 / 10) : (def.pollution / 10));

                if (def.productionType === 'MINERALS' && !tile.isUnderConstruction) {
                    mineralProd += (def.production || 0) * modifiers.production * 0.005;
                }
            });

            let newAGT = finalState.resources.agt - totalMaintenance;
            let newEco = Math.max(0, Math.min(100, finalState.resources.eco - (ecoChange / 3))); // Faster decay (was /5)
            let nextMinerals = finalState.resources.minerals + mineralProd;

            if (state.logistics.autoSell && nextMinerals >= state.logistics.sellThreshold) {
                const ecoMult = getEcoMultiplier(newEco);
                const trustMult = 1 + (finalState.resources.trust / 200);
                const value = Math.floor(nextMinerals * 8 * modifiers.sellPrice * ecoMult * trustMult); // Reduced from 15
                newAGT += value;
                nextMinerals = 0;
                finalState.pendingEffects.push({ type: 'AUDIO', sfx: 'SELL' });
            }

            if (finalState.activeGoal && !finalState.activeGoal.completed) {
                if (finalState.activeGoal.type === 'RESOURCE') {
                    const val = (finalState.resources as any)[finalState.activeGoal.targetType.toLowerCase()];
                    finalState.activeGoal.currentValue = val;
                    if (val >= finalState.activeGoal.targetValue) finalState.activeGoal.completed = true;
                } else if (finalState.activeGoal.type === 'BUILD') {
                    const count = finalState.grid.filter(t => t.buildingType === finalState.activeGoal?.targetType && !t.isUnderConstruction).length;
                    finalState.activeGoal.currentValue = count;
                    if (count >= finalState.activeGoal.targetValue) finalState.activeGoal.completed = true;
                }
            }

            return { ...finalState, resources: { ...finalState.resources, minerals: nextMinerals, agt: newAGT, eco: newEco }, activeEvents };
        }
        case 'BUY_BUILDING': {
            const { type, cost } = action.payload;
            return { ...baseState, resources: { ...baseState.resources, agt: baseState.resources.agt - cost }, inventory: { ...baseState.inventory, [type]: (baseState.inventory[type] || 0) + 1 } };
        }
        case 'SELECT_AGENT': return { ...baseState, selectedAgentId: action.payload };
        case 'COMMAND_AGENT': {
            const { agentId, tileId } = action.payload;
            let nextJobs = [...baseState.jobs], nextAgents = [...baseState.agents];
            const agentIdx = nextAgents.findIndex(a => a.id === agentId);
            if (agentIdx === -1) return baseState;
            const oldJobId = nextAgents[agentIdx].currentJobId;
            if (oldJobId) { const oldJob = nextJobs.find(j => j.id === oldJobId); if (oldJob) oldJob.assignedAgentId = null; }
            const targetTile = baseState.grid[tileId], isMinable = targetTile.foliage === 'GOLD_VEIN' || targetTile.foliage === 'ROCK_BOULDER', jobType: JobType = isMinable ? 'MINE' : 'MOVE';
            const job: Job = { id: `manual_${jobType.toLowerCase()}_${Date.now()}`, type: jobType, targetTileId: tileId, priority: 100, assignedAgentId: agentId };
            nextJobs.push(job);
            nextAgents[agentIdx] = { ...nextAgents[agentIdx], currentJobId: job.id, targetTileId: tileId, path: null, state: 'MOVING' };

            // Add FX effect directly
            const effects: SimulationEffect[] = [{ type: 'FX', fxType: 'DUST', index: tileId }];
            return { ...baseState, agents: nextAgents, jobs: nextJobs, pendingEffects: effects };
        }
        case 'SELL_MINERALS': {
            if (baseState.resources.minerals <= 0) return baseState;
            const ecoMult = getEcoMultiplier(baseState.resources.eco);
            const trustMult = 1 + (baseState.resources.trust / 200);

            // Use live market price
            const price = baseState.market.minerals.currentPrice;
            const value = Math.floor(baseState.resources.minerals * price * ecoMult * trustMult);

            return {
                ...baseState,
                resources: {
                    ...baseState.resources,
                    minerals: 0,
                    agt: baseState.resources.agt + value
                },
                pendingEffects: [{ type: 'AUDIO', sfx: 'UI_COIN' }]
            };
        }
        case 'SELECT_BUILDING_TO_PLACE': return { ...baseState, selectedBuilding: action.payload, interactionMode: action.payload ? 'BUILD' : 'INSPECT' };
        case 'PLACE_BUILDING': {
            const { index } = action.payload, buildingType = baseState.selectedBuilding;
            if (!buildingType) return baseState;
            const invCount = baseState.inventory[buildingType] || 0;
            if (invCount <= 0) return { ...baseState, selectedBuilding: null, interactionMode: 'INSPECT' };

            const def = BUILDINGS[buildingType], newGrid = [...baseState.grid], w = def.width || 1, d = def.depth || 1;
            const isInstant = baseState.cheatsEnabled;

            const updates: GridTile[] = [];
            for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) {
                const x = (index % GRID_SIZE) + dx, z = Math.floor(index / GRID_SIZE) + dz;
                if (x < GRID_SIZE && z < GRID_SIZE) {
                    const idx = z * GRID_SIZE + x;
                    newGrid[idx] = {
                        ...newGrid[idx],
                        buildingType,
                        isUnderConstruction: !isInstant,
                        constructionTimeLeft: isInstant ? 0 : def.buildTime,
                        structureHeadIndex: index,
                        explored: true
                    };
                    updates.push(newGrid[idx]);
                }
            }

            const finalGrid = updateWaterConnectivity(newGrid);
            const waterDiff = diffWaterUpdates(newGrid, finalGrid);
            const effects: SimulationEffect[] = [{ type: 'GRID_UPDATE', updates }];
            if (waterDiff) effects.push(waterDiff);

            // Decrement inventory only if NOT cheat mode
            const newInventory = { ...baseState.inventory };
            if (!isInstant) {
                newInventory[buildingType] = Math.max(0, invCount - 1);
            }

            // In Creative, keep tool selected for rapid placement
            const nextBuilding = isInstant ? buildingType : null;
            const nextMode = isInstant ? 'BUILD' : 'INSPECT';

            return {
                ...baseState,
                inventory: newInventory,
                grid: finalGrid,
                selectedBuilding: nextBuilding,
                interactionMode: nextMode,
                pendingEffects: effects
            };
        }
        case 'ACTIVATE_BULLDOZER': return { ...baseState, interactionMode: 'BULLDOZE', selectedBuilding: null };
        case 'BULLDOZE_TILE': {
            const { index } = action.payload, newGrid = [...baseState.grid], tile = newGrid[index];
            const updates: GridTile[] = [];

            if (tile.foliage === 'ILLEGAL_CAMP') {
                newGrid[index] = { ...newGrid[index], foliage: 'NONE' };
                updates.push(newGrid[index]);
            } else if (tile.structureHeadIndex !== undefined) {
                const headIdx = tile.structureHeadIndex, headTile = newGrid[headIdx], def = BUILDINGS[headTile.buildingType], w = def.width || 1, d = def.depth || 1;
                for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) {
                    const idx = (Math.floor(headIdx / GRID_SIZE) + dz) * GRID_SIZE + ((headIdx % GRID_SIZE) + dx);
                    if (newGrid[idx]) {
                        newGrid[idx] = { ...newGrid[idx], buildingType: BuildingType.EMPTY, isUnderConstruction: false, structureHeadIndex: undefined };
                        updates.push(newGrid[idx]);
                    }
                }
            } else {
                newGrid[index] = { ...newGrid[index], buildingType: BuildingType.EMPTY, isUnderConstruction: false, structureHeadIndex: undefined };
                updates.push(newGrid[index]);
            }

            const finalGrid = updateWaterConnectivity(newGrid);
            const waterDiff = diffWaterUpdates(newGrid, finalGrid);
            const effects: SimulationEffect[] = [{ type: 'GRID_UPDATE', updates }];
            if (waterDiff) effects.push(waterDiff);

            return { ...baseState, grid: finalGrid, pendingEffects: effects };
        }
        case 'SPEED_UP_BUILDING': {
            const { index } = action.payload, newGrid = [...baseState.grid], tile = newGrid[index];
            if (!tile) return baseState;
            const updates: GridTile[] = [];

            const headIdx = tile.structureHeadIndex !== undefined ? tile.structureHeadIndex : index, headTile = newGrid[headIdx], def = BUILDINGS[headTile.buildingType];
            if (def) {
                const w = def.width || 1, d = def.depth || 1;
                for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) {
                    const idx = (Math.floor(headIdx / GRID_SIZE) + dz) * GRID_SIZE + ((headIdx % GRID_SIZE) + dx);
                    if (newGrid[idx]) {
                        newGrid[idx] = { ...newGrid[idx], constructionTimeLeft: 0, isUnderConstruction: false };
                        updates.push(newGrid[idx]);
                    }
                }
            } else {
                newGrid[index] = { ...newGrid[index], constructionTimeLeft: 0, isUnderConstruction: false };
                updates.push(newGrid[index]);
            }

            const finalGrid = updateWaterConnectivity(newGrid);
            const waterDiff = diffWaterUpdates(newGrid, finalGrid);
            const effects: SimulationEffect[] = [{ type: 'GRID_UPDATE', updates }];
            if (waterDiff) effects.push(waterDiff);

            return { ...baseState, resources: { ...baseState.resources, gems: baseState.resources.gems - 1 }, grid: finalGrid, pendingEffects: effects };
        }
        case 'REHABILITATE_TILE': {
            const { index } = action.payload; if (baseState.resources.agt < 100) return baseState;
            const newJobs = [...baseState.jobs];
            if (!newJobs.some(j => j.targetTileId === index && j.type === 'REHABILITATE')) {
                newJobs.push({ id: `rehab_${index}_${Date.now()}`, type: 'REHABILITATE', targetTileId: index, priority: 25, assignedAgentId: null });
                const newGrid = [...baseState.grid];
                newGrid[index] = { ...newGrid[index], rehabProgress: 0.1 };
                return { ...baseState, resources: { ...baseState.resources, agt: baseState.resources.agt - 100 }, jobs: newJobs, grid: newGrid, pendingEffects: [{ type: 'GRID_UPDATE', updates: [newGrid[index]] }] };
            }
            return baseState;
        }
        case 'LOAD_GAME':
            return {
                ...initialState,
                ...action.payload,
                // Ensure market exists if missing in save (double safety for undefined payload.market)
                market: action.payload.market || initialState.market,
                contracts: action.payload.contracts || initialState.contracts || [],
                pendingEffects: [] // Clear effects on load
            };
        case 'CLAIM_GOAL': {
            if (!baseState.activeGoal || !baseState.activeGoal.completed) return baseState;
            const reward = baseState.activeGoal.reward;
            return { ...baseState, resources: { ...baseState.resources, [reward.type.toLowerCase()]: (baseState.resources as any)[reward.type.toLowerCase()] + reward.amount }, activeGoal: null };
        }
        case 'UNLOCK_TECH': {
            const techId = action.payload, tech = TECHNOLOGIES[techId];
            if (baseState.resources.agt < tech.cost) return baseState;
            return { ...baseState, resources: { ...baseState.resources, agt: baseState.resources.agt - tech.cost }, research: { ...baseState.research, unlocked: [...baseState.research.unlocked, techId] } };
        }
        case 'UPDATE_LOGISTICS': return { ...baseState, logistics: { ...baseState.logistics, ...action.payload } };
        case 'ADVANCE_TUTORIAL': {
            const steps = [GameStep.INTRO, GameStep.TUTORIAL_MINE, GameStep.TUTORIAL_SELL, GameStep.TUTORIAL_BUY, GameStep.TUTORIAL_PLACE, GameStep.PLAYING];
            const currentIdx = steps.indexOf(baseState.step);
            if (currentIdx === -1 || currentIdx === steps.length - 1) return baseState;
            return { ...baseState, step: steps[currentIdx + 1] };
        }
        case 'SKIP_TUTORIAL': return { ...baseState, step: GameStep.PLAYING };
        case 'TOGGLE_VIEW': return { ...baseState, viewMode: baseState.viewMode === 'SURFACE' ? 'UNDERGROUND' : 'SURFACE' };
        case 'TOGGLE_DEBUG': return { ...baseState, debugMode: !baseState.debugMode };
        case 'TOGGLE_CHEATS': return { ...baseState, cheatsEnabled: !baseState.cheatsEnabled };
        case 'RESET_GAME': return initialState;
        case 'ACCEPT_CONTRACT': {
            // For now, contracts are auto-active if in list? 
            // Logic: We differentiate 'Available' vs 'Active' later?
            // For this MVP, let's say user clicks 'Deliver' to complete immediately if they have resources
            return baseState;
        }
        case 'COMPLETE_CONTRACT': {
            const contractId = action.payload;
            const contract = baseState.contracts.find(c => c.id === contractId);
            if (!contract) return baseState;

            const resType = contract.resource.toLowerCase() as 'minerals' | 'gems';
            if (baseState.resources[resType] < contract.amount) return baseState; // Not enough goods

            // Pay rewards
            return {
                ...baseState,
                resources: {
                    ...baseState.resources,
                    [resType]: baseState.resources[resType] - contract.amount,
                    agt: baseState.resources.agt + contract.reward,
                    trust: Math.min(100, baseState.resources.trust + 5)
                },
                contracts: baseState.contracts.filter(c => c.id !== contractId),
                pendingEffects: [{ type: 'AUDIO', sfx: 'UI_COIN' }]
            };
        }
        default: return baseState;
    }
}
