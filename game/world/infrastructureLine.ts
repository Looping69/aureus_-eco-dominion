import { BuildingType, GameState } from '../../types';

export const INFRASTRUCTURE_LINE_TYPES = new Set<BuildingType>([
    BuildingType.ROAD,
    BuildingType.PIPE,
    BuildingType.POWER_LINE,
    BuildingType.FENCE,
]);

export interface InfrastructureLinePlan {
    buildingType: BuildingType;
    finalX: number;
    finalZ: number;
    stepX: number;
    stepZ: number;
    requestedLength: number;
    available: number;
    placeCount: number;
}

export function isInfrastructureLineType(type: BuildingType | null | undefined): type is BuildingType {
    return Boolean(type && INFRASTRUCTURE_LINE_TYPES.has(type));
}

export function getInfrastructureLinePlan(
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    buildingType: BuildingType,
    state: GameState,
): InfrastructureLinePlan | null {
    if (!isInfrastructureLineType(buildingType)) return null;

    const deltaX = endX - startX;
    const deltaZ = endZ - startZ;
    const horizontal = Math.abs(deltaX) >= Math.abs(deltaZ);
    const finalX = horizontal ? endX : startX;
    const finalZ = horizontal ? startZ : endZ;
    const stepX = Math.sign(finalX - startX);
    const stepZ = Math.sign(finalZ - startZ);
    const requestedLength = Math.max(Math.abs(finalX - startX), Math.abs(finalZ - startZ)) + 1;
    const available = state.cheatsEnabled ? requestedLength : (state.inventory?.[buildingType] || 0);
    const placeCount = Math.min(requestedLength, available);

    return {
        buildingType,
        finalX,
        finalZ,
        stepX,
        stepZ,
        requestedLength,
        available,
        placeCount,
    };
}
