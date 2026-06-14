import { BuildingType, type GameState, type GridTile, type LayeredWorldState, type WorldVoxelCell, type WorldVoxelMaterial } from '../../types';
import { CommandErrorCode, type CommandResult } from '../kernel/Types';
import { ChunkStore } from '../space/ChunkStore';
import { CHUNK_SIZE, toChunkKey, worldToChunk } from '../utils/coords';

export const SUBSURFACE_CHUNK_SIZE = 16;
export const SUBSURFACE_FOUNDATION_VERSION = 1;
export const SUBSURFACE_OPEN_PIT_ENTRY_DEPTH = 1;
export const SUBSURFACE_MAX_OPEN_PIT_DEPTH = 2;
export const SUBSURFACE_TERRAIN_DROP_PER_LAYER = 1;
export const SUBSURFACE_RUBBLE_PER_BLOCK = 1;
export const SUBSURFACE_RUBBLE_DUMP_CAPACITY = 24;
export const SUBSURFACE_SURFACE_RUBBLE_DUMP_CAPACITY = 48;
export const SUBSURFACE_DIG_JOB_PREFIX = 'dig_sub';
export const SUBSURFACE_CLEAR_RUBBLE_JOB_PREFIX = 'clear_sub';

const CARDINAL_NEIGHBORS = [
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 },
];

const SURFACE_REFRESH_NEIGHBORS = [
    { dx: 0, dz: 0 },
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 },
    { dx: 1, dz: 1 },
    { dx: 1, dz: -1 },
    { dx: -1, dz: 1 },
    { dx: -1, dz: -1 },
];

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

export function subsurfaceClearRubbleJobId(x: number, y: number, z: number): string {
    return `${SUBSURFACE_CLEAR_RUBBLE_JOB_PREFIX}_${x}_${y}_${z}`;
}

export function isSubsurfaceDigJob(job: { id?: string; targetY?: number }): boolean {
    return Boolean(job.id?.startsWith(`${SUBSURFACE_DIG_JOB_PREFIX}_`) || job.id?.startsWith(`${SUBSURFACE_CLEAR_RUBBLE_JOB_PREFIX}_`) || Number.isFinite(job.targetY));
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

function getSurfaceRubbleDumpCapacity(state: GameState): number {
    let capacity = 0;
    for (const chunk of Object.values(state.chunks)) {
        for (const tile of chunk.tiles) {
            if (tile.isUnderConstruction) continue;
            if (tile.structureHeadX !== undefined && (tile.structureHeadX !== tile.x || tile.structureHeadZ !== tile.z)) continue;
            if (tile.buildingType === BuildingType.RUBBLE_DUMP) {
                capacity += SUBSURFACE_SURFACE_RUBBLE_DUMP_CAPACITY;
            }
        }
    }
    return capacity;
}

function getTotalRubbleCapacity(state: GameState): number {
    ensureRubbleState(state.layeredWorld);
    const subsurfaceCapacity = Object.values(state.layeredWorld.rubbleDropZones || {})
        .reduce((total, zone) => total + zone.capacity, 0);
    return subsurfaceCapacity + getSurfaceRubbleDumpCapacity(state);
}

function hasRubbleDropCapacity(state: GameState, amount: number = SUBSURFACE_RUBBLE_PER_BLOCK): boolean {
    ensureRubbleState(state.layeredWorld);
    return (state.layeredWorld.rubbleStockpile || 0) + amount <= getTotalRubbleCapacity(state);
}

function depositRubble(state: GameState, amount: number = SUBSURFACE_RUBBLE_PER_BLOCK): boolean {
    const layeredWorld = state.layeredWorld;
    ensureRubbleState(layeredWorld);
    if (!hasRubbleDropCapacity(state, amount)) return false;

    let remaining = amount;
    const zones = Object.values(layeredWorld.rubbleDropZones || {}).sort((a, b) => (a.stored / a.capacity) - (b.stored / b.capacity));
    for (const zone of zones) {
        if (remaining <= 0) break;
        const free = Math.max(0, zone.capacity - zone.stored);
        const stored = Math.min(free, remaining);
        zone.stored += stored;
        remaining -= stored;
    }

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

    layeredWorld.rubbleStockpile = Math.max(0, (layeredWorld.rubbleStockpile || 0) - amount);
    layeredWorld.renderVersion = (layeredWorld.renderVersion || 0) + 1;
    return true;
}

function ensureOpenPitMetrics(tile: GridTile): { baseHeight: number; depth: number } {
    const existingDepth = Math.max(0, Math.min(SUBSURFACE_MAX_OPEN_PIT_DEPTH, Math.round(tile.openPitDepth ?? 0)));
    const baseHeight = tile.openPitBaseHeight ?? tile.terrainHeight + (existingDepth * SUBSURFACE_TERRAIN_DROP_PER_LAYER);
    tile.openPitBaseHeight = baseHeight;
    tile.openPitDepth = existingDepth;
    return { baseHeight, depth: existingDepth };
}

export function validateSubsurfaceDigTarget(state: GameState, x: number, y: number, z: number): CommandResult {
    const layeredWorld = state.layeredWorld;
    if (!layeredWorld?.enabled) return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: 'Layered world is disabled.' };
    if (y >= layeredWorld.surfaceY) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Use surface tools above ground.' };
    if (y < layeredWorld.surfaceY - SUBSURFACE_MAX_OPEN_PIT_DEPTH) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Open-pit cuts are limited to 2 levels. Build a shaft for deeper mining.' };
    if (!isSubsurfaceLayer(layeredWorld, y)) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target layer is outside the generated world.' };

    const tile = ChunkStore.getTile(state.chunks, x, z);
    if (!tile) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Surface tile is not loaded.' };
    if (tile.buildingType !== BuildingType.EMPTY) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Clear surface buildings before opening a pit here.' };
    if ((tile.openPitDepth ?? 0) >= SUBSURFACE_MAX_OPEN_PIT_DEPTH && y <= layeredWorld.surfaceY - SUBSURFACE_MAX_OPEN_PIT_DEPTH) {
        return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'This open pit is already at the 2-level safety limit.' };
    }

    const cell = getSubsurfaceCell(layeredWorld, x, y, z);
    if (!cell) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target cell is not generated.' };
    if (cell.material === 'RUBBLE') return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Clear rubble before digging deeper.' };
    if (!cell.mineable || !cell.destructible) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: `${cell.material} cannot be excavated here.` };

    return { ok: true };
}

