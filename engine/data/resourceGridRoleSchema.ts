import type { ResourceGridRole, ResourceGridServiceMetric } from '../sim/resourceGrid/ResourceGridSolver';

export type AureusResourceGridNetworkType = 'water' | 'power';
export type ResourceGridProductionModifier =
    | 'POND_WEATHER'
    | 'RESERVOIR_POWER_DEPENDENCY'
    | 'SOLAR_DAYLIGHT'
    | 'WIND_WEATHER';

export interface ResourceGridRoleSchemaEntry {
    buildingType: string;
    networkType: AureusResourceGridNetworkType;
    roles: ResourceGridRole[];
    serviceRadius?: number;
    serviceMetric?: ResourceGridServiceMetric;
    priority?: number;
    baseProduction?: number;
    baseDemand?: number;
    productionModifiers?: ResourceGridProductionModifier[];
}

export const RESOURCE_GRID_ROLE_SCHEMA: ResourceGridRoleSchemaEntry[] = [
    { buildingType: 'PIPE', networkType: 'water', roles: ['CARRIER'], serviceRadius: 3, serviceMetric: 'CHEBYSHEV' },
    { buildingType: 'POWER_LINE', networkType: 'power', roles: ['CARRIER'], serviceRadius: 1, serviceMetric: 'MANHATTAN' },
    { buildingType: 'POND', networkType: 'water', roles: ['PRODUCER', 'CARRIER'], baseProduction: 5, serviceRadius: 3, serviceMetric: 'CHEBYSHEV', productionModifiers: ['POND_WEATHER'] },
    { buildingType: 'WATER_WELL', networkType: 'water', roles: ['PRODUCER', 'CARRIER'], baseProduction: 10, serviceRadius: 3, serviceMetric: 'CHEBYSHEV' },
    { buildingType: 'RESERVOIR', networkType: 'water', roles: ['PRODUCER', 'CARRIER'], baseProduction: 50, serviceRadius: 3, serviceMetric: 'CHEBYSHEV', productionModifiers: ['RESERVOIR_POWER_DEPENDENCY'] },
    { buildingType: 'RESERVOIR', networkType: 'power', roles: ['CONSUMER'], baseDemand: 2, priority: 100 },
    { buildingType: 'SOLAR_ARRAY', networkType: 'power', roles: ['PRODUCER', 'CARRIER'], baseProduction: 5, serviceRadius: 1, serviceMetric: 'MANHATTAN', productionModifiers: ['SOLAR_DAYLIGHT'] },
    { buildingType: 'WIND_TURBINE', networkType: 'power', roles: ['PRODUCER', 'CARRIER'], baseProduction: 8, serviceRadius: 1, serviceMetric: 'MANHATTAN', productionModifiers: ['WIND_WEATHER'] },
    { buildingType: 'GENERATOR', networkType: 'power', roles: ['PRODUCER', 'CARRIER'], baseProduction: 10, serviceRadius: 1, serviceMetric: 'MANHATTAN' },
    { buildingType: 'GEOTHERMAL_PLANT', networkType: 'power', roles: ['PRODUCER', 'CARRIER'], baseProduction: 50, serviceRadius: 1, serviceMetric: 'MANHATTAN' },
    { buildingType: 'STAFF_QUARTERS', networkType: 'water', roles: ['CONSUMER'], baseDemand: 1, priority: 100 },
    { buildingType: 'STAFF_QUARTERS', networkType: 'power', roles: ['CONSUMER'], baseDemand: 1, priority: 90 },
    { buildingType: 'CANTEEN', networkType: 'water', roles: ['CONSUMER'], baseDemand: 2 },
    { buildingType: 'CANTEEN', networkType: 'power', roles: ['CONSUMER'], baseDemand: 2 },
    { buildingType: 'COMMUNITY_GARDEN', networkType: 'water', roles: ['CONSUMER'], priority: 95 },
    { buildingType: 'WASTE_TREATMENT', networkType: 'water', roles: ['CONSUMER'], baseDemand: 5, priority: 90 },
    { buildingType: 'WASTE_TREATMENT', networkType: 'power', roles: ['CONSUMER'], baseDemand: 8 },
    { buildingType: 'GREEN_TECH_LAB', networkType: 'water', roles: ['CONSUMER'], priority: 80 },
    { buildingType: 'GREEN_TECH_LAB', networkType: 'power', roles: ['CONSUMER'], priority: 70 },
    { buildingType: 'WASH_PLANT', networkType: 'water', roles: ['CONSUMER'], baseDemand: 5, priority: 65 },
    { buildingType: 'WASH_PLANT', networkType: 'power', roles: ['CONSUMER'], baseDemand: 5, priority: 70 },
    { buildingType: 'RECYCLING_PLANT', networkType: 'water', roles: ['CONSUMER'], baseDemand: 3, priority: 65 },
    { buildingType: 'RECYCLING_PLANT', networkType: 'power', roles: ['CONSUMER'], baseDemand: 8, priority: 70 },
    { buildingType: 'ORE_FOUNDRY', networkType: 'water', roles: ['CONSUMER'], priority: 65 },
    { buildingType: 'ORE_FOUNDRY', networkType: 'power', roles: ['CONSUMER'], baseDemand: 15, priority: 70 },
    { buildingType: 'GEM_REFINERY', networkType: 'water', roles: ['CONSUMER'], baseDemand: 3, priority: 65 },
    { buildingType: 'GEM_REFINERY', networkType: 'power', roles: ['CONSUMER'], baseDemand: 10, priority: 70 },
    { buildingType: 'WORKSHOP', networkType: 'water', roles: ['CONSUMER'], priority: 65 },
    { buildingType: 'WORKSHOP', networkType: 'power', roles: ['CONSUMER'], priority: 70 },
    { buildingType: 'MINING_HEADFRAME', networkType: 'water', roles: ['CONSUMER'], baseDemand: 2 },
    { buildingType: 'MINING_HEADFRAME', networkType: 'power', roles: ['CONSUMER'], baseDemand: 10 },
    { buildingType: 'SAWMILL', networkType: 'power', roles: ['CONSUMER'], baseDemand: 5 },
    { buildingType: 'STONE_QUARRY', networkType: 'power', roles: ['CONSUMER'], baseDemand: 6 },
    { buildingType: 'SURVEY_DRILL', networkType: 'power', roles: ['CONSUMER'], baseDemand: 2 },
    { buildingType: 'MEDICAL_BAY', networkType: 'power', roles: ['CONSUMER'], baseDemand: 3 },
    { buildingType: 'TRAINING_CENTER', networkType: 'power', roles: ['CONSUMER'], baseDemand: 2 },
    { buildingType: 'TRAIN_STATION', networkType: 'water', roles: ['CONSUMER'], baseDemand: 2 },
    { buildingType: 'TRAIN_STATION', networkType: 'power', roles: ['CONSUMER'], baseDemand: 10 },
    { buildingType: 'DRONE_DEPOT', networkType: 'water', roles: ['CONSUMER'], baseDemand: 1 },
    { buildingType: 'DRONE_DEPOT', networkType: 'power', roles: ['CONSUMER'], baseDemand: 14 },
    { buildingType: 'DISTRIBUTION_HUB', networkType: 'power', roles: ['CONSUMER'], baseDemand: 5 },
    { buildingType: 'HYDROPONICS', networkType: 'water', roles: ['CONSUMER'], baseDemand: 8 },
    { buildingType: 'HYDROPONICS', networkType: 'power', roles: ['CONSUMER'], baseDemand: 4 },
    { buildingType: 'SPACEPORT', networkType: 'power', roles: ['CONSUMER'], baseDemand: 100 },
];
