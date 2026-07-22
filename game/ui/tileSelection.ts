import { BuildingType } from '../../types';

const LINE_PLACEMENT_TYPES = new Set<BuildingType>([
    BuildingType.ROAD,
    BuildingType.PIPE,
    BuildingType.POWER_LINE,
    BuildingType.FENCE,
]);

export const isLinePlacementType = (type: BuildingType | null | undefined): type is BuildingType => {
    return Boolean(type && LINE_PLACEMENT_TYPES.has(type));
};

export const findTileInChunks = (chunks: any, x: number, z: number): any | null => {
    for (const chunk of Object.values(chunks || {}) as any[]) {
        const tile = chunk?.tiles?.find((candidate: any) => candidate.x === x && candidate.z === z);
        if (tile) return tile;
    }
    return null;
};

export const canTileOpenModal = (tile: any): boolean => {
    if (!tile) return false;
    if (tile.foliage === 'MINE_HOLE') return true;
    if (tile.isUnderConstruction) return true;
    return tile.buildingType !== undefined
        && tile.buildingType !== BuildingType.EMPTY
        && tile.buildingType !== BuildingType.POND;
};

export const canTileAtPositionOpenModal = (chunks: any, x: number, z: number): boolean => {
    return canTileOpenModal(findTileInChunks(chunks, x, z));
};
