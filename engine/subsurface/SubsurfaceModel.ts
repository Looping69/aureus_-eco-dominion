import { BuildingType, type GameState, type LayeredWorldState, type WorldVoxelCell, type WorldVoxelMaterial } from '../../types';
import { CommandErrorCode, type CommandResult } from '../kernel/Types';
import { ChunkStore } from '../space/ChunkStore';
import { CHUNK_SIZE, toChunkKey, worldToChunk } from '../utils/coords';

export const SUBSURFACE_CHUNK_SIZE = 16;
export const SUBSURFACE_FOUNDATION_VERSION = 1;
export const SUBSURFACE_OPEN_PIT_ENTRY_DEPTH = 1;
export const SUBSURFACE_TERRAIN_DROP_PER_LAYER = 1;
export const SUBSURFACE_RUBBLE_PER_BLOCK = 1;
export const SUBSURFACE_RUBBLE_DUMP_CAPACITY = 24;
export const SUBSURFACE_DIG_JOB_PREFIX = 'dig_sub';

export type SubsurfaceExcavationOptions = {
    deformSurface?: boolean;
};

export function layeredChunkKey(x: number, z: number): string {
    return `${Math.floor(x / SUBSURFACE_CHUNK_SIZE)},${Math.floor(z / SUBSURFACE_CHUNK_SIZE)}`;
}

export function layeredCellKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
}

export function subsurfaceDigJobId(x: number, y: number, z: number): string {
    return `${SUBSURFACE_DIG_JOB_PREFIX}_${x}_${y}_${z}`;
}

export function isSubsurfaceDigJob(job: { id?: string; targetY?: number }): boolean {
    return Boolean(job.id?.startsWith(`${SUBSURFACE_DIG_JOB_PREFIX}_`) || Number.isFinite(job.targetY));
}

export function isSubsurfaceLayer(layeredWorld: LayeredWorldState, y: number): boolean {
    return y < layeredWorld.surfaceY && y >= layeredWorld.minY && y <= layeredWorld.maxY;
}

export function getOpenPitEntryLayer(layeredWorld: LayeredWorldState): number {
    return Math.max(layeredWorld.minY, layeredWorld.surfaceY - SUBSURFACE_OPEN_PIT_ENTRY_DEPTH);
}

export function getSubsurfaceCell(layeredWorld: LayeredWorldState, x: number, y: number, z: number): WorldVoxelCell | undefined {
    const chunk = layeredWorld.chunks?.[layeredChunkKey(x, z)];
    const layer = chunk?.layers?.[y];
    return layer?.cells?.[layeredCellKey(x, y, z)];
}

export function setActiveSubsurfaceLayer(layeredWorld: LayeredWorldState, y: number): LayeredWorldState {
    const targetY = Math.max(layeredWorld.minY, Math.min(layeredWorld.maxY, Math.round(y)));
    return {
        ...layeredWorld,
        activeY: targetY,
        renderVersion: (layeredWorld.renderVersion || 0) + 1,
    };
}

function getRubbleDropZoneKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
}

function ensureRubbleState(layeredWorld: LayeredWorldState): void {
    layeredWorld.rubbleStockpile ??= 0;
    layeredWorld.rubbleDropZones ??= {};
}

function hasRubbleDropCapacity(layeredWorld: LayeredWorldState, amount: number = SUBSURFACE_RUBBLE_PER_BLOCK): boolean {
    ensureRubbleState(layeredWorld);
    const zones = Object.values(layeredWorld.rubbleDropZones || {});
    return zones.some(zone => zone.stored + amount <= zone.capacity);
}

function depositRubble(layeredWorld: LayeredWorldState, amount: number = SUBSURFACE_RUBBLE_PER_BLOCK): boolean {
    ensureRubbleState(layeredWorld);
    const zones = Object.values(layeredWorld.rubbleDropZones || {});
    const target = zones.find(zone => zone.stored + amount <= zone.capacity);
    if (!target) return false;
    target.stored += amount;
    layeredWorld.rubbleStockpile = (layeredWorld.rubbleStockpile || 0) + amount;
    layeredWorld.renderVersion = (layeredWorld.renderVersion || 0) + 1;
    return true;
}

function consumeRubble(layeredWorld: LayeredWorldState, amount: number = SUBSURFACE_RUBBLE_PER_BLOCK): boolean {
    ensureRubbleState(layeredWorld);
    if ((layeredWorld.rubbleStockpile || 0) < amount) return false;

    let remaining = amount;
    const zones = Object.values(layeredWorld.rubbleDropZones || {}).sort((a, b) => b.stored - a.stored);
    for (const zone of zones) {
        if (remaining <= 0) break;
        const taken = Math.min(zone.stored, remaining);
        zone.stored -= taken;
        remaining -= taken;
    }

    if (remaining > 0) return false;
    layeredWorld.rubbleStockpile = Math.max(0, (layeredWorld.rubbleStockpile || 0) - amount);
    layeredWorld.renderVersion = (layeredWorld.renderVersion || 0) + 1;
    return true;
}