export function validateSubsurfaceRubbleClearTarget(state: GameState, x: number, y: number, z: number): CommandResult {
    const layeredWorld = state.layeredWorld;
    if (!layeredWorld?.enabled) return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: 'Layered world is disabled.' };
    if (!isSubsurfaceLayer(layeredWorld, y)) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target layer is outside the generated world.' };

    const cell = getSubsurfaceCell(layeredWorld, x, y, z);
    if (!cell) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target cell is not generated.' };
    if (cell.material !== 'RUBBLE') return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Only rubble piles can be cleared.' };
    if (!hasRubbleDropCapacity(state)) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Build a Rubble Dump or designate a rubble dump with free space before clearing this pile.' };

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

    state.jobs.push({ id, type: 'MINE', targetX: x, targetY: y, targetZ: z, context: 'SURFACE_CUT', priority: 88, assignedAgentId: null, progress: 0 });
    return { ok: true };
}

export function queueSubsurfaceRubbleClearJob(state: GameState, x: number, y: number, z: number): CommandResult {
    const validation = validateSubsurfaceRubbleClearTarget(state, x, y, z);
    if (!validation.ok) return validation;

    const id = subsurfaceClearRubbleJobId(x, y, z);
    const existing = state.jobs.find(job => job.id === id);
    if (existing) {
        existing.priority = Math.max(existing.priority, 86);
        return { ok: true };
    }

    state.jobs.push({ id, type: 'MINE', targetX: x, targetY: y, targetZ: z, context: 'SURFACE_CUT', priority: 86, assignedAgentId: null, progress: 0 });
    return { ok: true };
}

export function getSubsurfaceResourceYield(cell: WorldVoxelCell): Partial<GameState['resources']> {
    const resourceAmount = Number(cell.resourceAmount || 1);
    switch (cell.material) {
        case 'ORE': return { minerals: Math.max(4, resourceAmount) };
        case 'GEMS': return { gems: Math.max(1, resourceAmount) };
        case 'AUREUS_VEIN': return { minerals: 25, gems: 2 };
        case 'STONE': return { stone: 2 };
        default: return {};
    }
}

