import { BuildingType, GameState, GridTile } from '../../../types';
import { getResourceGridConsumerPriority, getResourceGridRoleDef } from '../../data/resourceGridRoles';
import type { ResourceGridBuildingRoleDef } from '../../data/resourceGridRoles';
import { getWeatherGameplayEffects } from '../../weather/weatherModel';
import { getSolarEfficiency } from '../dayNightCycle';
import type { ResourceGridParticipant, ResourceGridServiceMetric } from './ResourceGridSolver';
import { getResourceParticipantId, isStructureHead, uniqueResourceGridRoles } from './AureusResourceGridAdapterUtils';

export const POWER_NETWORK_TYPE = 'power';
export const POWER_LINE_SERVICE_RADIUS = 1;

export interface AureusPowerGridParticipantSet {
    participants: ResourceGridParticipant[];
    tilesByParticipantId: Map<string, GridTile>;
}

export function collectAureusPowerGridParticipants(state: GameState): AureusPowerGridParticipantSet {
    const participants: ResourceGridParticipant[] = [];
    const tilesByParticipantId = new Map<string, GridTile>();
    const isDaytime = state.dayNightCycle?.isDaytime ?? true;
    const timeOfDay = state.dayNightCycle?.timeOfDay ?? 12000;
    const weatherEffects = getWeatherGameplayEffects(state.weather);

    for (const chunk of Object.values(state.chunks)) {
        for (const tile of chunk.tiles) {
            if (!tile || tile.isUnderConstruction) continue;

            const roles: ResourceGridParticipant['roles'] = [];
            let production = 0;
            let demand = 0;
            let priority = 0;
            let serviceRadius = 0;
            let serviceMetric: ResourceGridServiceMetric = 'MANHATTAN';

            const carrierDef = getResourceGridRoleDef(tile.buildingType, POWER_NETWORK_TYPE, 'CARRIER');
            const producerDef = getResourceGridRoleDef(tile.buildingType, POWER_NETWORK_TYPE, 'PRODUCER');
            const consumerDef = getResourceGridRoleDef(tile.buildingType, POWER_NETWORK_TYPE, 'CONSUMER');
            if (carrierDef) {
                roles.push('CARRIER');
                serviceRadius = carrierDef.serviceRadius ?? POWER_LINE_SERVICE_RADIUS;
                serviceMetric = carrierDef.serviceMetric ?? 'MANHATTAN';
            }

            if (hasResourceGridProduction(producerDef)) {
                roles.push('PRODUCER', ...producerDef.roles.filter(role => role !== 'PRODUCER'));
                serviceRadius = producerDef.serviceRadius ?? carrierDef?.serviceRadius ?? POWER_LINE_SERVICE_RADIUS;
                serviceMetric = producerDef.serviceMetric ?? carrierDef?.serviceMetric ?? 'MANHATTAN';

                if (isStructureHead(tile)) {
                    production = getPowerProduction(tile, producerDef, isDaytime, timeOfDay, weatherEffects.solarMult, weatherEffects.windMult);
                }
            }

            if (hasResourceGridDemand(consumerDef) && isStructureHead(tile)) {
                roles.push('CONSUMER');
                demand = consumerDef.baseDemand;
                priority = getResourceGridConsumerPriority(tile.buildingType, POWER_NETWORK_TYPE);
            }

            if (roles.length === 0) continue;

            const id = getPowerParticipantId(tile);
            participants.push({
                id,
                networkType: POWER_NETWORK_TYPE,
                x: tile.x,
                z: tile.z,
                roles: uniqueResourceGridRoles(roles),
                production,
                demand,
                priority,
                serviceRadius,
                serviceMetric,
            });
            tilesByParticipantId.set(id, tile);
        }
    }

    return { participants, tilesByParticipantId };
}

export function isPowerParticipantTile(tile: GridTile): boolean {
    return Boolean(getResourceGridRoleDef(tile.buildingType, POWER_NETWORK_TYPE, 'CARRIER'))
        || hasResourceGridProduction(getResourceGridRoleDef(tile.buildingType, POWER_NETWORK_TYPE, 'PRODUCER'))
        || hasResourceGridDemand(getResourceGridRoleDef(tile.buildingType, POWER_NETWORK_TYPE, 'CONSUMER'));
}

export function getPowerParticipantId(tile: GridTile): string {
    return getResourceParticipantId(
        tile,
        hasResourceGridDemand(getResourceGridRoleDef(tile.buildingType, POWER_NETWORK_TYPE, 'CONSUMER')),
    );
}

export function isIndustrialPowerConsumer(type: BuildingType): boolean {
    return [
        BuildingType.WASH_PLANT,
        BuildingType.RECYCLING_PLANT,
        BuildingType.ORE_FOUNDRY,
        BuildingType.GEM_REFINERY,
        BuildingType.WORKSHOP,
        BuildingType.GREEN_TECH_LAB,
    ].includes(type);
}

function hasResourceGridProduction(def: ResourceGridBuildingRoleDef | undefined): def is ResourceGridBuildingRoleDef & { baseProduction: number } {
    return typeof def?.baseProduction === 'number';
}

function hasResourceGridDemand(def: ResourceGridBuildingRoleDef | undefined): def is ResourceGridBuildingRoleDef & { baseDemand: number } {
    return typeof def?.baseDemand === 'number';
}

function getPowerProduction(
    tile: GridTile,
    producerDef: ResourceGridBuildingRoleDef & { baseProduction: number },
    isDaytime: boolean,
    timeOfDay: number,
    solarMult: number,
    windMult: number,
): number {
    let production = producerDef.baseProduction;
    const modifiers = producerDef.productionModifiers || [];

    if (modifiers.includes('SOLAR_DAYLIGHT')) {
        if (!isDaytime) return 0;
        production = Math.floor(production * getSolarEfficiency(timeOfDay) * solarMult);
    }

    if (modifiers.includes('WIND_WEATHER')) {
        production = Math.floor(production * windMult);
    }

    return production;
}
