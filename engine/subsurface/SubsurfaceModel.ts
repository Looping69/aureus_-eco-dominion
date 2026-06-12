import { BuildingType, type GameState, type LayeredWorldState, type WorldVoxelCell } from '../../types';
import { CommandErrorCode, type CommandResult } from '../kernel/Types';
import { ChunkStore } from '../space/ChunkStore';
import { CHUNK_SIZE, toChunkKey, worldToChunk } from '../utils/coords';

export const SUBSURFACE_CHUNK_SIZE = 16;
export const SUBSURFACE_FOUNDATION_VERSION = 1;
export const SUBSURFACE_OPEN_PIT_ENTRY_DEPTH = 1;
export const SUBSURFACE_TERRAIN_DROP_PER_LAYER = 1;
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

export function lowerSurfaceForOpenPit(state: GameState, x: number, z: number): boolean {
    const tile = ChunkStore.getTile(state.chunks, x, z);
    if (!tile || tile.buildingType !== BuildingType.EMPTY) return false;

    tile.terrainHeight -= SUBSURFACE_TERRAIN_DROP_PER_LAYER;
    tile.foliage = 'NONE';
    tile.markedForHarvest = false;
    tile.explored = true;
    tile.revealed = true;

    const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
    const chunkKey = toChunkKey(cx, cz);
    const surfaceChunk = state.chunks[chunkKey];
    if (surfaceChunk) {
        surfaceChunk.meshDirty = true;
        surfaceChunk.simDirty = true;
        surfaceChunk.version = (surfaceChunk.version || 0) + 1;
        const layeredChunk = state.layeredWorld.chunks[layeredChunkKey(x, z)];
        if (layeredChunk) {
            layeredChunk.generatedFromSurfaceVersion = surfaceChunk.version;
        }
        state.pendingEffects.push({ type: 'CHUNK_UPDATE', cx, cz, updates: [tile] });
    }

    return true;
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

    applySubsurfaceYield(state, getSubsurfaceResourceYield(cell));

    cell.material = 'AIR';
    cell.contents = 'TUNNEL';
    cell.revealed = true;
    cell.destructible = false;
    cell.walkable = true;
    cell.mineable = false;
    cell.resourceAmount = undefined;
    cell.stability = Math.max(5, Number(cell.stability || 100) - 12);
    layer.dirty = true;
    chunk.dirty = true;
    layeredWorld.renderVersion = (layeredWorld.renderVersion || 0) + 1;

    if (options.deformSurface) {
        lowerSurfaceForOpenPit(state, x, z);
    }

    return { ok: true };
}