export function validateSubsurfaceDigTarget(state: GameState, x: number, y: number, z: number): CommandResult {
    const layeredWorld = state.layeredWorld;
    if (!layeredWorld?.enabled) {
        return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: 'Layered world is disabled.' };
    }
    if (y >= layeredWorld.surfaceY) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Use surface tools above ground.' };
    }
    if (!isSubsurfaceLayer(layeredWorld, y)) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target layer is outside the generated world.' };
    }

    const tile = ChunkStore.getTile(state.chunks, x, z);
    if (!tile) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Surface tile is not loaded.' };
    }
    if (tile.buildingType !== BuildingType.EMPTY) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Clear surface buildings before opening a pit here.' };
    }

    const cell = getSubsurfaceCell(layeredWorld, x, y, z);
    if (!cell) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target cell is not generated.' };
    }
    if (cell.material === 'RUBBLE' && !hasRubbleDropCapacity(layeredWorld)) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Designate a rubble dump with free space before clearing this pile.' };
    }
    if (!cell.mineable || !cell.destructible) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: `${cell.material} cannot be excavated here.` };
    }

    return { ok: true };
}

export function queueSubsurfaceExcavationJob(state: GameState, x: number, y: number, z: number): CommandResult {
    const validation = validateSubsurfaceDigTarget(state, x, y, z);
    if (!validation.ok) return validation;

    const id = subsurfaceDigJobId(x, y, z);
    const existing = state.jobs.find(job => job.id === id);
    if (existing) {
        existing.priority = Math.max(existing.priority, 88);
        return { ok: true };
    }

    state.jobs.push({
        id,
        type: 'MINE',
        targetX: x,
        targetY: y,
        targetZ: z,
        context: 'SURFACE_CUT',
        priority: 88,
        assignedAgentId: null,
        progress: 0,
    });

    return { ok: true };
}

export function getSubsurfaceResourceYield(cell: WorldVoxelCell): Partial<GameState['resources']> {
    const resourceAmount = Number(cell.resourceAmount || 1);
    switch (cell.material) {
        case 'ORE':
            return { minerals: Math.max(4, resourceAmount) };
        case 'GEMS':
            return { gems: Math.max(1, resourceAmount) };
        case 'AUREUS_VEIN':
            return { minerals: 25, gems: 2 };
        case 'STONE':
            return { stone: 2 };
        default:
            return {};
    }
}

export function applySubsurfaceYield(state: GameState, yieldResources: Partial<GameState['resources']>): void {
    state.resources.minerals += yieldResources.minerals || 0;
    state.resources.gems += yieldResources.gems || 0;
    state.resources.wood += yieldResources.wood || 0;
    state.resources.stone += yieldResources.stone || 0;
    state.resources.agt += yieldResources.agt || 0;
}

function refreshSurfaceTile(state: GameState, x: number, z: number): void {
    const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
    const chunkKey = toChunkKey(cx, cz);
    const surfaceChunk = state.chunks[chunkKey];
    const tile = ChunkStore.getTile(state.chunks, x, z);
    if (!surfaceChunk || !tile) return;

    surfaceChunk.meshDirty = true;
    surfaceChunk.simDirty = true;
    surfaceChunk.version = (surfaceChunk.version || 0) + 1;
    const layeredChunk = state.layeredWorld.chunks[layeredChunkKey(x, z)];
    if (layeredChunk) {
        layeredChunk.generatedFromSurfaceVersion = surfaceChunk.version;
    }
    state.pendingEffects.push({ type: 'CHUNK_UPDATE', cx, cz, updates: [tile] });
}

export function lowerSurfaceForOpenPit(state: GameState, x: number, z: number): boolean {
    const tile = ChunkStore.getTile(state.chunks, x, z);
    if (!tile || tile.buildingType !== BuildingType.EMPTY) return false;

    tile.terrainHeight -= SUBSURFACE_TERRAIN_DROP_PER_LAYER;
    tile.markedForHarvest = false;
    tile.explored = true;
    tile.revealed = true;
    refreshSurfaceTile(state, x, z);

    return true;
}

function markSurfaceRubble(state: GameState, x: number, z: number): void {
    const tile = ChunkStore.getTile(state.chunks, x, z);
    if (!tile || tile.buildingType !== BuildingType.EMPTY) return;
    tile.foliage = 'ROCK_PEBBLE';
    tile.markedForHarvest = false;
    refreshSurfaceTile(state, x, z);
}

function clearSurfaceRubble(state: GameState, x: number, z: number): void {
    const tile = ChunkStore.getTile(state.chunks, x, z);
    if (!tile || tile.foliage !== 'ROCK_PEBBLE') return;
    tile.foliage = 'NONE';
    refreshSurfaceTile(state, x, z);
}

function markSubsurfaceDirty(layeredWorld: LayeredWorldState, x: number, y: number, z: number): void {
    const chunk = layeredWorld.chunks[layeredChunkKey(x, z)];
    const layer = chunk?.layers?.[y];
    if (layer) layer.dirty = true;
    if (chunk) chunk.dirty = true;
    layeredWorld.renderVersion = (layeredWorld.renderVersion || 0) + 1;
}

