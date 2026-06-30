import { BuildingType, GameState, GridTile } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { getWeatherGameplayEffects } from '../../weather/weatherModel';
import { getSolarEfficiency } from '../dayNightCycle';
import type { ResourceGridParticipant } from './ResourceGridSolver';

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

            if (tile.buildingType === BuildingType.POWER_LINE) {
                roles.push('CARRIER');
                serviceRadius = POWER_LINE_SERVICE_RADIUS;
            }

            if (def.power?.produces) {
                roles.push('CARRIER');
                serviceRadius = POWER_LINE_SERVICE_RADIUS;

                if (isStructureHead(tile)) {
                    roles.push('PRODUCER');
                    production = getPowerProduction(tile, isDaytime, timeOfDay, weatherEffects.solarMult, weatherEffects.windMult);
                }
            }

            if (def.power?.consumes && isStructureHead(tile)) {
                roles.push('CONSUMER');
                demand = def.power.consumes;
                priority = getAureusPowerPriority(tile.buildingType);
            }

            if (roles.length === 0) continue;

            const id = getPowerParticipantId(tile);
            participants.push({
                id,
                networkType: POWER_NETWORK_TYPE,
                x: tile.x,
                z: tile.z,
                roles: uniqueRoles(roles),
                production,
                demand,
                priority,
                serviceRadius,
                serviceMetric: 'MANHATTAN',
            });
            tilesByParticipantId.set(id, tile);
        }
    }

    return { participants, tilesByParticipantId };
}

export function isPowerParticipantTile(tile: GridTile): boolean {
    const def = BUILDINGS[tile.buildingType];
    return tile.buildingType === BuildingType.POWER_LINE || Boolean(def?.power?.produces || def?.power?.consumes);
}

export function isStructureHead(tile: GridTile): boolean {
    return tile.structureHeadX === undefined
        || (tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ);
}

export function getStructureKey(tile: GridTile): string {
    const x = tile.structureHeadX ?? tile.x;
    const z = tile.structureHeadZ ?? tile.z;
    return `${tile.buildingType}:${x},${z}`;
}

export function getPowerParticipantId(tile: GridTile): string {
    if (isStructureHead(tile) && BUILDINGS[tile.buildingType]?.power?.consumes) {
        return getStructureKey(tile);
    }
    return `${tile.x},${tile.z}`;
}

export function getAureusPowerPriority(type: BuildingType): number {
    if (type === BuildingType.RESERVOIR) return 100;
    if (type === BuildingType.STAFF_QUARTERS) return 90;
    if (isIndustrialPowerConsumer(type)) return 70;
    return 50;
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

function getPowerProduction(
    tile: GridTile,
    isDaytime: boolean,
    timeOfDay: number,
    solarMult: number,
    windMult: number,
): number {
    const def = BUILDINGS[tile.buildingType];
    if (!def?.power?.produces) return 0;

    if (tile.buildingType === BuildingType.SOLAR_ARRAY) {
        if (!isDaytime) return 0;
        return Math.floor(def.power.produces * getSolarEfficiency(timeOfDay) * solarMult);
    }

    if (tile.buildingType === BuildingType.WIND_TURBINE) {
        return Math.floor(def.power.produces * windMult);
    }

    return def.power.produces;
}

function uniqueRoles(roles: ResourceGridParticipant['roles']): ResourceGridParticipant['roles'] {
    return Array.from(new Set(roles));
}