export function applySubsurfaceYield(state: GameState, yieldResources: Partial<GameState['resources']>): void {
    state.resources.minerals += yieldResources.minerals || 0;
    state.resources.gems += yieldResources.gems || 0;
    state.resources.wood += yieldResources.wood || 0;
    state.resources.stone += yieldResources.stone || 0;
    state.resources.agt += yieldResources.agt || 0;
}

function refreshSurfaceTiles(state: GameState, coords: Array<{ x: number; z: number }>): void {
    const updatesByChunk = new Map<string, { cx: number; cz: number; updates: GridTile[] }>();
    const included = new Set<string>();

    for (const coord of coords) {
        for (const offset of SURFACE_REFRESH_NEIGHBORS) {
            const x = coord.x + offset.dx;
            const z = coord.z + offset.dz;
            const key = `${x},${z}`;
            if (included.has(key)) continue;
            included.add(key);

            const tile = ChunkStore.getTile(state.chunks, x, z);
            if (!tile) continue;
            const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
            const chunkKey = toChunkKey(cx, cz);
            const surfaceChunk = state.chunks[chunkKey];
            if (!surfaceChunk) continue;

            surfaceChunk.meshDirty = true;
            surfaceChunk.simDirty = true;
            surfaceChunk.version = (surfaceChunk.version || 0) + 1;
            const layeredChunk = state.layeredWorld.chunks[layeredChunkKey(x, z)];
            if (layeredChunk) layeredChunk.generatedFromSurfaceVersion = surfaceChunk.version;

            if (!updatesByChunk.has(chunkKey)) updatesByChunk.set(chunkKey, { cx, cz, updates: [] });
            updatesByChunk.get(chunkKey)!.updates.push(tile);
        }
    }

    for (const { cx, cz, updates } of updatesByChunk.values()) {
        state.pendingEffects.push({ type: 'CHUNK_UPDATE', cx, cz, updates });
    }
}

function refreshSurfaceTile(state: GameState, x: number, z: number): void {
    refreshSurfaceTiles(state, [{ x, z }]);
}

function isOpenPitSurfaceTile(state: GameState, x: number, z: number): boolean {
    const tile = ChunkStore.getTile(state.chunks, x, z);
    return Boolean(tile && tile.buildingType === BuildingType.EMPTY && (tile.foliage === 'ROCK_PEBBLE' || (tile.openPitDepth ?? 0) > 0));
}

