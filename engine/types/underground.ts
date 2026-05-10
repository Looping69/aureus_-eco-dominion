export type UndergroundHazard =
    | 'NONE'
    | 'UNSTABLE'
    | 'GAS'
    | 'WATER'
    | 'HEAT'
    | 'LOW_OXYGEN';

export type UndergroundDepositType =
    | 'NONE'
    | 'MINERALS'
    | 'GEMS'
    | 'AUREUS_VEIN'
    | 'RELIC_FRAGMENT';

export interface UndergroundDeposit {
    type: UndergroundDepositType;
    richness: number; // 0..1
}

export interface UndergroundTile {
    x: number;
    z: number;
    depth: number; // 1 = Sector B1
    stability: number; // 0..100
    oxygen: number; // 0..100
    hazard: UndergroundHazard;
    deposit: UndergroundDeposit;
}

export interface UndergroundState {
    schemaVersion: 1;
    depth: number; // 1 = Sector B1
    depthLabel: 'Sector B1';
    stability: number; // 0..100 (sector-wide)
    oxygen: number; // 0..100 (sector-wide)
    exposureRisk: number; // 0..100
    tiles: Record<string, UndergroundTile>; // surveyed / revealed tiles
    surveyedByDrill: Record<string, true>; // drill head keys: "x,z"
}

