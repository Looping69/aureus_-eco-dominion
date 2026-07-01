import { BuildingType } from '../../../types';
import type { BuildingDef, GridTile } from '../../../types';
import { getWaterDiagnostic } from './WaterDiagnostics';

export function getPowerReadability(tile: GridTile, def: BuildingDef): string | null {
    if (!def.power?.consumes) return null;
    if (tile.buildingType === BuildingType.RESERVOIR && def.water?.produces) return null;
    if (tile.powerStatus === 'CONNECTED') return null;
    return 'Offline: no power';
}

export function getWaterReadability(tile: GridTile, def: BuildingDef): string | null {
    return getWaterDiagnostic(tile, def).label;
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
