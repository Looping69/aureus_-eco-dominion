import { BuildingType } from '../../types';
import { ChunkStore } from '../../engine/space/ChunkStore';
import { isHarvestable } from '../../engine/utils/GameUtils';

export type SurfaceInteractionType = 'click' | 'right-click' | 'hover';

export interface SurfaceInteractionDeps {
    stateManager: any;
    dungeonInputHandler: any;
    config: {
        onTileClick?: (x: number, z: number, isTouch?: boolean) => void;
        onTileRightClick?: (x: number, z: number, isTouch?: boolean) => void;
        onAgentClick?: (agentId: string | null) => void;
        onTileHover?: (x: number | null, z: number | null) => void;
    };
    selectAgent: (agentId: string | null) => void;
    bulldozeTile: (x: number, z: number) => void;
}

const findAgentNearTile = (agents: any[], x: number, z: number) => {
    let closestAgent: any = null;
    let closestDistanceSq = Number.POSITIVE_INFINITY;

    for (const candidate of agents) {
        const ax = candidate.visualX ?? candidate.x;
        const az = candidate.visualZ ?? candidate.z;
        const dx = ax - x;
        const dz = az - z;
        const distanceSq = (dx * dx) + (dz * dz);

        if (distanceSq < closestDistanceSq) {
            closestAgent = candidate;
            closestDistanceSq = distanceSq;
        }
    }

    return closestDistanceSq <= 1.7 ? closestAgent : null;
};

export function handleSurfaceInteraction(
    x: number,
    z: number,
    type: SurfaceInteractionType,
    deps: SurfaceInteractionDeps,
    isTouch: boolean = false,
    clientX?: number,
    clientY?: number
): void {
    const state = deps.stateManager.getState();

    if (state.activeView === 'DUNGEON') {
        if (clientX !== undefined && clientY !== undefined) {
            if (type === 'click') deps.dungeonInputHandler.handleClick(clientX, clientY);
            else if (type === 'hover') deps.dungeonInputHandler.handleHover(clientX, clientY);
        }
        return;
    }

    if (type === 'hover') {
        deps.config.onTileHover?.(x, z);
        return;
    }

    const tile = ChunkStore.getTile(state.chunks, x, z);
    if (!tile) return;

    if ((state.interactionMode as string) === 'DIG') {
        const layeredWorld = state.layeredWorld;
        const activeY = layeredWorld.activeY < layeredWorld.surfaceY
            ? layeredWorld.activeY
            : layeredWorld.surfaceY - 1;
        deps.stateManager.pushCommand('DIG_VOXEL', { x, y: activeY, z });
        deps.config.onTileClick?.(x, z, isTouch);
        return;
    }

    const hasBuilding = tile.buildingType !== BuildingType.EMPTY && tile.buildingType !== BuildingType.POND;
    const isInspecting = state.interactionMode === 'INSPECT' || (state.interactionMode === 'BUILD' && !state.selectedBuilding);

    if (isInspecting) {
        const agent = findAgentNearTile(state.agents, x, z);
        if (agent) {
            deps.selectAgent(agent.id);
            deps.config.onAgentClick?.(agent.id);
            return;
        }
    }

    if (hasBuilding && isInspecting) {
        deps.selectAgent(null);
        deps.config.onTileClick?.(x, z, isTouch);
        return;
    }

    const canHarvest = isHarvestable(tile.foliage);
    if (canHarvest && !hasBuilding && state.interactionMode !== 'BULLDOZE' && (!state.selectedBuilding || state.interactionMode !== 'BUILD')) {
        deps.stateManager.pushCommand('MARK_HARVEST', { x, z });
        return;
    }

    if (type === 'right-click') {
        if (state.selectedAgentId) {
            deps.stateManager.pushCommand('COMMAND_AGENT', { agentId: state.selectedAgentId, x, z });
        }
        deps.config.onTileRightClick?.(x, z, isTouch);
        return;
    }

    if (state.interactionMode === 'BUILD' && state.selectedBuilding) {
        deps.config.onTileClick?.(x, z, isTouch);
    } else if (isInspecting) {
        deps.config.onTileClick?.(x, z, isTouch);
    } else if (state.interactionMode === 'BULLDOZE') {
        deps.bulldozeTile(x, z);
        deps.config.onTileClick?.(x, z, isTouch);
    } else if (state.interactionMode === 'TEST_DESTRUCT') {
        deps.stateManager.pushCommand('EXPLODE_TILE', { x, z, radius: 2.5, damage: 200 });
        deps.config.onTileClick?.(x, z, isTouch);
    } else {
        deps.selectAgent(null);
        deps.config.onAgentClick?.(null);
        deps.config.onTileClick?.(x, z, isTouch);
    }
}
