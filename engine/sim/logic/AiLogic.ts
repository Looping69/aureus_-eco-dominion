
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GameState, Goal, GlobalEvent, NewsItem, GridTile, Agent, BuildingType, Chunk } from '../../../types';
import { createColonist } from './SimulationLogic';
import { FixedContext } from '../../kernel';
import { toChunkKey, worldToChunk } from '../../utils/coords';
import { CHUNK_SIZE } from '../../space/ChunkStore';

const isStructureHead = (tile: GridTile) =>
    tile.structureHeadX === undefined || (tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ);

const getBuildingCount = (state: GameState, type: BuildingType) =>
    Object.values(state.chunks)
        .flatMap(c => c.tiles)
        .filter(t => t.buildingType === type && !t.isUnderConstruction && isStructureHead(t))
        .length;

const makeGoal = (
    ctx: FixedContext,
    title: string,
    description: string,
    type: Goal['type'],
    targetType: Goal['targetType'],
    targetValue: number,
    currentValue: number,
    reward: Goal['reward']
): Goal => ({
    id: ctx.getNextId?.('goal') || `goal_${Date.now()}`,
    title,
    description,
    type,
    targetType,
    targetValue,
    currentValue,
    reward,
    completed: false
});

export function generateGoal(ctx: FixedContext, state: GameState): Goal {
    const staffQuarters = getBuildingCount(state, BuildingType.STAFF_QUARTERS);
    if (staffQuarters < 1) {
        return makeGoal(
            ctx,
            'Buy and Place Staff Quarters',
            'Buy Staff Quarters, place the footprint, then let workers finish construction.',
            'BUILD',
            BuildingType.STAFF_QUARTERS,
            1,
            staffQuarters,
            { type: 'AGT', amount: 250 }
        );
    }

    const storage = getBuildingCount(state, BuildingType.STORAGE_DEPOT) + getBuildingCount(state, BuildingType.STOCKPILE);
    if (storage < 1) {
        return makeGoal(
            ctx,
            'Build Storage',
            'Add a Storage Depot so mined resources have somewhere obvious to go.',
            'BUILD',
            BuildingType.STORAGE_DEPOT,
            1,
            storage,
            { type: 'AGT', amount: 300 }
        );
    }

    const miningHeadframes = getBuildingCount(state, BuildingType.MINING_HEADFRAME);
    if (miningHeadframes < 1) {
        return makeGoal(
            ctx,
            'Build Mining Headframe',
            'Place and finish a Mining Headframe to start producing the first contract resource.',
            'BUILD',
            BuildingType.MINING_HEADFRAME,
            1,
            miningHeadframes,
            { type: 'AGT', amount: 500 }
        );
    }

    if (state.resources.minerals < 80) {
        return makeGoal(
            ctx,
            'Generate Minerals',
            'Let the mining loop run until the colony has 80 minerals ready for delivery.',
            'RESOURCE',
            'MINERALS',
            80,
            state.resources.minerals,
            { type: 'GEMS', amount: 1 }
        );
    }

    const hasCompletedContract = state.contracts.some(contract => contract.status === 'COMPLETED');
    if (!hasCompletedContract) {
        return makeGoal(
            ctx,
            'Deliver First Mineral Contract',
            'Accept the mineral contract, deliver the stockpile, and turn production into cash.',
            'RESOURCE',
            'AGT',
            state.resources.agt + 1500,
            state.resources.agt,
            { type: 'AGT', amount: 500 }
        );
    }

    if (!state.unlockedEras?.includes('GROWTH' as any)) {
        return makeGoal(
            ctx,
            'Unlock Growth',
            'Use the first payout to stabilize the settlement and advance into the next era.',
            'RESOURCE',
            'TRUST',
            Math.min(100, Math.max(state.resources.trust + 2, 35)),
            state.resources.trust,
            { type: 'AGT', amount: 1000 }
        );
    }

    const r = ctx.random?.next() || Math.random();

    // Basic progression goals after the starter loop is proven.
    if (state.resources.agt < 1000) {
        return makeGoal(
            ctx,
            'Initial Capital',
            'Accumulate wealth to fund expansion.',
            'RESOURCE',
            'AGT',
            state.resources.agt + 500,
            state.resources.agt,
            { type: 'GEMS', amount: 2 }
        );
    }

    if (r > 0.6) {
        const currentStaffQuarters = getBuildingCount(state, BuildingType.STAFF_QUARTERS);
        return makeGoal(
            ctx,
            'Expansion Protocol',
            'Construct more housing for workforce.',
            'BUILD',
            BuildingType.STAFF_QUARTERS,
            currentStaffQuarters + 1,
            currentStaffQuarters,
            { type: 'AGT', amount: 500 }
        );
    } else if (r > 0.3) {
        return makeGoal(
            ctx,
            'Stockpile Ore',
            'Gather raw minerals for export.',
            'RESOURCE',
            'MINERALS',
            state.resources.minerals + 100,
            state.resources.minerals,
            { type: 'GEMS', amount: 2 }
        );
    } else {
        return makeGoal(
            ctx,
            'Public Trust',
            'Improve colony reputation.',
            'RESOURCE',
            'TRUST',
            Math.min(100, state.resources.trust + 15),
            state.resources.trust,
            { type: 'AGT', amount: 1000 }
        );
    }
}

