import { BuildingType } from '../../types';
import type { ResourceGridRole, ResourceGridServiceMetric } from '../sim/resourceGrid/ResourceGridSolver';

export type AureusResourceGridNetworkType = 'water' | 'power';

export interface ResourceGridBuildingRoleDef {
    networkType: AureusResourceGridNetworkType;
    roles: ResourceGridRole[];
    serviceRadius?: number;
    serviceMetric?: ResourceGridServiceMetric;
    priority?: number;
}

export const DEFAULT_RESOURCE_GRID_CONSUMER_PRIORITY: Record<AureusResourceGridNetworkType, number> = {
    water: 50,
    power: 50,
};

export const RESOURCE_GRID_BUILDING_ROLES: Partial<Record<BuildingType, ResourceGridBuildingRoleDef[]>> = {
    [BuildingType.PIPE]: [
        { networkType: 'water', roles: ['CARRIER'], serviceRadius: 3, serviceMetric: 'CHEBYSHEV' },
    ],
    [BuildingType.POWER_LINE]: [
        { networkType: 'power', roles: ['CARRIER'], serviceRadius: 1, serviceMetric: 'MANHATTAN' },
    ],
    [BuildingType.STAFF_QUARTERS]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 100 },
        { networkType: 'power', roles: ['CONSUMER'], priority: 90 },
    ],
    [BuildingType.COMMUNITY_GARDEN]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 95 },
    ],
    [BuildingType.WASTE_TREATMENT]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 90 },
    ],
    [BuildingType.GREEN_TECH_LAB]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 80 },
        { networkType: 'power', roles: ['CONSUMER'], priority: 70 },
    ],
    [BuildingType.RESERVOIR]: [
        { networkType: 'power', roles: ['CONSUMER'], priority: 100 },
    ],
    [BuildingType.WASH_PLANT]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 65 },
        { networkType: 'power', roles: ['CONSUMER'], priority: 70 },
    ],
    [BuildingType.RECYCLING_PLANT]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 65 },
        { networkType: 'power', roles: ['CONSUMER'], priority: 70 },
    ],
    [BuildingType.ORE_FOUNDRY]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 65 },
        { networkType: 'power', roles: ['CONSUMER'], priority: 70 },
    ],
    [BuildingType.GEM_REFINERY]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 65 },
        { networkType: 'power', roles: ['CONSUMER'], priority: 70 },
    ],
    [BuildingType.WORKSHOP]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 65 },
        { networkType: 'power', roles: ['CONSUMER'], priority: 70 },
    ],
};

export function getResourceGridRoleDef(
    buildingType: BuildingType,
    networkType: AureusResourceGridNetworkType,
    role: ResourceGridRole,
): ResourceGridBuildingRoleDef | undefined {
    return RESOURCE_GRID_BUILDING_ROLES[buildingType]
        ?.find(def => def.networkType === networkType && def.roles.includes(role));
}

export function getResourceGridConsumerPriority(
    buildingType: BuildingType,
    networkType: AureusResourceGridNetworkType,
): number {
    return getResourceGridRoleDef(buildingType, networkType, 'CONSUMER')?.priority
        ?? DEFAULT_RESOURCE_GRID_CONSUMER_PRIORITY[networkType];
}
