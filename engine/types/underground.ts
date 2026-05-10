export type UndergroundResourceType = 'EMPTY' | 'MINERALS' | 'GEMS' | 'AUREUS_VEIN' | 'RELIC_FRAGMENT';
export type UndergroundHazardType = 'NONE' | 'INSTABILITY' | 'GAS' | 'FLOODING' | 'HEAT';

export interface UndergroundTile {
    x: number;
    z: number;
    depth: number;
    surveyed: boolean;
    stability: number;
    oxygen: number;
    exposure: number;
    resource: UndergroundResourceType;
    hazard: UndergroundHazardType;
}

export interface UndergroundState {
    sectorId: string;
    tiles: Record<string, UndergroundTile>;
}
