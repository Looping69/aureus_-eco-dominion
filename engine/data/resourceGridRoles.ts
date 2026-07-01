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

const VALID_NETWORK_TYPES = new Set<AureusResourceGridNetworkType>(['water', 'power']);
const VALID_ROLES = new Set<ResourceGridRole>(['PRODUCER', 'CARRIER', 'CONSUMER']);
const VALID_SERVICE_METRICS = new Set<ResourceGridServiceMetric>(['MANHATTAN', 'CHEBYSHEV']);

export const RESOURCE_GRID_BUILDING_ROLES: Partial<Record<BuildingType, ResourceGridBuildingRoleDef[]>> =
    buildResourceGridBuildingRoles(RESOURCE_GRID_ROLE_SCHEMA);

export function buildResourceGridBuildingRoles(
    schema: ResourceGridRoleSchemaEntry[],
): Partial<Record<BuildingType, ResourceGridBuildingRoleDef[]>> {
    const rolesByBuilding: Partial<Record<BuildingType, ResourceGridBuildingRoleDef[]>> = {};
    const seenEntries = new Set<string>();

    for (const entry of schema) {
        validateResourceGridRoleSchemaEntry(entry);

        const buildingType = BuildingType[entry.buildingType as keyof typeof BuildingType];
        const duplicateKey = `${entry.buildingType}:${entry.networkType}:${[...entry.roles].sort().join('+')}`;
        if (seenEntries.has(duplicateKey)) {
            throw new Error(`Duplicate resource grid role schema entry: ${duplicateKey}`);
        }
        seenEntries.add(duplicateKey);

        const roleDef: ResourceGridBuildingRoleDef = {
            networkType: entry.networkType,
            roles: [...entry.roles],
        };

        if (entry.serviceRadius !== undefined) roleDef.serviceRadius = entry.serviceRadius;
        if (entry.serviceMetric !== undefined) roleDef.serviceMetric = entry.serviceMetric;
        if (entry.priority !== undefined) roleDef.priority = entry.priority;
        if (entry.baseProduction !== undefined) roleDef.baseProduction = entry.baseProduction;
        if (entry.baseDemand !== undefined) roleDef.baseDemand = entry.baseDemand;
        if (entry.productionModifiers !== undefined) roleDef.productionModifiers = [...entry.productionModifiers];

        rolesByBuilding[buildingType] = [...(rolesByBuilding[buildingType] || []), roleDef];
    }

    return rolesByBuilding;
}

export function validateResourceGridRoleSchemaEntry(entry: ResourceGridRoleSchemaEntry): void {
    if (!BuildingType[entry.buildingType as keyof typeof BuildingType]) {
        throw new Error(`Unknown resource grid building type: ${entry.buildingType}`);
    }

    if (!VALID_NETWORK_TYPES.has(entry.networkType)) {
        throw new Error(`Invalid resource grid network type for ${entry.buildingType}: ${entry.networkType}`);
    }

    if (!Array.isArray(entry.roles) || entry.roles.length === 0) {
        throw new Error(`Resource grid entry for ${entry.buildingType} must declare at least one role`);
    }

    for (const role of entry.roles) {
        if (!VALID_ROLES.has(role)) {
            throw new Error(`Invalid resource grid role for ${entry.buildingType}: ${role}`);
        }
    }

    if (entry.serviceMetric !== undefined && !VALID_SERVICE_METRICS.has(entry.serviceMetric)) {
        throw new Error(`Invalid resource grid service metric for ${entry.buildingType}: ${entry.serviceMetric}`);
    }

    assertNonNegativeNumber(entry, 'serviceRadius');
    assertNonNegativeNumber(entry, 'priority');
    assertNonNegativeNumber(entry, 'baseProduction');
    assertNonNegativeNumber(entry, 'baseDemand');
}

function assertNonNegativeNumber(entry: ResourceGridRoleSchemaEntry, field: keyof Pick<ResourceGridRoleSchemaEntry, 'serviceRadius' | 'priority' | 'baseProduction' | 'baseDemand'>): void {
    const value = entry[field];
    if (value === undefined) return;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid resource grid ${field} for ${entry.buildingType}: ${value}`);
    }
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