export function checkAndGenerateEvent(ctx: FixedContext, state: GameState): { event: GlobalEvent | null, news: NewsItem | null, newChunks: Record<string, Chunk> | null, newAgents: Agent[] | null } {

    let event: GlobalEvent | null = null;
    let news: NewsItem | null = null;
    let newChunks: Record<string, Chunk> | null = null;

    let newAgents: Agent[] | null = null;

    // Do not overlap events if possible, or very rare
    if (state.activeEvents.length > 0) return { event, news, newChunks, newAgents };


    const r = ctx.random?.next() || Math.random();
    const eco = state.resources.eco;

    // 1. DUST STORM FRONT (Only likely after sustained ecological abuse)
    const dustStormChance = eco < 50 ? Math.min(0.12, 0.035 + ((50 - eco) / 700)) : 0;

    if (r < dustStormChance) {
        newChunks = { ...state.chunks };
        let affected = 0;
        Object.keys(newChunks).forEach(chunkKey => {
            const chunk = { ...newChunks![chunkKey], tiles: [...newChunks![chunkKey].tiles] };
            chunk.tiles.forEach((t, i) => {
                // Strip vegetation and topsoil under prolonged dust exposure.
                if (t.foliage && t.foliage.startsWith('TREE_') && (ctx.random?.next() || Math.random()) > 0.8) {
                    chunk.tiles[i] = { ...t, foliage: 'TREE_DEAD', biome: 'DIRT' };
                    affected++;
                }
                else if (t.biome === 'GRASS' && t.buildingType === BuildingType.EMPTY && (ctx.random?.next() || Math.random()) > 0.9) {
                    chunk.tiles[i] = { ...t, biome: 'DIRT', foliage: 'NONE' };
                    affected++;
                }
            });
            if (chunk.simDirty) newChunks![chunkKey] = chunk;
        });

        event = {
            id: ctx.getNextId?.('evt_dust') || `evt_dust_${Date.now()}`,
            name: "Dust Storm Front",
            type: 'WEATHER',
            description: "Dry, degraded ground has kicked a dust front across the concession. Visibility and field efficiency are down.",
            duration: 480,
            weatherOverride: 'DUST_STORM',
            visualTheme: 'NORMAL',
            modifiers: { ecoRegenMult: 0.4, productionMult: 0.78, trustGainMult: 0.85 }
        };
        news = {
            id: ctx.getNextId?.('news_dust') || `news_dust_${Date.now()}`,
            headline: `WEATHER: Dust storm front rolling over the mine. ${affected > 0 ? `${affected} terrain patches were scoured.` : 'Visibility is collapsing.'}`,
            type: 'NEGATIVE',
            timestamp: state.tickCount
        };
        return { event, news, newChunks, newAgents };
    }


    // 2. HEATWAVE
    if (r < 0.12) {
        event = {
            id: ctx.getNextId?.('evt_heat') || `evt_heat_${Date.now()}`,
            name: "Heatwave",
            type: 'WEATHER',
            description: "Dry-season heat is pushing crews, pumps, and surface equipment hard.",
            duration: 450,
            weatherOverride: 'HEATWAVE',
            visualTheme: 'NORMAL',
            modifiers: { energyDecayMult: 1.6, productionMult: 0.92 }
        };
        news = { id: ctx.getNextId?.('news_heat') || `news_heat_${Date.now()}`, headline: "WEATHER: Heatwave warning. Water demand and crew fatigue are spiking.", type: 'NEGATIVE', timestamp: state.tickCount };
        return { event, news, newChunks: null, newAgents: null };
    }


    // 3. ECONOMIC BOOM (Occasional)
    if (r < 0.22) {
        event = {
            id: ctx.getNextId?.('evt_boom') || `evt_boom_${Date.now()}`,
            name: "Global Market Boom",
            type: 'ECONOMIC',
            description: "Off-world demand for resources has skyrocketed.",
            duration: 600,
            visualTheme: 'GOLDEN',
            modifiers: { sellPriceMult: 2.5 }
        };
        news = { id: ctx.getNextId?.('news_boom') || `news_boom_${Date.now()}`, headline: "ECONOMY: Market Surge! Mineral prices at all-time high.", type: 'POSITIVE', timestamp: state.tickCount };
        return { event, news, newChunks: null, newAgents: null };
    }


    // 4. GEOLOGICAL SHIFT (Occasional resource reveal)
    if (r < 0.30) {
        const allTiles = Object.values(state.chunks).flatMap(c => c.tiles);
        const candidates = allTiles.filter(t => t.biome === 'STONE' && t.buildingType === BuildingType.EMPTY && t.foliage === 'NONE');
        if (candidates.length > 0) {
            newChunks = { ...state.chunks };
            const num = Math.min(candidates.length, Math.ceil((ctx.random?.next() || Math.random()) * 5) + 2);
            for (let k = 0; k < num; k++) {
                const c = candidates[Math.floor((ctx.random?.next() || Math.random()) * candidates.length)];
                // Find chunk for this candidate
                const { cx, cz } = worldToChunk(c.x, c.z, CHUNK_SIZE);
                const chunkId = toChunkKey(cx, cz);
                const chunk = { ...newChunks[chunkId], tiles: [...newChunks[chunkId].tiles] };
                const tIdx = chunk.tiles.findIndex(t => t.x === c.x && t.z === c.z);
                if (tIdx !== -1) {
                    chunk.tiles[tIdx] = { ...chunk.tiles[tIdx], foliage: (ctx.random?.next() || Math.random()) > 0.6 ? 'GOLD_VEIN' : 'CRYSTAL_SPIKE' };
                    newChunks[chunkId] = chunk;
                }
            }
            // Just an event notification, no duration effects
            event = { id: ctx.getNextId?.('evt_quake') || `evt_quake_${Date.now()}`, name: "Seismic Shift", type: 'GEOLOGICAL', description: "Tremors reveal new deposits.", duration: 100, visualTheme: 'NORMAL' };
            news = { id: ctx.getNextId?.('news_quake') || `news_quake_${Date.now()}`, headline: "GEOLOGY: Seismic shift revealed new veins in the mountains.", type: 'NEUTRAL', timestamp: state.tickCount };
            return { event, news, newChunks, newAgents: null };
        }
    }



    // 5. INCURSION (Super rare)
    if (r > 0.9985) {
        const allTiles = Object.values(state.chunks).flatMap(c => c.tiles);
        const borderTiles = allTiles.filter(t => t.locked && t.foliage === 'NONE');
        if (borderTiles.length > 3) {
            newChunks = { ...state.chunks };
            newAgents = [...state.agents];
            const tile = borderTiles[Math.floor((ctx.random?.next() || Math.random()) * borderTiles.length)];
            const { cx, cz } = worldToChunk(tile.x, tile.z, CHUNK_SIZE);
            const chunkId = toChunkKey(cx, cz);
            const chunk = { ...newChunks[chunkId], tiles: [...newChunks[chunkId].tiles] };
            const tIdx = chunk.tiles.findIndex(t => t.x === tile.x && t.z === tile.z);
            if (tIdx !== -1) {
                chunk.tiles[tIdx] = { ...chunk.tiles[tIdx], foliage: 'ILLEGAL_CAMP' };
                newChunks[chunkId] = chunk;
            }
            newAgents.push(createColonist(tile.x, tile.z, 'ILLEGAL_MINER'));
            event = {
                id: ctx.getNextId?.('evt_inc') || `evt_inc_${Date.now()}`,
                name: "Resource Incursion",
                type: 'INCURSION',
                description: "Unauthorized miners are harvesting your claims.",
                duration: 300,
                visualTheme: 'NORMAL'
            };
            news = { id: ctx.getNextId?.('news_inc') || `news_inc_${Date.now()}`, headline: "SECURITY ALERT: Illegal mining operation detected.", type: 'CRITICAL', timestamp: state.tickCount };
            return { event, news, newChunks, newAgents };
        }
    }

    return { event, news, newChunks, newAgents };
}
