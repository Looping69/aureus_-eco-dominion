import { BuildingType, GameState, GridTile } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { getWeatherGameplayEffects } from '../../weather/weatherModel';
import type { ResourceGridParticipant } from './ResourceGridSolver';
import { getResourceParticipantId, isStructureHead, uniqueResourceGridRoles } from './AureusResourceGridAdapterUtils';

export const WATER_NETWORK_TYPE = 'water';
export const WATER_PIPE_SERVICE_RADIUS = 3;

export interface AureusWaterGridParticipantSet {
    participants: ResourceGridParticipant[];
    tilesByParticipantId: Map<string, GridTile>;
}

export function collectAureusWaterGridParticipants(state: GameState): AureusWaterGridParticipantSet {
    const participants: ResourceGridParticipant[] = [];
    const tilesByParticipantId = new Map<string, GridTile>();
    const weatherEffects = getWeatherGameplayEffects(state.weather);

    for (const chunk of Object.values(state.chunks)) {
        for (const tile of chunk.tiles) {
            if (!tile || tile.isUnderConstruction) continue;

            const def = BUILDINGS[tile.buildingType];
            const roles: ResourceGridParticipant['roles'] = [];
            let production = 0;
            let demand = 0;
            let priority = 0;
            let serviceRadius = 0;

            if (isWaterPipeTile(tile)) {
                roles.push('CARRIER');
                serviceRadius = WATER_PIPE_SERVICE_RADIUS;
            }

            if (def?.water?.produces && isStructureHead(tile)) {
                roles.push('PRODUCER', 'CARRIER');
                production = getWaterProduction(tile, weatherEffects.waterCollectionMult);
                serviceRadius = WATER_PIPE_SERVICE_RADIUS;
            }

            if (def?.water?.consumes && isStructureHead(tile)) {
                roles.push('CONSUMER');
                demand = def.water.consumes;
                priority = getAureusWaterPriority(tile.buildingType);
            }

            if (roles.length === 0) continue;

            const id = getWaterParticipantId(tile);
            participants.push({
                id,
                networkType: WATER_NETWORK_TYPE,
                x: tile.x,
                z: tile.z,
                roles: uniqueResourceGridRoles(roles),
                production,
                demand,
                priority,
                serviceRadius,
                serviceMetric: 'CHEBYSHEV',
            });
            tilesByParticipantId.set(id, tile);
        }
    }

    return { participants, tilesByParticipantId };
}

export function isWaterPipeTile(tile: GridTile): boolean {
    return tile.buildingType === BuildingType.PIPE || tile.undergroundPipe === true;
}

export function isWaterParticipantTile(tile: GridTile): boolean {
    const def = BUILDINGS[tile.buildingType];
    return isWaterPipeTile(tile) || Boolean(def?.water?.produces || def?.water?.consumes);
}

export function getWaterParticipantId(tile: GridTile): string {
    return getResourceParticipantId(tile, Boolean(BUILDINGS[tile.buildingType]?.water?.consumes));
}

export function getAureusWaterPriority(type: BuildingType): number {
    if (type === BuildingType.STAFF_QUARTERS) return 100;
    if (type === BuildingType.COMMUNITY_GARDEN) return 95;
    if (type === BuildingType.WASTE_TREATMENT) return 90;
    if (type === BuildingType.GREEN_TECH_LAB) return 80;
    if (isIndustrialWaterConsumer(type)) return 65;
    return 50;
}

function getWaterProduction(tile: GridTile, waterCollectionMult: number): number {
    const def = BUILDINGS[tile.buildingType];
    if (!def?.water?.produces) return 0;

    if (tile.buildingType === BuildingType.POND) {
        return Math.floor(def.water.produces * waterCollectionMult);
    }

    if (tile.buildingType === BuildingType.RESERVOIR && tile.powerStatus !== 'CONNECTED') {
        return Math.floor(def.water.produces * 0.25);
    }

    return def.water.produces;
}

function isIndustrialWaterConsumer(type: BuildingType): boolean {
    return [
        BuildingType.WASH_PLANT,
        BuildingType.RECYCLING_PLANT,
        BuildingType.ORE_FOUNDRY,
        BuildingType.GEM_REFINERY,
        BuildingType.WORKSHOP,
        BuildingType.GREEN_TECH_LAB,
    ].includes(type);
}
