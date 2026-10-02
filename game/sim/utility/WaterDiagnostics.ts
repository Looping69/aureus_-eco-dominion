import type { BuildingDef, GridTile } from '../../../types';

export type WaterDiagnosticCode = 'NONE' | 'NO_WATER_NEED' | 'NO_PIPE_CONNECTION' | 'SUPPLY_SHORTAGE';

export interface WaterDiagnostic {
    code: WaterDiagnosticCode;
    label: string | null;
    blocksProduction: boolean;
}

export function getWaterDiagnostic(tile: GridTile, def: BuildingDef): WaterDiagnostic {
    if (!def.water?.consumes) {
        return {
            code: 'NO_WATER_NEED',
            label: null,
            blocksProduction: false,
        };
    }

    if (tile.waterStatus === 'CONNECTED') {
        return {
            code: 'NONE',
            label: null,
            blocksProduction: false,
        };
    }

    if (tile.waterShortage) {
        return {
            code: 'SUPPLY_SHORTAGE',
            label: 'Water shortage: add supply',
            blocksProduction: true,
        };
    }

    return {
        code: 'NO_PIPE_CONNECTION',
        label: 'No pipe connection',
        blocksProduction: true,
    };
}
