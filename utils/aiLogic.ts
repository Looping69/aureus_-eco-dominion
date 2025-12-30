
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GameState, Goal, GlobalEvent, NewsItem, GridTile, Agent, BuildingType } from '../types';
import { createColonist } from './simulationLogic';

const getBuildingCount = (state: GameState, type: BuildingType) => state.grid.filter(t => t.buildingType === type && !t.isUnderConstruction).length;

export function generateGoal(state: GameState): Goal {
    const r = Math.random();
    
    // Basic progression goals
    if (state.resources.agt < 1000) {
        return {
            id: `goal_${Date.now()}`,
            title: 'Initial Capital',
            description: 'Accumulate wealth to fund expansion.',
            type: 'RESOURCE',
            targetType: 'AGT',
            targetValue: state.resources.agt + 500,
            currentValue: 0,
            reward: { type: 'GEMS', amount: 2 },
            completed: false
        };
    }

    if (r > 0.6) {
        return {
            id: `goal_${Date.now()}`,
            title: 'Expansion Protocol',
            description: 'Construct more housing for workforce.',
            type: 'BUILD',
            targetType: BuildingType.STAFF_QUARTERS,
            targetValue: getBuildingCount(state, BuildingType.STAFF_QUARTERS) + 1,
            currentValue: 0,
            reward: { type: 'AGT', amount: 500 },
            completed: false
        };
    } else if (r > 0.3) {
        return {
             id: `goal_${Date.now()}`,
             title: 'Stockpile Ore',
             description: 'Gather raw minerals for export.',
             type: 'RESOURCE',
             targetType: 'MINERALS',
             targetValue: state.resources.minerals + 100,
             currentValue: 0,
             reward: { type: 'GEMS', amount: 2 },
             completed: false
        };
    } else {
        return {
             id: `goal_${Date.now()}`,
             title: 'Public Trust',
             description: 'Improve colony reputation.',
             type: 'RESOURCE',
             targetType: 'TRUST',
             targetValue: Math.min(100, state.resources.trust + 15),
             currentValue: 0,
             reward: { type: 'AGT', amount: 1000 },
             completed: false
        };
    }
}

