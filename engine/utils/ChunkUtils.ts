
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GRID_SIZE } from './GameUtils';

export const CHUNK_SIZE = 16;
export const CHUNKS_PER_ROW = Math.ceil(GRID_SIZE / CHUNK_SIZE);

export interface ChunkId {
    x: number;
    z: number;
}

export function getChunkId(tileIndex: number): ChunkId {
    const x = tileIndex % GRID_SIZE;
    const y = Math.floor(tileIndex / GRID_SIZE);
    return {
        x: Math.floor(x / CHUNK_SIZE),
        z: Math.floor(y / CHUNK_SIZE)
    };
}

export function getChunkIndex(cx: number, cz: number): number {
    return cz * CHUNKS_PER_ROW + cx;
}

export function getChunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
}

// Get the start tile coordinates for a chunk
export function getChunkOrigin(cx: number, cz: number): { x: number, y: number } {
    return {
        x: cx * CHUNK_SIZE,
        y: cz * CHUNK_SIZE
    };
}
