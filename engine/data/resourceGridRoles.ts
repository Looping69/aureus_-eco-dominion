import { BuildingType } from '../../types';
import type { ResourceGridRole, ResourceGridServiceMetric } from '../sim/resourceGrid/ResourceGridSolver';

export type AureusResourceGridNetworkType = 'water' | 'power';
export type ResourceGridProductionModifier =
    | 'POND_WEATHER'
    | 'RESERVOIR_POWER_DEPENDENCY'
    | 'SOLAR_DAYLIGHT'
    | 'WIND_WEATHER';

export interface ResourceGridBuildingRoleDef {
    networkType: AureusResourceGridNetworkType;
    roles: ResourceGridRole[];
    serviceRadius?: number;
    serviceMetric?: ResourceGridServiceMetric;
    priority?: number;
    baseProduction?: number;
    baseDemand?: number;
    productionModifiers?: ResourceGridProductionModifier[];
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
    [BuildingType.POND]: [
        { networkType: 'water', roles: ['PRODUCER', 'CARRIER'], baseProduction: 5, serviceRadius: 3, serviceMetric: 'CHEBYSHEV', productionModifiers: ['POND_WEATHER'] },
    ],
    [BuildingType.WATER_WELL]: [
        { networkType: 'water', roles: ['PRODUCER', 'CARRIER'], baseProduction: 10, serviceRadius: 3, serviceMetric: 'CHEBYSHEV' },
    ],
    [BuildingType.RESERVOIR]: [
        { networkType: 'water', roles: ['PRODUCER', 'CARRIER'], baseProduction: 50, serviceRadius: 3, serviceMetric: 'CHEBYSHEV', productionModifiers: ['RESERVOIR_POWER_DEPENDENCY'] },
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 2, priority: 100 },
    ],
    [BuildingType.SOLAR_ARRAY]: [
        { networkType: 'power', roles: ['PRODUCER', 'CARRIER'], baseProduction: 5, serviceRadius: 1, serviceMetric: 'MANHATTAN', productionModifiers: ['SOLAR_DAYLIGHT'] },
    ],
    [BuildingType.WIND_TURBINE]: [
        { networkType: 'power', roles: ['PRODUCER', 'CARRIER'], baseProduction: 8, serviceRadius: 1, serviceMetric: 'MANHATTAN', productionModifiers: ['WIND_WEATHER'] },
    ],
    [BuildingType.GENERATOR]: [
        { networkType: 'power', roles: ['PRODUCER', 'CARRIER'], baseProduction: 10, serviceRadius: 1, serviceMetric: 'MANHATTAN' },
    ],
    [BuildingType.GEOTHERMAL_PLANT]: [
        { networkType: 'power', roles: ['PRODUCER', 'CARRIER'], baseProduction: 50, serviceRadius: 1, serviceMetric: 'MANHATTAN' },
    ],
    [BuildingType.STAFF_QUARTERS]: [
        { networkType: 'water', roles: ['CONSUMER'], baseDemand: 1, priority: 100 },
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 1, priority: 90 },
    ],
    [BuildingType.CANTEEN]: [
        { networkType: 'water', roles: ['CONSUMER'], baseDemand: 2 },
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 2 },
    ],
    [BuildingType.COMMUNITY_GARDEN]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 95 },
    ],
    [BuildingType.WASTE_TREATMENT]: [
        { networkType: 'water', roles: ['CONSUMER'], baseDemand: 5, priority: 90 },
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 8 },
    ],
    [BuildingType.GREEN_TECH_LAB]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 80 },
        { networkType: 'power', roles: ['CONSUMER'], priority: 70 },
    ],
    [BuildingType.WASH_PLANT]: [
        { networkType: 'water', roles: ['CONSUMER'], baseDemand: 5, priority: 65 },
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 5, priority: 70 },
    ],
    [BuildingType.RECYCLING_PLANT]: [
        { networkType: 'water', roles: ['CONSUMER'], baseDemand: 3, priority: 65 },
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 8, priority: 70 },
    ],
    [BuildingType.ORE_FOUNDRY]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 65 },
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 15, priority: 70 },
    ],
    [BuildingType.GEM_REFINERY]: [
        { networkType: 'water', roles: ['CONSUMER'], baseDemand: 3, priority: 65 },
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 10, priority: 70 },
    ],
    [BuildingType.WORKSHOP]: [
        { networkType: 'water', roles: ['CONSUMER'], priority: 65 },
        { networkType: 'power', roles: ['CONSUMER'], priority: 70 },
    ],
    [BuildingType.MINING_HEADFRAME]: [
        { networkType: 'water', roles: ['CONSUMER'], baseDemand: 2 },
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 10 },
    ],
    [BuildingType.SAWMILL]: [
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 5 },
    ],
    [BuildingType.STONE_QUARRY]: [
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 6 },
    ],
    [BuildingType.SURVEY_DRILL]: [
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 2 },
    ],
    [BuildingType.MEDICAL_BAY]: [
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 3 },
    ],
    [BuildingType.TRAINING_CENTER]: [
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 2 },
    ],
    [BuildingType.TRAIN_STATION]: [
        { networkType: 'water', roles: ['CONSUMER'], baseDemand: 2 },
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 10 },
    ],
    [BuildingType.DRONE_DEPOT]: [
        { networkType: 'water', roles: ['CONSUMER'], baseDemand: 1 },
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 14 },
    ],
    [BuildingType.DISTRIBUTION_HUB]: [
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 5 },
    ],
    [BuildingType.HYDROPONICS]: [
        { networkType: 'water', roles: ['CONSUMER'], baseDemand: 8 },
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 4 },
    ],
    [BuildingType.SPACEPORT]: [
        { networkType: 'power', roles: ['CONSUMER'], baseDemand: 100 },
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
