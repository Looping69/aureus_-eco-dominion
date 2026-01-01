/**
 * Engine Space - Chunk Coordinate System
 * Utilities for chunk-space coordinates and key generation
 */

/** Chunk coordinate in chunk-space (not world-space) */
export interface ChunkCoord {
    x: number;
    y: number;
    z: number;
}

/** Chunk size in voxels - THE critical constant */
export const CHUNK_SIZE = 16;

/**
 * Generate a unique string key from chunk coordinates
 */
export const keyOf = (c: ChunkCoord): string => `${c.x},${c.y},${c.z}`;

/**
 * Parse a chunk key back to coordinates
 */
export const parseKey = (k: string): ChunkCoord => {
    const [x, y, z] = k.split(',').map(Number);
    return { x, y, z };
};

/**
 * Convert world position to chunk coordinate
 */
export const worldToChunk = (wx: number, wy: number, wz: number): ChunkCoord => ({
    x: Math.floor(wx / CHUNK_SIZE),
    y: Math.floor(wy / CHUNK_SIZE),
    z: Math.floor(wz / CHUNK_SIZE),
});

/**
 * Convert chunk coordinate to world position (chunk origin)
 */
export const chunkToWorld = (c: ChunkCoord): { x: number; y: number; z: number } => ({
    x: c.x * CHUNK_SIZE,
    y: c.y * CHUNK_SIZE,
    z: c.z * CHUNK_SIZE,
});

/**
 * Get local position within chunk
 */
export const worldToLocal = (wx: number, wy: number, wz: number) => ({
    x: ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    y: ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    z: ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
});

/**
 * Calculate Manhattan distance between chunks
 */
export const chunkDistance = (a: ChunkCoord, b: ChunkCoord): number =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);

/**
 * Calculate Chebyshev distance (max of axis deltas)
 */
export const chunkDistanceChebyshev = (a: ChunkCoord, b: ChunkCoord): number =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));

/**
 * Get all neighbor chunk coords (6 cardinal directions)
 */
export const getNeighbors6 = (c: ChunkCoord): ChunkCoord[] => [
    { x: c.x + 1, y: c.y, z: c.z },
    { x: c.x - 1, y: c.y, z: c.z },
    { x: c.x, y: c.y + 1, z: c.z },
    { x: c.x, y: c.y - 1, z: c.z },
    { x: c.x, y: c.y, z: c.z + 1 },
    { x: c.x, y: c.y, z: c.z - 1 },
];

/**
 * Get all neighbor chunk coords (26 - including diagonals)
 */
export const getNeighbors26 = (c: ChunkCoord): ChunkCoord[] => {
    const result: ChunkCoord[] = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx === 0 && dy === 0 && dz === 0) continue;
                result.push({ x: c.x + dx, y: c.y + dy, z: c.z + dz });
            }
        }
    }
    return result;
};
