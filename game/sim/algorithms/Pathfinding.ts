/**
 * Engine Pathfinding Algorithm (A*)
 * Surface-only 2D implementation.
 */

import { GridTile, BuildingType, Chunk } from '../../../types';
import { findGridPath } from '../../../engine/sim/algorithms/GridPathfinding';
import { CHUNK_SIZE, worldToChunk, worldToLocal } from '../../../engine/utils/coords';

// Costs for different terrains
export const COST = {
    ROAD: 0.5,
    BASE: 1.0,
    ROUGH: 1.5,
    OBSTACLE: 2.0,
    WATER: 48.0
};

const isWaterTile = (tile: GridTile): boolean => {
    return tile.terrainHeight === 0 || tile.buildingType === BuildingType.POND || tile.buildingType === BuildingType.RESERVOIR;
};

const getTileCost = (tile: GridTile): number => {
    if (tile.buildingType === BuildingType.ROAD) return COST.ROAD;
    if (isWaterTile(tile)) return COST.WATER;
    if (tile.buildingType !== BuildingType.EMPTY && !tile.isUnderConstruction) return 1.0; // Indoors

    switch (tile.biome) {
        case 'SAND': return COST.OBSTACLE;
        case 'SNOW': return COST.OBSTACLE;
        case 'STONE': return COST.ROUGH;
        default: return COST.BASE;
    }
};

/**
 * A* Pathfinding (Surface 2D)
 * Returns array of { x, z } steps
 */
export function findPath(
    startX: number, startZ: number,
    endX: number, endZ: number,
    chunks: Record<string, Chunk>
): { x: number, z: number }[] | null {
    return findGridPath(startX, startZ, endX, endZ, (x, z) => {
        const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
        const chunk = chunks[`${cx},${cz}`];
        if (!chunk) return null;
        const { lx, lz } = worldToLocal(x, z, CHUNK_SIZE);
        const tile = chunk.tiles[lx + lz * CHUNK_SIZE];
        return !tile || tile.locked ? null : getTileCost(tile);
    }, COST.OBSTACLE);
}
