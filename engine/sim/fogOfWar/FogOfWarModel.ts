import { BuildingType } from '../../types/buildings';
import type { GameState } from '../../types/game';
import { CHUNK_SIZE, ChunkStore } from '../../space/ChunkStore';
import { toChunkKey, worldToChunk } from '../../utils/coords';

export interface FogRevealSource {
    x: number;
    z: number;
    radius: number;
}

export const FOG_SPAWN_REVEAL_RADIUS = 18;
export const FOG_AGENT_REVEAL_RADIUS = 10;
export const FOG_BUILDING_REVEAL_RADIUS = 7;
export const FOG_REVEAL_UPDATE_SECONDS = 0.5;

export function getFogOfWarRevealSources(state: GameState): FogRevealSource[] {
    const sources: FogRevealSource[] = [{
        x: Math.round(state.spawnX ?? 0),
        z: Math.round(state.spawnZ ?? 0),
        radius: FOG_SPAWN_REVEAL_RADIUS,
    }];

    for (const agent of state.agents || []) {
        if ((agent.layer ?? 0) !== 0) continue;
        sources.push({
            x: Math.round(agent.visualX ?? agent.x),
            z: Math.round(agent.visualZ ?? agent.z),
            radius: FOG_AGENT_REVEAL_RADIUS,
        });
    }

    for (const chunk of Object.values(state.chunks)) {
        for (const tile of chunk.tiles) {
            if (!isCompletedSurfaceStructure(tile)) continue;
            sources.push({
                x: tile.x,
                z: tile.z,
                radius: FOG_BUILDING_REVEAL_RADIUS,
            });
        }
    }

    return sources;
}

export function getFogRevealDistance(x: number, z: number, sources: FogRevealSource[]): number {
    let nearest = Number.POSITIVE_INFINITY;
    for (const source of sources) {
        const dx = x - source.x;
        const dz = z - source.z;
        nearest = Math.min(nearest, Math.sqrt((dx * dx) + (dz * dz)) - source.radius);
    }
    return nearest;
}

export function revealFogOfWarAroundSources(state: GameState, sources = getFogOfWarRevealSources(state)): boolean {
    const changedChunkKeys = new Set<string>();

    for (const source of sources) {
        const radius = Math.ceil(source.radius);
        const radiusSq = source.radius * source.radius;
        for (let z = Math.floor(source.z - radius); z <= Math.ceil(source.z + radius); z += 1) {
            for (let x = Math.floor(source.x - radius); x <= Math.ceil(source.x + radius); x += 1) {
                const dx = x - source.x;
                const dz = z - source.z;
                if ((dx * dx) + (dz * dz) > radiusSq) continue;

                const tile = ChunkStore.getTile(state.chunks, x, z);
                if (!tile || tile.fogExplored) continue;

                tile.fogExplored = true;
                const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
                changedChunkKeys.add(toChunkKey(cx, cz));
            }
        }
    }

    for (const key of changedChunkKeys) {
        const chunk = state.chunks[key];
        if (!chunk) continue;
        chunk.version += 1;
    }

    return changedChunkKeys.size > 0;
}

function isCompletedSurfaceStructure(tile: { buildingType: BuildingType; isUnderConstruction?: boolean; structureHeadX?: number; structureHeadZ?: number; x: number; z: number }): boolean {
    if (tile.buildingType === BuildingType.EMPTY || tile.buildingType === BuildingType.POND) return false;
    if (tile.isUnderConstruction) return false;
    return tile.structureHeadX === undefined || (tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ);
}