function collectConnectedOpenPit(state: GameState, x: number, z: number): Array<{ x: number; z: number }> {
    const result: Array<{ x: number; z: number }> = [];
    const queue = [{ x, z }];
    const seen = new Set<string>();

    while (queue.length > 0) {
        const current = queue.shift()!;
        const key = `${current.x},${current.z}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const isSeed = current.x === x && current.z === z;
        if (!isSeed && !isOpenPitSurfaceTile(state, current.x, current.z)) continue;
        result.push(current);

        for (const offset of CARDINAL_NEIGHBORS) {
            const nx = current.x + offset.dx;
            const nz = current.z + offset.dz;
            const nKey = `${nx},${nz}`;
            if (!seen.has(nKey) && isOpenPitSurfaceTile(state, nx, nz)) queue.push({ x: nx, z: nz });
        }
    }

    return result;
}

function syncConnectedOpenPit(state: GameState, x: number, z: number): void {
    const connected = collectConnectedOpenPit(state, x, z);
    if (connected.length === 0) return;

    let targetDepth = 0;
    for (const coord of connected) {
        const tile = ChunkStore.getTile(state.chunks, coord.x, coord.z);
        if (tile) targetDepth = Math.max(targetDepth, ensureOpenPitMetrics(tile).depth);
    }
    targetDepth = Math.min(SUBSURFACE_MAX_OPEN_PIT_DEPTH, targetDepth);

    for (const coord of connected) {
        const tile = ChunkStore.getTile(state.chunks, coord.x, coord.z);
        if (tile && tile.buildingType === BuildingType.EMPTY) {
            const { baseHeight } = ensureOpenPitMetrics(tile);
            tile.openPitDepth = targetDepth;
            tile.terrainHeight = baseHeight - (targetDepth * SUBSURFACE_TERRAIN_DROP_PER_LAYER);
            tile.explored = true;
            tile.revealed = true;
        }
    }

    refreshSurfaceTiles(state, connected);
}

export function lowerSurfaceForOpenPit(state: GameState, x: number, z: number): boolean {
    const tile = ChunkStore.getTile(state.chunks, x, z);
    if (!tile || tile.buildingType !== BuildingType.EMPTY) return false;

    const { baseHeight, depth } = ensureOpenPitMetrics(tile);
    if (depth >= SUBSURFACE_MAX_OPEN_PIT_DEPTH) return false;

    const nextDepth = Math.min(SUBSURFACE_MAX_OPEN_PIT_DEPTH, depth + 1);
    tile.openPitBaseHeight = baseHeight;
    tile.openPitDepth = nextDepth;
    tile.terrainHeight = baseHeight - (nextDepth * SUBSURFACE_TERRAIN_DROP_PER_LAYER);
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
    syncConnectedOpenPit(state, x, z);
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
    const validation = validateSubsurfaceRubbleClearTarget(state, cell.x, cell.y, cell.z);
    if (!validation.ok) return validation;
    if (!depositRubble(state, SUBSURFACE_RUBBLE_PER_BLOCK)) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Build a Rubble Dump or designate a rubble dump with free space before clearing this pile.' };

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
    markSubsurfaceDirty(state.layeredWorld, cell.x, cell.y, cell.z);
    clearSurfaceRubble(state, cell.x, cell.z);
    return { ok: true };
}

export function designateRubbleDropZone(state: GameState, x: number, y: number, z: number): CommandResult {
    const layeredWorld = state.layeredWorld;
    if (!layeredWorld?.enabled) return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: 'Layered world is disabled.' };
    if (!isSubsurfaceLayer(layeredWorld, y)) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Rubble dumps must be placed on a subsurface layer.' };

    const cell = getSubsurfaceCell(layeredWorld, x, y, z);
    if (!cell) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target cell is not generated.' };
    if (cell.material !== 'AIR' && cell.contents !== 'TUNNEL') return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Rubble dumps need an open excavated cell.' };

    ensureRubbleState(layeredWorld);
    const key = getRubbleDropZoneKey(x, y, z);
    layeredWorld.rubbleDropZones![key] ??= { x, y, z, capacity: SUBSURFACE_RUBBLE_DUMP_CAPACITY, stored: 0 };
    layeredWorld.renderVersion = (layeredWorld.renderVersion || 0) + 1;
    return { ok: true };
}

export function fillSubsurfaceCellWithRubble(state: GameState, x: number, y: number, z: number): CommandResult {
    const layeredWorld = state.layeredWorld;
    if (!layeredWorld?.enabled) return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: 'Layered world is disabled.' };
    if (!isSubsurfaceLayer(layeredWorld, y)) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target layer is outside the generated world.' };

    const cell = getSubsurfaceCell(layeredWorld, x, y, z);
    if (!cell) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target cell is not generated.' };
    if (cell.material !== 'AIR' && cell.contents !== 'TUNNEL') return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Only an open tunnel cell can be filled with rubble.' };
    if (!consumeRubble(layeredWorld, SUBSURFACE_RUBBLE_PER_BLOCK)) return { ok: false, code: CommandErrorCode.INSUFFICIENT_RESOURCES, reason: 'Not enough stored rubble to fill this block.' };

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

export function excavateSubsurfaceCell(state: GameState, x: number, y: number, z: number, options: SubsurfaceExcavationOptions = {}): CommandResult {
    const layeredWorld = state.layeredWorld;
    if (!layeredWorld?.enabled) return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: 'Layered world is disabled.' };

    const cell = getSubsurfaceCell(layeredWorld, x, y, z);
    if (!cell) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target cell is not generated.' };

    if (cell.material === 'RUBBLE') return clearRubbleCell(state, cell);

    const validation = validateSubsurfaceDigTarget(state, x, y, z);
    if (!validation.ok) return validation;
    return breakSubsurfaceCellIntoRubble(state, cell, options);
}
