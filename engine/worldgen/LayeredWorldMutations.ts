import type { GameResources } from '../types/economy';
import { LayeredWorldState, WorldVoxelCell, WorldVoxelMaterial } from '../types/layeredWorld';

const CHUNK_SIZE = 16;

export interface DigVoxelSuccess {
    ok: true;
    cell: WorldVoxelCell;
    material: WorldVoxelMaterial;
    drops: Partial<Pick<GameResources, 'minerals' | 'gems' | 'stone'>>;
}

export interface DigVoxelFailure {
    ok: false;
    reason: string;
}

export type DigVoxelResult = DigVoxelSuccess | DigVoxelFailure;

function getChunkKey(x: number, z: number): string {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return `${cx},${cz}`;
}

function getCellKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
}

function getDrops(material: WorldVoxelMaterial, resourceAmount: number = 1): Partial<Pick<GameResources, 'minerals' | 'gems' | 'stone'>> {
    if (material === 'ORE') return { minerals: Math.max(4, resourceAmount) };
    if (material === 'GEMS') return { gems: Math.max(1, resourceAmount) };
    if (material === 'AUREUS_VEIN') return { minerals: 25, gems: 2 };
    if (material === 'STONE') return { stone: 2 };
    return {};
}

export function digLayeredWorldVoxel(
    layeredWorld: LayeredWorldState,
    x: number,
    y: number,
    z: number,
): DigVoxelResult {
    if (!layeredWorld.enabled) {
        return { ok: false, reason: 'Layered world is disabled.' };
    }
    if (y >= layeredWorld.surfaceY) {
        return { ok: false, reason: 'Use surface tools above ground.' };
    }
    if (y < layeredWorld.minY || y > layeredWorld.maxY) {
        return { ok: false, reason: 'Target layer is outside the generated world.' };
    }

    const chunk = layeredWorld.chunks[getChunkKey(x, z)];
    if (!chunk) {
        return { ok: false, reason: 'Target chunk is not generated.' };
    }

    const layer = chunk.layers[y];
    if (!layer) {
        return { ok: false, reason: 'Target layer is not generated.' };
    }

    const cell = layer.cells[getCellKey(x, y, z)];
    if (!cell) {
        return { ok: false, reason: 'Target cell is not generated.' };
    }
    if (!cell.mineable || !cell.destructible) {
        return { ok: false, reason: `${cell.material} cannot be excavated here.` };
    }

    const material = cell.material;
    const drops = getDrops(material, cell.resourceAmount);
    cell.material = 'AIR';
    cell.contents = 'TUNNEL';
    cell.revealed = true;
    cell.destructible = false;
    cell.walkable = true;
    cell.mineable = false;
    cell.resourceAmount = undefined;
    cell.stability = Math.max(5, cell.stability - 12);
    layer.dirty = true;
    chunk.dirty = true;
    layeredWorld.renderVersion += 1;

    return { ok: true, cell, material, drops };
}
