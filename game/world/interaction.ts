import { BuildingType } from '../../types';
import { ChunkStore } from '../../engine/space/ChunkStore';
import { getSubsurfaceCell } from '../../engine/subsurface/SubsurfaceModel';
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

function getActiveSubsurfaceLayer(state: any): number {
    const layeredWorld = state.layeredWorld;
    return layeredWorld.activeY < layeredWorld.surfaceY
        ? layeredWorld.activeY
        : layeredWorld.surfaceY - 1;
}

function getSelectedAgentIds(state: any): string[] {
    if (Array.isArray(state.selectedAgentIds) && state.selectedAgentIds.length > 0) {
        return state.selectedAgentIds.filter((id: any): id is string => typeof id === 'string' && id.length > 0);
    }
    return state.selectedAgentId ? [state.selectedAgentId] : [];
}

function isAttackableHostile(agent: any): boolean {
    return agent?.combat?.faction === 'HOSTILE' && !agent.combat.defeated;
}

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

    const layerToolMode = state.interactionMode as string;
    if (layerToolMode === 'DIG' || layerToolMode === 'DUMP_RUBBLE' || layerToolMode === 'FILL_RUBBLE') {
        const activeY = getActiveSubsurfaceLayer(state);
        const cell = getSubsurfaceCell(state.layeredWorld, x, activeY, z);
        const command = layerToolMode === 'DUMP_RUBBLE'
            ? 'DESIGNATE_RUBBLE_DUMP'
            : layerToolMode === 'FILL_RUBBLE'
                ? 'FILL_VOXEL'
                : cell?.material === 'RUBBLE'
                    ? 'CLEAR_RUBBLE'
                    : 'DIG_VOXEL';
        deps.stateManager.pushCommand(command, { x, y: activeY, z });
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
        const selectedAgentIds = getSelectedAgentIds(state);
        if (selectedAgentIds.length > 0) {
            const surfaceAgents = Array.isArray(state.agents) ? state.agents : [];
            const ambientNpcs = Array.isArray(state.ambientNpcs) ? state.ambientNpcs : [];
            const clickedAgent = findAgentNearTile([...surfaceAgents, ...ambientNpcs], x, z);

            if (isAttackableHostile(clickedAgent)) {
                deps.stateManager.pushCommand('COMBAT_ATTACK_TARGET', {
                    agentIds: selectedAgentIds,
                    targetAgentId: clickedAgent.id,
                });
            } else {
                for (const agentId of selectedAgentIds) {
                    deps.stateManager.pushCommand('COMMAND_AGENT', { agentId, x, z });
                }
            }
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