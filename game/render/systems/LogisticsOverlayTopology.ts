import * as THREE from 'three';
import { BuildingType, Chunk, FactoryNodeState, FactoryState } from '../../../types';
import { ChunkStore } from '../../../engine/space/ChunkStore';

export function resourceTotal(bucket: Partial<Record<string, number>>) {
    return Object.values(bucket).reduce((sum, value) => sum + (value || 0), 0);
}

export function isRecentlyActive(node: FactoryNodeState, lastTick: number) {
    return lastTick - node.lastActiveTick <= 90 || resourceTotal(node.buffer) > 0 || resourceTotal(node.inputBuffer) > 0;
}

export function getFactoryNeighbors(factory: FactoryState, node: FactoryNodeState): FactoryNodeState[] {
    const keys = [
        `${node.x + 1},${node.z}`,
        `${node.x - 1},${node.z}`,
        `${node.x},${node.z + 1}`,
        `${node.x},${node.z - 1}`,
    ];
    return keys.map((key) => factory.nodes[key]).filter(Boolean) as FactoryNodeState[];
}

export function isJunctionNode(factory: FactoryState, node: FactoryNodeState): boolean {
    if (node.buildingType === BuildingType.DISTRIBUTION_HUB || node.buildingType === BuildingType.TRAIN_STATION || node.buildingType === BuildingType.DRONE_DEPOT) return true;
    if (node.buildingType !== BuildingType.RAIL_LINE) return false;
    return getFactoryNeighbors(factory, node).length > 2;
}

export function isDroneHubNode(node: FactoryNodeState): boolean {
    return node.buildingType === BuildingType.TRAIN_STATION || node.buildingType === BuildingType.DRONE_DEPOT;
}

export function getNodeWorldPosition(node: FactoryNodeState, chunks: Record<string, Chunk>) {
    const tile = ChunkStore.getTile(chunks, node.x, node.z);
    return new THREE.Vector3(node.x, (tile?.terrainHeight || 0) * 0.5, node.z);
}

export function getTargetChunks(chunks: Record<string, Chunk>, affectedChunkKeys?: Set<string>): Chunk[] {
    if (!affectedChunkKeys || affectedChunkKeys.size === 0) {
        return Object.values(chunks);
    }
    return [...affectedChunkKeys]
        .map((key) => chunks[key])
        .filter((chunk): chunk is Chunk => Boolean(chunk));
}
