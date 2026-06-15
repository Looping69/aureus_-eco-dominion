import { BuildingType, type GameState, type WorldVoxelCell, type WorldVoxelMaterial } from '../../types';
import { CommandErrorCode, type CommandResult } from '../kernel/Types';
import { ChunkStore } from '../space/ChunkStore';
import { CHUNK_SIZE, toChunkKey, worldToChunk } from '../utils/coords';
import {
    applySubsurfaceYield,
    getSubsurfaceCell,
    getSubsurfaceResourceYield,
    layeredChunkKey,
    SUBSURFACE_RUBBLE_PER_BLOCK,
    SUBSURFACE_SURFACE_RUBBLE_DUMP_CAPACITY,
    validateSubsurfaceRubbleClearTarget,
} from './SubsurfaceModel';

function ensureRubbleState(state: GameState): void {
    state.layeredWorld.rubbleStockpile ??= 0;
    state.layeredWorld.rubbleDropZones ??= {};
}

function isStructureHead(tile: { x: number; z: number; structureHeadX?: number; structureHeadZ?: number }): boolean {
    return tile.structureHeadX === undefined || (tile.structureHeadX === tile.x && tile.structureHeadZ === tile.z);
}

function getSurfaceRubbleCapacity(state: GameState): number {
    let capacity = 0;
    for (const chunk of Object.values(state.chunks)) {
        for (const tile of chunk.tiles) {
            if (tile.isUnderConstruction) continue;
            if (!isStructureHead(tile)) continue;
            if (tile.buildingType === BuildingType.STOCKPILE) capacity += SUBSURFACE_SURFACE_RUBBLE_DUMP_CAPACITY;
        }
    }
    return capacity;
}

function getTotalRubbleCapacity(state: GameState): number {
    ensureRubbleState(state);
    const undergroundCapacity = Object.values(state.layeredWorld.rubbleDropZones || {}).reduce((total, zone) => total + zone.capacity, 0);
    return undergroundCapacity + getSurfaceRubbleCapacity(state);
}

function hasRubbleCapacity(state: GameState, amount: number): boolean {
    ensureRubbleState(state);
    return (state.layeredWorld.rubbleStockpile || 0) + amount <= getTotalRubbleCapacity(state);
}

function markSubsurfaceDirty(state: GameState, cell: WorldVoxelCell): void {
    const chunk = state.layeredWorld.chunks[layeredChunkKey(cell.x, cell.z)];
    const layer = chunk?.layers?.[cell.y];
    if (layer) layer.dirty = true;
    if (chunk) chunk.dirty = true;
    state.layeredWorld.renderVersion = (state.layeredWorld.renderVersion || 0) + 1;
}

function clearSurfaceRubble(state: GameState, x: number, z: number): void {
    const tile = ChunkStore.getTile(state.chunks, x, z);
    if (!tile || tile.foliage !== 'ROCK_PEBBLE') return;
    tile.foliage = 'NONE';
    const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
    const chunkKey = toChunkKey(cx, cz);
    const chunk = state.chunks[chunkKey];
    if (chunk) {
        chunk.meshDirty = true;
        chunk.simDirty = true;
        chunk.version = (chunk.version || 0) + 1;
        state.pendingEffects.push({ type: 'CHUNK_UPDATE', cx, cz, updates: [tile] });
    }
}

export function clearSubsurfaceRubbleForHaul(state: GameState, x: number, y: number, z: number): CommandResult {
    const validation = validateSubsurfaceRubbleClearTarget(state, x, y, z);
    if (!validation.ok) return validation;
    if (!hasRubbleCapacity(state, SUBSURFACE_RUBBLE_PER_BLOCK)) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Build a Stockpile or designate a rubble dump with free space before clearing this pile.' };
    }

    const cell = getSubsurfaceCell(state.layeredWorld, x, y, z);
    if (!cell) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target cell is not generated.' };

    const buriedMaterial: WorldVoxelMaterial = cell.buriedMaterial && cell.buriedMaterial !== 'RUBBLE' ? cell.buriedMaterial : 'STONE';
    applySubsurfaceYield(state, getSubsurfaceResourceYield({ ...cell, material: buriedMaterial, resourceAmount: cell.buriedResourceAmount }));
    cell.material = 'AIR';
    cell.contents = 'TUNNEL';
    cell.revealed = true;
    cell.destructible = false;
    cell.walkable = true;
    cell.mineable = false;
    cell.resourceAmount = undefined;
    cell.buriedMaterial = undefined;
    cell.buriedResourceAmount = undefined;
    cell.stability = Math.max(5, Number(cell.stability || 100) - 6);
    markSubsurfaceDirty(state, cell);
    clearSurfaceRubble(state, x, z);
    return { ok: true };
}

export function depositCarriedRubble(state: GameState, amount: number = SUBSURFACE_RUBBLE_PER_BLOCK): CommandResult {
    ensureRubbleState(state);
    if (!hasRubbleCapacity(state, amount)) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'No rubble storage capacity is available.' };
    }

    let remaining = amount;
    const zones = Object.values(state.layeredWorld.rubbleDropZones || {}).sort((a, b) => (a.stored / a.capacity) - (b.stored / b.capacity));
    for (const zone of zones) {
        if (remaining <= 0) break;
        const stored = Math.min(Math.max(0, zone.capacity - zone.stored), remaining);
        zone.stored += stored;
        remaining -= stored;
    }

    state.layeredWorld.rubbleStockpile = (state.layeredWorld.rubbleStockpile || 0) + amount;
    state.layeredWorld.renderVersion = (state.layeredWorld.renderVersion || 0) + 1;
    return { ok: true };
}
