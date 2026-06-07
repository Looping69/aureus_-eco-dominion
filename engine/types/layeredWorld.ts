import type { BuildingType } from './buildings';

export type WorldVoxelMaterial =
    | 'AIR'
    | 'GRASS'
    | 'DIRT'
    | 'SAND'
    | 'STONE'
    | 'SNOW'
    | 'WATER'
    | 'ORE'
    | 'GEMS'
    | 'AUREUS_VEIN'
    | 'BEDROCK'
    | 'BUILDING_FOUNDATION';

export type WorldVoxelContents =
    | 'NONE'
    | 'SURFACE_BUILDING'
    | 'MINE_SHAFT'
    | 'SUPPORT_BEAM'
    | 'TUNNEL'
    | 'PIPE'
    | 'POWER_LINE';

export interface WorldVoxelCell {
    x: number;
    y: number;
    z: number;
    material: WorldVoxelMaterial;
    contents: WorldVoxelContents;
    revealed: boolean;
    destructible: boolean;
    walkable: boolean;
    mineable: boolean;
    stability: number;
    moisture: number;
    resourceAmount?: number;
    surfaceBuildingType?: BuildingType;
}

export interface WorldLayerState {
    y: number;
    cells: Record<string, WorldVoxelCell>;
    dirty: boolean;
}

export interface LayeredChunkState {
    key: string;
    cx: number;
    cz: number;
    minY: number;
    maxY: number;
    layers: Record<number, WorldLayerState>;
    dirty: boolean;
    generatedFromSurfaceVersion: number;
}

export interface LayeredWorldState {
    enabled: boolean;
    minY: number;
    maxY: number;
    surfaceY: number;
    activeY: number;
    chunks: Record<string, LayeredChunkState>;
    accessPoints: Record<string, { x: number; y: number; z: number; type: 'SURVEY_DRILL' | 'MINE_SHAFT' | 'ELEVATOR' }>;
    renderVersion: number;
    migrationVersion: number;
}
