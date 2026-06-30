import { GameState, GridTile } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
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

            const def = BUILDINGS[tile.buildingType];
            if (!def) continue;

            const roles: ResourceGridParticipant['roles'] = [];
            let production = 0;
            let demand = 0;
            let priority = 0;
            let serviceRadius = 0;
            let serviceMetric: ResourceGridServiceMetric = 'MANHATTAN';

            const carrierDef = getResourceGridRoleDef(tile.buildingType, POWER_NETWORK_TYPE, 'CARRIER');
            const producerDef = getResourceGridRoleDef(tile.buildingType, POWER_NETWORK_TYPE, 'PRODUCER');
            if (carrierDef) {
                roles.push('CARRIER');
                serviceRadius = carrierDef.serviceRadius ?? POWER_LINE_SERVICE_RADIUS;
                serviceMetric = carrierDef.serviceMetric ?? 'MANHATTAN';
            }

            if (producerDef && def.power?.produces) {
                roles.push('PRODUCER', ...producerDef.roles.filter(role => role !== 'PRODUCER'));
                serviceRadius = producerDef.serviceRadius ?? carrierDef?.serviceRadius ?? POWER_LINE_SERVICE_RADIUS;
                serviceMetric = producerDef.serviceMetric ?? carrierDef?.serviceMetric ?? 'MANHATTAN';

                if (isStructureHead(tile)) {
                    production = getPowerProduction(tile, producerDef, isDaytime, timeOfDay, weatherEffects.solarMult, weatherEffects.windMult);
                }
            }

            if (def.power?.consumes && isStructureHead(tile)) {
                roles.push('CONSUMER');
                demand = def.power.consumes;
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
    const def = BUILDINGS[tile.buildingType];
    return Boolean(getResourceGridRoleDef(tile.buildingType, POWER_NETWORK_TYPE, 'CARRIER'))
        || Boolean(getResourceGridRoleDef(tile.buildingType, POWER_NETWORK_TYPE, 'PRODUCER'))
        || Boolean(def?.power?.consumes);
}

export function getPowerParticipantId(tile: GridTile): string {
    return getResourceParticipantId(tile, Boolean(BUILDINGS[tile.buildingType]?.power?.consumes));
}

export function isIndustrialPowerConsumer(type: GridTile['buildingType']): boolean {
    return [
        'WASH_PLANT',
        'RECYCLING_PLANT',
        'ORE_FOUNDRY',
        'GEM_REFINERY',
        'WORKSHOP',
        'GREEN_TECH_LAB',
    ].includes(type);
}

function getPowerProduction(
    tile: GridTile,
    producerDef: ResourceGridBuildingRoleDef,
    isDaytime: boolean,
    timeOfDay: number,
    solarMult: number,
    windMult: number,
): number {
    const def = BUILDINGS[tile.buildingType];
    if (!def?.power?.produces) return 0;

    let production = def.power.produces;
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
