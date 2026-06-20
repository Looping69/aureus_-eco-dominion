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

export const canTileOpenModal = (tile: any): boolean => {
    if (!tile) return false;
    if (tile.foliage === 'MINE_HOLE') return true;
    if (tile.isUnderConstruction) return true;
    return tile.buildingType !== undefined
        && tile.buildingType !== BuildingType.EMPTY
        && tile.buildingType !== BuildingType.POND;
};
