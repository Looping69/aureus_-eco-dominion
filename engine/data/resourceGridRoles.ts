import { BuildingType } from '../../types';
import type { ResourceGridRole, ResourceGridServiceMetric } from '../sim/resourceGrid/ResourceGridSolver';
import { RESOURCE_GRID_ROLE_SCHEMA } from './resourceGridRoleSchema';
import type {
    AureusResourceGridNetworkType,
    ResourceGridProductionModifier,
    ResourceGridRoleSchemaEntry,
} from './resourceGridRoleSchema';

export type { AureusResourceGridNetworkType, ResourceGridProductionModifier } from './resourceGridRoleSchema';

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

export const RESOURCE_GRID_BUILDING_ROLES: Partial<Record<BuildingType, ResourceGridBuildingRoleDef[]>> =
    buildResourceGridBuildingRoles(RESOURCE_GRID_ROLE_SCHEMA);

export function buildResourceGridBuildingRoles(
    schema: ResourceGridRoleSchemaEntry[],
): Partial<Record<BuildingType, ResourceGridBuildingRoleDef[]>> {
    const rolesByBuilding: Partial<Record<BuildingType, ResourceGridBuildingRoleDef[]>> = {};

    for (const entry of schema) {
        const buildingType = BuildingType[entry.buildingType as keyof typeof BuildingType];
        if (!buildingType) {
            throw new Error(`Unknown resource grid building type: ${entry.buildingType}`);
        }

        const roleDef: ResourceGridBuildingRoleDef = {
            networkType: entry.networkType,
            roles: [...entry.roles],
            serviceRadius: entry.serviceRadius,
            serviceMetric: entry.serviceMetric,
            priority: entry.priority,
            baseProduction: entry.baseProduction,
            baseDemand: entry.baseDemand,
            productionModifiers: entry.productionModifiers ? [...entry.productionModifiers] : undefined,
        };

        rolesByBuilding[buildingType] = [...(rolesByBuilding[buildingType] || []), roleDef];
    }

    return rolesByBuilding;
}

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
