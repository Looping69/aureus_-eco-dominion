import { BuildingType } from '../../types';
import type { Chunk, GridTile } from '../../types';
import type { LayeredChunkState, LayeredWorldState, WorldLayerState, WorldVoxelCell, WorldVoxelMaterial } from '../types/layeredWorld';

export const LAYERED_WORLD_MIGRATION_VERSION = 1;
export const DEFAULT_LAYER_MIN_Y = -8;
export const DEFAULT_LAYER_MAX_Y = 4;
export const DEFAULT_SURFACE_LAYER_Y = 0;

const SOLID_RESOURCE_INTERVAL = 5;

function cellKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
}

function layerKey(y: number): number {
    return y;
}

function terrainMaterialForSurface(tile: GridTile): WorldVoxelMaterial {
    if (tile.terrainHeight === 0 || tile.buildingType === BuildingType.POND || tile.buildingType === BuildingType.RESERVOIR) {
        return 'WATER';
    }

    switch (tile.biome) {
        case 'SAND': return 'SAND';
        case 'SNOW': return 'SNOW';
        case 'STONE': return 'STONE';
        case 'DIRT': return 'DIRT';
        default: return 'GRASS';
    }
}

function undergroundMaterialFor(tile: GridTile, y: number): WorldVoxelMaterial {
    if (y <= DEFAULT_LAYER_MIN_Y) return 'BEDROCK';
    if (y >= -1) return tile.biome === 'SAND' ? 'SAND' : 'DIRT';

    const oreSeed = Math.abs((tile.x * 73856093) ^ (tile.z * 19349663) ^ (y * 83492791));
    if (oreSeed % 97 === 0) return 'GEMS';
    if (oreSeed % SOLID_RESOURCE_INTERVAL === 0) return 'ORE';
    if (oreSeed % 251 === 0) return 'AUREUS_VEIN';
    return 'STONE';
}

function createVoxelCell(tile: GridTile, y: number, material: WorldVoxelMaterial): WorldVoxelCell {
    const isAir = material === 'AIR';
    const isWater = material === 'WATER';
    const isBedrock = material === 'BEDROCK';
    const hasSurfaceBuilding = y === DEFAULT_SURFACE_LAYER_Y && tile.buildingType !== BuildingType.EMPTY;

    return {
        x: tile.x,
        y,
        z: tile.z,
        material: hasSurfaceBuilding ? 'BUILDING_FOUNDATION' : material,
        contents: hasSurfaceBuilding ? 'SURFACE_BUILDING' : 'NONE',
        revealed: y >= DEFAULT_SURFACE_LAYER_Y,
        destructible: !isAir && !isWater && !isBedrock && !hasSurfaceBuilding,
        walkable: isAir || y === DEFAULT_SURFACE_LAYER_Y,
        mineable: !isAir && !isWater && !isBedrock && y < DEFAULT_SURFACE_LAYER_Y,
        stability: y < DEFAULT_SURFACE_LAYER_Y ? Math.max(25, 100 + (y * 6)) : 100,
        moisture: isWater ? 100 : Math.max(0, 18 + Math.abs(y) * 3),
        resourceAmount: material === 'ORE' ? 20 : material === 'GEMS' ? 4 : material === 'AUREUS_VEIN' ? 1 : undefined,
        surfaceBuildingType: hasSurfaceBuilding ? tile.buildingType : undefined,
    };
}

function createLayer(y: number): WorldLayerState {
    return { y, cells: {}, dirty: false };
}

export function createLayeredChunkFromSurfaceChunk(
    chunkKey: string,
    chunk: Chunk,
    minY: number = DEFAULT_LAYER_MIN_Y,
    maxY: number = DEFAULT_LAYER_MAX_Y,
): LayeredChunkState {
    const layers: Record<number, WorldLayerState> = {};
    for (let y = minY; y <= maxY; y += 1) {
        layers[layerKey(y)] = createLayer(y);
    }

    for (const tile of chunk.tiles) {
        for (let y = minY; y <= maxY; y += 1) {
            let material: WorldVoxelMaterial;
            if (y > DEFAULT_SURFACE_LAYER_Y) {
                material = 'AIR';
            } else if (y === DEFAULT_SURFACE_LAYER_Y) {
                material = terrainMaterialForSurface(tile);
            } else {
                material = undergroundMaterialFor(tile, y);
            }

            layers[layerKey(y)].cells[cellKey(tile.x, y, tile.z)] = createVoxelCell(tile, y, material);
        }
    }

    return {
        key: chunkKey,
        cx: chunk.cx,
        cz: chunk.cz,
        minY,
        maxY,
        layers,
        dirty: false,
        generatedFromSurfaceVersion: chunk.version ?? 0,
    };
}

export function createLayeredWorldFromSurfaceChunks(
    chunks: Record<string, Chunk>,
    existing?: Partial<LayeredWorldState>,
): LayeredWorldState {
    const minY = existing?.minY ?? DEFAULT_LAYER_MIN_Y;
    const maxY = existing?.maxY ?? DEFAULT_LAYER_MAX_Y;
    const layeredChunks: Record<string, LayeredChunkState> = { ...(existing?.chunks || {}) };

    for (const [chunkKey, chunk] of Object.entries(chunks || {})) {
        const existingChunk = layeredChunks[chunkKey];
        const surfaceVersion = chunk.version ?? 0;
        if (!existingChunk || existingChunk.generatedFromSurfaceVersion !== surfaceVersion) {
            layeredChunks[chunkKey] = createLayeredChunkFromSurfaceChunk(chunkKey, chunk, minY, maxY);
        }
    }

    return {
        enabled: existing?.enabled ?? true,
        minY,
        maxY,
        surfaceY: DEFAULT_SURFACE_LAYER_Y,
        activeY: existing?.activeY ?? DEFAULT_SURFACE_LAYER_Y,
        chunks: layeredChunks,
        accessPoints: existing?.accessPoints ?? {},
        renderVersion: existing?.renderVersion ?? 0,
        migrationVersion: LAYERED_WORLD_MIGRATION_VERSION,
    };
}

export function normalizeLayeredWorldState(
    chunks: Record<string, Chunk>,
    existing?: Partial<LayeredWorldState>,
): LayeredWorldState {
    if (existing?.migrationVersion === LAYERED_WORLD_MIGRATION_VERSION && existing.chunks) {
        return createLayeredWorldFromSurfaceChunks(chunks, existing);
    }

    return createLayeredWorldFromSurfaceChunks(chunks, existing);
}
