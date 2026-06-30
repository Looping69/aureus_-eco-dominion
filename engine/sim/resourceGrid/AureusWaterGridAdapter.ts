import { BuildingType, GameState, GridTile } from '../../../types';
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

            const roles: ResourceGridParticipant['roles'] = [];
            let production = 0;
            let demand = 0;
            let priority = 0;
            let serviceRadius = 0;
            let serviceMetric: ResourceGridServiceMetric = 'CHEBYSHEV';

            const carrierDef = getResourceGridRoleDef(tile.buildingType, WATER_NETWORK_TYPE, 'CARRIER');
            const producerDef = getResourceGridRoleDef(tile.buildingType, WATER_NETWORK_TYPE, 'PRODUCER');
            const consumerDef = getResourceGridRoleDef(tile.buildingType, WATER_NETWORK_TYPE, 'CONSUMER');
            if (isWaterPipeTile(tile) || carrierDef) {
                roles.push('CARRIER');
                serviceRadius = carrierDef?.serviceRadius ?? WATER_PIPE_SERVICE_RADIUS;
                serviceMetric = carrierDef?.serviceMetric ?? 'CHEBYSHEV';
            }

            if (hasResourceGridProduction(producerDef) && isStructureHead(tile)) {
                roles.push('PRODUCER', ...producerDef.roles.filter(role => role !== 'PRODUCER'));
                production = getWaterProduction(tile, producerDef, weatherEffects.waterCollectionMult);
                serviceRadius = producerDef.serviceRadius ?? carrierDef?.serviceRadius ?? WATER_PIPE_SERVICE_RADIUS;
                serviceMetric = producerDef.serviceMetric ?? carrierDef?.serviceMetric ?? 'CHEBYSHEV';
            }

            if (hasResourceGridDemand(consumerDef) && isStructureHead(tile)) {
                roles.push('CONSUMER');
                demand = consumerDef.baseDemand;
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
    return isWaterPipeTile(tile)
        || Boolean(getResourceGridRoleDef(tile.buildingType, WATER_NETWORK_TYPE, 'CARRIER'))
        || hasResourceGridProduction(getResourceGridRoleDef(tile.buildingType, WATER_NETWORK_TYPE, 'PRODUCER'))
        || hasResourceGridDemand(getResourceGridRoleDef(tile.buildingType, WATER_NETWORK_TYPE, 'CONSUMER'));
}

export function getWaterParticipantId(tile: GridTile): string {
    return getResourceParticipantId(
        tile,
        hasResourceGridDemand(getResourceGridRoleDef(tile.buildingType, WATER_NETWORK_TYPE, 'CONSUMER')),
    );
}

function hasResourceGridProduction(def: ResourceGridBuildingRoleDef | undefined): def is ResourceGridBuildingRoleDef & { baseProduction: number } {
    return typeof def?.baseProduction === 'number';
}

function hasResourceGridDemand(def: ResourceGridBuildingRoleDef | undefined): def is ResourceGridBuildingRoleDef & { baseDemand: number } {
    return typeof def?.baseDemand === 'number';
}

function getWaterProduction(tile: GridTile, producerDef: ResourceGridBuildingRoleDef & { baseProduction: number }, waterCollectionMult: number): number {
    let production = producerDef.baseProduction;
    const modifiers = producerDef.productionModifiers || [];

    if (modifiers.includes('POND_WEATHER')) {
        production = Math.floor(production * waterCollectionMult);
    }

    if (modifiers.includes('RESERVOIR_POWER_DEPENDENCY') && tile.powerStatus !== 'CONNECTED') {
        production = Math.floor(production * 0.25);
    }

    return production;
}
