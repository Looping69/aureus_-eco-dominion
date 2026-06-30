import { GameState, GridTile } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { ChunkStore } from '../../space/ChunkStore';
import type { ResourceGridParticipant } from './ResourceGridSolver';

export function isStructureHead(tile: GridTile): boolean {
    return tile.structureHeadX === undefined
        || (tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ);
}

export function getStructureHeadTile(state: GameState, tile: GridTile): GridTile {
    if (isStructureHead(tile)) return tile;
    return ChunkStore.getTile(state.chunks, tile.structureHeadX!, tile.structureHeadZ!) || tile;
}

export function getStructureKey(tile: GridTile): string {
    const x = tile.structureHeadX ?? tile.x;
    const z = tile.structureHeadZ ?? tile.z;
    return `${tile.buildingType}:${x},${z}`;
}

export function getResourceParticipantId(tile: GridTile, isConsumer: boolean): string {
    if (isConsumer && isStructureHead(tile)) {
        return getStructureKey(tile);
    }
    return `${tile.x},${tile.z}`;
}

export function uniqueResourceGridRoles(roles: ResourceGridParticipant['roles']): ResourceGridParticipant['roles'] {
    return Array.from(new Set(roles));
}

export function forEachStructureFootprintTile(
    state: GameState,
    headTile: GridTile,
    visit: (tile: GridTile) => void,
): void {
    const def = BUILDINGS[headTile.buildingType];
    const width = def?.width || 1;
    const depth = def?.depth || 1;

    for (let dz = 0; dz < depth; dz++) {
        for (let dx = 0; dx < width; dx++) {
            const tile = ChunkStore.getTile(state.chunks, headTile.x + dx, headTile.z + dz);
            if (!tile || tile.buildingType !== headTile.buildingType || tile.isUnderConstruction) continue;
            visit(tile);
        }
    }
}

export function setStructureUtilityStatus(
    state: GameState,
    headTile: GridTile,
    updates: Pick<Partial<GridTile>, 'powerStatus' | 'waterStatus' | 'waterShortage'>,
): void {
    forEachStructureFootprintTile(state, headTile, (tile) => {
        Object.assign(tile, updates);
    });
}
