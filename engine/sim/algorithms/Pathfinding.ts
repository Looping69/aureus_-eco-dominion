/**
 * Engine Pathfinding Algorithm (A*)
 */

import { GridTile, BuildingType } from '../../../types';
import { GRID_SIZE } from '../../utils/GameUtils';
export { GRID_SIZE };

// Costs for different terrains
export const COST = {
    ROAD: 0.5,
    BASE: 1.0,
    ROUGH: 1.5,
    OBSTACLE: 2.0
};

const getDistance = (a: number, b: number) => {
    const ax = a % GRID_SIZE, ay = Math.floor(a / GRID_SIZE);
    const bx = b % GRID_SIZE, by = Math.floor(b / GRID_SIZE);
    // Chebyshev distance (8-way movement)
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
};

const getTileCost = (tile: GridTile): number => {
    if (tile.buildingType === BuildingType.ROAD) return COST.ROAD;
    if (tile.buildingType !== BuildingType.EMPTY && !tile.isUnderConstruction && tile.buildingType !== BuildingType.POND) return 1.0; // Indoors

    switch (tile.biome) {
        case 'SAND': return COST.OBSTACLE;
        case 'SNOW': return COST.OBSTACLE;
        case 'STONE': return COST.ROUGH;
        default: return COST.BASE;
    }
};

/**
 * A* Pathfinding
 * Returns array of tile indices
 */
export function findPath(startIdx: number, endIdx: number, grid: GridTile[]): number[] | null {
    if (startIdx === endIdx) return [endIdx];

    // Early exit if target is blocked/water (unless building something there)
    // For now, assume target is reachable

    const openSet: number[] = [startIdx];
    const cameFrom = new Map<number, number>();

    const gScore = new Map<number, number>();
    gScore.set(startIdx, 0);

    const fScore = new Map<number, number>();
    fScore.set(startIdx, getDistance(startIdx, endIdx));

    const openSetHash = new Set<number>();
    openSetHash.add(startIdx);

    let iterations = 0;
    const MAX_ITERATIONS = 5000; // Performance cap

    while (openSet.length > 0) {
        iterations++;
        if (iterations > MAX_ITERATIONS) return null;

        // Simple priority queue (can be optimized)
        let current = openSet[0];
        let lowestF = fScore.get(current) ?? Infinity;

        for (let i = 1; i < openSet.length; i++) {
            const score = fScore.get(openSet[i]) ?? Infinity;
            if (score < lowestF) {
                lowestF = score;
                current = openSet[i];
            }
        }

        if (current === endIdx) {
            // Reconstruct
            const path = [current];
            let curr = current;
            while (cameFrom.has(curr)) {
                curr = cameFrom.get(curr)!;
                path.unshift(curr);
            }
            return path.slice(1); // Remove start node
        }

        // Remove current
        const idx = openSet.indexOf(current);
        openSet.splice(idx, 1);
        openSetHash.delete(current);

        // Neighbors (8-way)
        const cx = current % GRID_SIZE;
        const cy = Math.floor(current / GRID_SIZE);

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;

                const nx = cx + dx;
                const ny = cy + dy;

                if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                    const neighbor = ny * GRID_SIZE + nx;
                    const tile = grid[neighbor];

                    // Collision check
                    if (tile.buildingType === BuildingType.POND) continue;
                    if (tile.locked) continue; // Locked doors/areas

                    const moveCost = getTileCost(tile);
                    const tentativeG = (gScore.get(current) ?? Infinity) + moveCost;

                    if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
                        cameFrom.set(neighbor, current);
                        gScore.set(neighbor, tentativeG);
                        fScore.set(neighbor, tentativeG + getDistance(neighbor, endIdx));

                        if (!openSetHash.has(neighbor)) {
                            openSet.push(neighbor);
                            openSetHash.add(neighbor);
                        }
                    }
                }
            }
        }
    }

    return null;
}