export function checkAndGenerateEvent(state: GameState): { event: GlobalEvent | null, news: NewsItem | null, newGrid: GridTile[] | null, newAgents: Agent[] | null } {
    let event: GlobalEvent | null = null;
    let news: NewsItem | null = null;
    let newGrid: GridTile[] | null = null;
    let newAgents: Agent[] | null = null;

    // Do not overlap events if possible, or very rare
    if (state.activeEvents.length > 0) return { event, news, newGrid, newAgents };

    const r = Math.random();
    const eco = state.resources.eco;

    // 1. TOXIC ACID RAIN (High chance if Eco is low)
    // Threshold: Eco < 50. Chance increases as Eco drops.
    const acidRainChance = eco < 50 ? 0.3 + ((50 - eco) / 100) : 0; 
    
    if (r < acidRainChance) {
        newGrid = [...state.grid];
        let affected = 0;
        state.grid.forEach((t, i) => {
            // Damage foliage
            if (t.foliage && t.foliage.startsWith('TREE_') && Math.random() > 0.8) {
                newGrid![i] = { ...t, foliage: 'TREE_DEAD', biome: 'DIRT' };
                affected++;
            }
            // Grass dies
            else if (t.biome === 'GRASS' && t.buildingType === BuildingType.EMPTY && Math.random() > 0.9) {
                newGrid![i] = { ...t, biome: 'DIRT', foliage: 'NONE' };
                affected++;
            }
        });

        event = { 
            id: `evt_acid_${Date.now()}`, 
            name: "Toxic Acid Rain", 
            type: 'WEATHER', 
            description: "High pollution levels have triggered acidic precipitation. Flora is decaying.", 
            duration: 600, // 60 seconds
            visualTheme: 'TOXIC',
            modifiers: { ecoRegenMult: 0.1, productionMult: 0.8 } 
        };
        news = { id: `news_acid_${Date.now()}`, headline: "WARNING: Toxic Rain detected. Shelter advised.", type: 'NEGATIVE', timestamp: Date.now() };
        return { event, news, newGrid, newAgents };
    }

    // 2. HEATWAVE (Random, mostly in summer/hot biomes conceptually, but here just random)
    if (r < 0.45) {
        event = {
            id: `evt_heat_${Date.now()}`,
            name: "Solar Flare / Heatwave",
            type: 'WEATHER',
            description: "Intense solar activity. Energy consumption increased. Solar output maxed.",
            duration: 450,
            visualTheme: 'HEAT',
            modifiers: { energyDecayMult: 2.0, productionMult: 1.2 } // Solar panels work better, bots drain faster
        };
        news = { id: `news_heat_${Date.now()}`, headline: "WEATHER: Severe Heatwave. Cooling systems critical.", type: 'NEUTRAL', timestamp: Date.now() };
        return { event, news, newGrid, newAgents };
    }

    // 3. ECONOMIC BOOM (Random)
    if (r < 0.6) {
        event = {
            id: `evt_boom_${Date.now()}`,
            name: "Global Market Boom",
            type: 'ECONOMIC',
            description: "Off-world demand for resources has skyrocketed.",
            duration: 600,
            visualTheme: 'GOLDEN',
            modifiers: { sellPriceMult: 2.5 }
        };
        news = { id: `news_boom_${Date.now()}`, headline: "ECONOMY: Market Surge! Mineral prices at all-time high.", type: 'POSITIVE', timestamp: Date.now() };
        return { event, news, newGrid, newAgents };
    }

    // 4. GEOLOGICAL SHIFT (Spawns resources)
    if (r < 0.75) {
        const candidates = state.grid.filter(t => t.biome === 'STONE' && t.buildingType === BuildingType.EMPTY && t.foliage === 'NONE');
        if (candidates.length > 0) {
            newGrid = [...state.grid];
            const num = Math.min(candidates.length, Math.ceil(Math.random() * 5) + 2);
            for(let k=0; k<num; k++) {
                 const c = candidates[Math.floor(Math.random() * candidates.length)];
                 newGrid[c.id] = { ...newGrid[c.id], foliage: Math.random() > 0.6 ? 'GOLD_VEIN' : 'CRYSTAL_SPIKE' };
            }
            // Just an event notification, no duration effects
            event = { id: `evt_quake_${Date.now()}`, name: "Seismic Shift", type: 'GEOLOGICAL', description: "Tremors reveal new deposits.", duration: 100, visualTheme: 'NORMAL' };
            news = { id: `news_quake_${Date.now()}`, headline: "GEOLOGY: Seismic shift revealed new veins in the mountains.", type: 'NEUTRAL', timestamp: Date.now() };
            return { event, news, newGrid, newAgents };
        }
    }

    // 5. INCURSION (Rare)
    if (r > 0.95) {
        const borderTiles = state.grid.filter(t => t.locked && t.foliage === 'NONE');
        if (borderTiles.length > 3) {
            newGrid = [...state.grid];
            newAgents = [...state.agents];
            for (let i = 0; i < 3; i++) {
                const tile = borderTiles[Math.floor(Math.random() * borderTiles.length)];
                newGrid[tile.id] = { ...tile, foliage: 'ILLEGAL_CAMP' };
                newAgents.push(createColonist(tile.x, tile.y, 'ILLEGAL_MINER'));
            }
            event = {
                id: `evt_inc_${Date.now()}`,
                name: "Resource Incursion",
                type: 'INCURSION',
                description: "Unauthorized miners are harvesting your claims.",
                duration: 300,
                visualTheme: 'NORMAL'
            };
            news = { id: `news_inc_${Date.now()}`, headline: "SECURITY ALERT: Illegal mining operation detected.", type: 'CRITICAL', timestamp: Date.now() };
            return { event, news, newGrid, newAgents };
        }
    }

    return { event, news, newGrid, newAgents };
}
