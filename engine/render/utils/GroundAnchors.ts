export const TERRAIN_HEIGHT_SCALE = 0.5;
export const WATER_BASIN_DEPTH = 0.65;
export const WATER_SURFACE_CLEARANCE = 0.82;
export const AGENT_WATER_SUBMERGE_DEPTH = 0.28;
export const BUILDING_BASE_CLEARANCE = 0;
export const INFRASTRUCTURE_PREVIEW_CLEARANCE = 0.04;
export const INFRASTRUCTURE_ANCHOR_CLEARANCE = 0.09;

export function getTerrainSurfaceY(height: number): number {
    return height * TERRAIN_HEIGHT_SCALE;
}

export function getCarvedWaterbedY(height: number): number {
    return getTerrainSurfaceY(height) - WATER_BASIN_DEPTH;
}

export function getWaterSurfaceY(height: number): number {
    return getCarvedWaterbedY(height) + WATER_SURFACE_CLEARANCE;
}

export function getAgentWaterWadeY(height: number): number {
    return getWaterSurfaceY(height) - AGENT_WATER_SUBMERGE_DEPTH;
}

export function getBuildingAnchorY(height: number): number {
    return getTerrainSurfaceY(height) + BUILDING_BASE_CLEARANCE;
}

export function getInfrastructurePreviewY(terrainY: number): number {
    return terrainY + INFRASTRUCTURE_PREVIEW_CLEARANCE;
}

export function getInfrastructureAnchorY(terrainY: number): number {
    return terrainY + INFRASTRUCTURE_ANCHOR_CLEARANCE;
}
