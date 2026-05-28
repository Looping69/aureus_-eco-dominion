import { BuildingType } from '../../types';

export type IndustrialResourceKey = 'refinedMaterials' | 'alloys' | 'machineParts';
export type IndustrialCostMap = Partial<Record<IndustrialResourceKey, number>>;

const INDUSTRIAL_BUILD_COSTS: Partial<Record<BuildingType, IndustrialCostMap>> = {
  [BuildingType.DISTRIBUTION_HUB]: { refinedMaterials: 40, machineParts: 12 },
  [BuildingType.TRAIN_STATION]: { refinedMaterials: 90, alloys: 35, machineParts: 30 },
  [BuildingType.GEOTHERMAL_PLANT]: { refinedMaterials: 80, alloys: 45, machineParts: 28 },
  [BuildingType.GREEN_TECH_LAB]: { refinedMaterials: 140, alloys: 70, machineParts: 50 },
  [BuildingType.SPACEPORT]: { refinedMaterials: 220, alloys: 120, machineParts: 90 },
};

export const INDUSTRIAL_RESOURCE_LABELS: Record<IndustrialResourceKey, string> = {
  refinedMaterials: 'Refined Materials',
  alloys: 'Alloys',
  machineParts: 'Machine Parts',
};

export function getIndustrialBuildingCosts(type: BuildingType): IndustrialCostMap {
  return INDUSTRIAL_BUILD_COSTS[type] || {};
}

export function getMissingIndustrialCosts(
  industry: Partial<Record<IndustrialResourceKey, number>> | undefined,
  costs: IndustrialCostMap,
): string[] {
  return (Object.entries(costs) as Array<[IndustrialResourceKey, number]>)
    .filter(([resource, amount]) => (industry?.[resource] || 0) < amount)
    .map(([resource, amount]) => `${amount} ${INDUSTRIAL_RESOURCE_LABELS[resource]}`);
}

export function formatIndustrialCosts(costs: IndustrialCostMap): string[] {
  return (Object.entries(costs) as Array<[IndustrialResourceKey, number]>)
    .filter(([, amount]) => amount > 0)
    .map(([resource, amount]) => `${amount} ${INDUSTRIAL_RESOURCE_LABELS[resource]}`);
}
