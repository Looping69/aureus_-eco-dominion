import { BuildingDef, BuildingType, GridTile } from '../../../types';

export function getPowerReadability(tile: GridTile, def: BuildingDef): string | null {
    if (!def.power?.consumes) return null;
    if (tile.powerStatus === 'CONNECTED') return null;
    return 'Offline: no power';
}

export function getWaterReadability(tile: GridTile, def: BuildingDef): string | null {
    if (!def.water?.consumes) return null;
    if (tile.waterStatus === 'CONNECTED') return null;
    return 'Water-starved';
}

export function getProducerReadability(tile: GridTile, def: BuildingDef): string | null {
    if (tile.buildingType === BuildingType.RESERVOIR && def.water?.produces && tile.powerStatus !== 'CONNECTED') {
        return 'Reservoir underpowered: 25% output';
    }
    return null;
}

export function getUtilityReadability(tile: GridTile, def: BuildingDef): string[] {
    return [
        getPowerReadability(tile, def),
        getWaterReadability(tile, def),
        getProducerReadability(tile, def),
    ].filter((reason): reason is string => Boolean(reason));
}