function breakSubsurfaceCellIntoRubble(state: GameState, cell: WorldVoxelCell, options: SubsurfaceExcavationOptions): CommandResult {
    cell.buriedMaterial = cell.material;
    cell.buriedResourceAmount = cell.resourceAmount;
    cell.material = 'RUBBLE';
    cell.contents = 'RUBBLE_PILE';
    cell.revealed = true;
    cell.destructible = true;
    cell.walkable = false;
    cell.mineable = true;
    cell.resourceAmount = SUBSURFACE_RUBBLE_PER_BLOCK;
    cell.stability = Math.max(5, Number(cell.stability || 100) - 12);
    markSubsurfaceDirty(state.layeredWorld, cell.x, cell.y, cell.z);

    if (options.deformSurface) {
        lowerSurfaceForOpenPit(state, cell.x, cell.z);
        markSurfaceRubble(state, cell.x, cell.z);
    }

    return { ok: true };
}

function clearRubbleCell(state: GameState, cell: WorldVoxelCell): CommandResult {
    if (!depositRubble(state.layeredWorld, SUBSURFACE_RUBBLE_PER_BLOCK)) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Designate a rubble dump with free space before clearing this pile.' };
    }

    const buriedMaterial: WorldVoxelMaterial = cell.buriedMaterial && cell.buriedMaterial !== 'RUBBLE'
        ? cell.buriedMaterial
        : 'STONE';
    applySubsurfaceYield(state, getSubsurfaceResourceYield({
        ...cell,
        material: buriedMaterial,
        resourceAmount: cell.buriedResourceAmount,
    }));

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
    markSubsurfaceDirty(state.layeredWorld, cell.x, cell.y, cell.z);
    clearSurfaceRubble(state, cell.x, cell.z);

    return { ok: true };
}

export function designateRubbleDropZone(state: GameState, x: number, y: number, z: number): CommandResult {
    const layeredWorld = state.layeredWorld;
    if (!layeredWorld?.enabled) {
        return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: 'Layered world is disabled.' };
    }
    if (!isSubsurfaceLayer(layeredWorld, y)) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Rubble dumps must be placed on a subsurface layer.' };
    }

    const cell = getSubsurfaceCell(layeredWorld, x, y, z);
    if (!cell) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target cell is not generated.' };
    }
    if (cell.material !== 'AIR' && cell.contents !== 'TUNNEL') {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Rubble dumps need an open excavated cell.' };
    }

    ensureRubbleState(layeredWorld);
    const key = getRubbleDropZoneKey(x, y, z);
    layeredWorld.rubbleDropZones![key] ??= {
        x,
        y,
        z,
        capacity: SUBSURFACE_RUBBLE_DUMP_CAPACITY,
        stored: 0,
    };
    layeredWorld.renderVersion = (layeredWorld.renderVersion || 0) + 1;
    return { ok: true };
}

export function fillSubsurfaceCellWithRubble(state: GameState, x: number, y: number, z: number): CommandResult {
    const layeredWorld = state.layeredWorld;
    if (!layeredWorld?.enabled) {
        return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: 'Layered world is disabled.' };
    }
    if (!isSubsurfaceLayer(layeredWorld, y)) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target layer is outside the generated world.' };
    }
    const cell = getSubsurfaceCell(layeredWorld, x, y, z);
    if (!cell) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target cell is not generated.' };
    }
    if (cell.material !== 'AIR' && cell.contents !== 'TUNNEL') {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Only an open tunnel cell can be filled with rubble.' };
    }
    if (!consumeRubble(layeredWorld, SUBSURFACE_RUBBLE_PER_BLOCK)) {
        return { ok: false, code: CommandErrorCode.INSUFFICIENT_RESOURCES, reason: 'Not enough stored rubble to fill this block.' };
    }

    cell.material = 'RUBBLE';
    cell.contents = 'RUBBLE_PILE';
    cell.revealed = true;
    cell.destructible = true;
    cell.walkable = false;
    cell.mineable = true;
    cell.resourceAmount = SUBSURFACE_RUBBLE_PER_BLOCK;
    cell.buriedMaterial = undefined;
    cell.buriedResourceAmount = undefined;
    markSubsurfaceDirty(layeredWorld, x, y, z);
    markSurfaceRubble(state, x, z);
    return { ok: true };
}

export function excavateSubsurfaceCell(
    state: GameState,
    x: number,
    y: number,
    z: number,
    options: SubsurfaceExcavationOptions = {},
): CommandResult {
    const validation = validateSubsurfaceDigTarget(state, x, y, z);
    if (!validation.ok) return validation;

    const layeredWorld = state.layeredWorld;
    const chunk = layeredWorld.chunks[layeredChunkKey(x, z)];
    const layer = chunk.layers[y];
    const cell = layer.cells[layeredCellKey(x, y, z)];

    if (cell.material === 'RUBBLE') {
        return clearRubbleCell(state, cell);
    }

    return breakSubsurfaceCellIntoRubble(state, cell, options);
}
