import { ChunkStore } from '../engine/space/ChunkStore';
import { BuildingType, SfxType } from '../types';
import type { GameCommand, GameState, LogisticsOverlayMode } from '../types';
import type { AureusWorld } from './AureusWorld';

export function reloadWorldState(world: AureusWorld, state: GameState): void {
    world.dispatch({ type: 'LOAD_GAME', payload: state });
}

export function enqueueWorldCommand(world: AureusWorld, type: GameCommand['type'], payload?: any): void {
    const state = world.getState();
    state.commandQueue.push({
        id: `ui_${type.toLowerCase()}_${Date.now()}`,
        type,
        payload,
        issuedAtTick: state.tickCount,
    });
}

export function setLayeredActiveY(state: GameState, requestedY: number): GameState {
    const layeredWorld = state.layeredWorld;
    const activeY = Math.max(layeredWorld.minY, Math.min(layeredWorld.maxY, Math.round(requestedY)));
    return {
        ...state,
        layeredWorld: {
            ...layeredWorld,
            activeY,
            renderVersion: (layeredWorld.renderVersion || 0) + 1,
        },
    };
}

export function enterDigMode(state: GameState): GameState {
    const layeredWorld = state.layeredWorld;
    const fallbackLayer = Math.max(layeredWorld.minY, layeredWorld.surfaceY - 1);
    const activeY = layeredWorld.activeY < layeredWorld.surfaceY ? layeredWorld.activeY : fallbackLayer;
    return {
        ...state,
        selectedBuilding: null,
        selectedAgentId: null,
        interactionMode: 'DIG' as any,
        layeredWorld: {
            ...layeredWorld,
            activeY,
            renderVersion: (layeredWorld.renderVersion || 0) + 1,
        },
    };
}

export function findPlannerTargetNode(state: GameState, payload: Record<string, any>) {
    const nodes = state.factory?.nodes || {};
    if (payload?.targetKey && nodes[payload.targetKey]) {
        return nodes[payload.targetKey];
    }

    if (payload?.sectorName) {
        const sectorNodes = Object.values(nodes).filter((node) => node.sectorName === payload.sectorName);
        return sectorNodes.find((node) => node.buildingType === BuildingType.TRAIN_STATION)
            || sectorNodes.find((node) => node.buildingType === BuildingType.DRONE_DEPOT)
            || sectorNodes[0]
            || null;
    }

    return null;
}

function getPlannerPreviewOffsets(buildingType?: BuildingType): Array<[number, number]> {
    if (buildingType === BuildingType.RAIL_LINE) {
        return [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [2, 0],
            [-2, 0],
            [0, 2],
            [0, -2],
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
            [0, 0],
        ];
    }

    if (buildingType === BuildingType.DRONE_DEPOT) {
        return [
            [0, 0],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
            [2, 0],
            [-2, 0],
            [0, 2],
            [0, -2],
        ];
    }

    return [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
    ];
}

export function findPlannerPreviewPosition(state: GameState, x: number, z: number, buildingType?: BuildingType) {
    const offsets = getPlannerPreviewOffsets(buildingType);

    for (const [dx, dz] of offsets) {
        const tile = ChunkStore.getTile(state.chunks, x + dx, z + dz);
        if (!tile) continue;
        if (tile.buildingType === BuildingType.EMPTY && !tile.isUnderConstruction) {
            return { x: x + dx, z: z + dz };
        }
    }

    return { x, z };
}

export function getPlannerOverlayMode(reason?: string, suggestedBuilding?: BuildingType): LogisticsOverlayMode {
    if (reason === 'ROUTE_DEBT' || suggestedBuilding === BuildingType.RAIL_LINE) {
        return 'FLOW';
    }
    if (reason === 'CONGESTION') {
        return 'CONGESTION';
    }
    if (reason === 'UNDERFED') {
        return suggestedBuilding === BuildingType.DRONE_DEPOT ? 'JUNCTIONS' : 'FLOW';
    }
    return 'FLOW';
}

export function getPlannerZoom(buildingType?: BuildingType): number {
    if (buildingType === BuildingType.RAIL_LINE) return 3.1;
    if (buildingType === BuildingType.TRAIN_STATION) return 2.6;
    if (buildingType === BuildingType.DRONE_DEPOT) return 2.35;
    if (buildingType === BuildingType.DISTRIBUTION_HUB) return 2.25;
    return 2;
}

export function claimCompletedGoal(state: GameState): GameState | null {
    const goal = state.activeGoal;
    if (!goal || !goal.completed) return null;

    const resources: GameState['resources'] = { ...state.resources };
    if (goal.reward.type === 'AGT') {
        resources.agt += goal.reward.amount;
    } else {
        resources.gems += goal.reward.amount;
    }

    const newsItem: GameState['newsFeed'][number] = {
        id: `goal_claim_${Date.now()}`,
        headline: `MISSION COMPLETE: ${goal.title} reward claimed.`,
        type: 'POSITIVE',
        timestamp: state.tickCount,
    };
    const completeEffect: GameState['pendingEffects'][number] = {
        type: 'AUDIO',
        sfx: SfxType.COMPLETE,
    };

    return {
        ...state,
        resources,
        activeGoal: null,
        newsFeed: [newsItem, ...state.newsFeed].slice(0, 8),
        pendingEffects: [...state.pendingEffects, completeEffect],
    };
}
