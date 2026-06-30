import { BuildingType, GameState, GridTile } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { getResourceGridConsumerPriority, getResourceGridRoleDef } from '../../data/resourceGridRoles';
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
            if (isWaterPipeTile(tile) || carrierDef) {
                roles.push('CARRIER');
                serviceRadius = carrierDef?.serviceRadius ?? WATER_PIPE_SERVICE_RADIUS;
                serviceMetric = carrierDef?.serviceMetric ?? 'CHEBYSHEV';
            }

            if (def?.water?.produces && isStructureHead(tile)) {
                roles.push('PRODUCER', 'CARRIER');
                production = getWaterProduction(tile, weatherEffects.waterCollectionMult);
                serviceRadius = carrierDef?.serviceRadius ?? WATER_PIPE_SERVICE_RADIUS;
                serviceMetric = carrierDef?.serviceMetric ?? 'CHEBYSHEV';
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
    return isWaterPipeTile(tile) || Boolean(def?.water?.produces || def?.water?.consumes);
}

export function getWaterParticipantId(tile: GridTile): string {
    return getResourceParticipantId(tile, Boolean(BUILDINGS[tile.buildingType]?.water?.consumes));
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
