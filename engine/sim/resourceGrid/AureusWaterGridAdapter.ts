import { BuildingType, GameState, GridTile } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { getResourceGridConsumerPriority, getResourceGridRoleDef } from '../../data/resourceGridRoles';
import type { ResourceGridBuildingRoleDef } from '../../data/resourceGridRoles';
import { getWeatherGameplayEffects } from '../../weather/weatherModel';
import type { ResourceGridParticipant, ResourceGridServiceMetric } from './ResourceGridSolver';
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
            let serviceMetric: ResourceGridServiceMetric = 'CHEBYSHEV';

            const carrierDef = getResourceGridRoleDef(tile.buildingType, WATER_NETWORK_TYPE, 'CARRIER');
            const producerDef = getResourceGridRoleDef(tile.buildingType, WATER_NETWORK_TYPE, 'PRODUCER');
            if (isWaterPipeTile(tile) || carrierDef) {
                roles.push('CARRIER');
                serviceRadius = carrierDef?.serviceRadius ?? WATER_PIPE_SERVICE_RADIUS;
                serviceMetric = carrierDef?.serviceMetric ?? 'CHEBYSHEV';
            }

            if (producerDef && def?.water?.produces && isStructureHead(tile)) {
                roles.push('PRODUCER', ...producerDef.roles.filter(role => role !== 'PRODUCER'));
                production = getWaterProduction(tile, producerDef, weatherEffects.waterCollectionMult);
                serviceRadius = producerDef.serviceRadius ?? carrierDef?.serviceRadius ?? WATER_PIPE_SERVICE_RADIUS;
                serviceMetric = producerDef.serviceMetric ?? carrierDef?.serviceMetric ?? 'CHEBYSHEV';
            }

            if (def?.water?.consumes && isStructureHead(tile)) {
                roles.push('CONSUMER');
                demand = def.water.consumes;
                priority = getResourceGridConsumerPriority(tile.buildingType, WATER_NETWORK_TYPE);
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
                serviceMetric,
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
    return isWaterPipeTile(tile)
        || Boolean(getResourceGridRoleDef(tile.buildingType, WATER_NETWORK_TYPE, 'CARRIER'))
        || Boolean(getResourceGridRoleDef(tile.buildingType, WATER_NETWORK_TYPE, 'PRODUCER'))
        || Boolean(def?.water?.consumes);
}

export function getWaterParticipantId(tile: GridTile): string {
    return getResourceParticipantId(tile, Boolean(BUILDINGS[tile.buildingType]?.water?.consumes));
}

function getWaterProduction(tile: GridTile, producerDef: ResourceGridBuildingRoleDef, waterCollectionMult: number): number {
    const def = BUILDINGS[tile.buildingType];
    if (!def?.water?.produces) return 0;

    let production = def.water.produces;
    const modifiers = producerDef.productionModifiers || [];

    if (modifiers.includes('POND_WEATHER')) {
        production = Math.floor(production * waterCollectionMult);
    }

    if (modifiers.includes('RESERVOIR_POWER_DEPENDENCY') && tile.powerStatus !== 'CONNECTED') {
        production = Math.floor(production * 0.25);
    }

    return production;
}
