import { toChunkKey, worldToChunk, worldToLocal } from '../utils/coords';

/** Storage/indexing only: a game supplies chunk creation and the tile shape. */
export function ensureChunk<Chunk>(
    chunks: Record<string, Chunk>, cx: number, cz: number,
    createChunk: (cx: number, cz: number) => Chunk,
): Chunk {
    const key = toChunkKey(cx, cz);
    if (chunks[key]) return chunks[key];
    const chunk = createChunk(cx, cz);
    chunks[key] = chunk;
    return chunk;
}

export function getTile<Tile>(
    chunks: Record<string, { tiles: Tile[] }>, x: number, z: number, chunkSize: number,
): Tile | null {
    const { cx, cz } = worldToChunk(x, z, chunkSize);
    const chunk = chunks[toChunkKey(cx, cz)];
    if (!chunk) return null;
    const { lx, lz } = worldToLocal(x, z, chunkSize);
    return chunk.tiles[lz * chunkSize + lx];
}
