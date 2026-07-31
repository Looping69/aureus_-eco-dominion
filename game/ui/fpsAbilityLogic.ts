import { createQueuedGameCommandCandidateEnvelope, GAME_COMMAND_CANDIDATE_SOURCES } from '../../engine/game-definition';
import { BuildingType, SfxType, type Action, type GameCommand } from '../../types';
import type { FPSAbility } from '../../components/FPSAbilityHUD';

export const FPS_ABILITY_BY_KEY: Partial<Record<string, FPSAbility>> = {
    KeyQ: 'SCAN',
    KeyE: 'HARVEST',
    KeyR: 'RESTORE',
    KeyF: 'DIG',
    KeyG: 'MOVE',
};

const FPS_COMMAND_REASON = 'FPS ability HUD';

export interface FPSAimTarget {
    x: number;
    z: number;
    tile: any;
}

export interface FPSAbilityIntent {
    message: string;
    sfx: SfxType;
    dispatchAction?: Action;
    command?: {
        type: string;
        payload: any;
    };
}

export function findFPSAimTile(chunks: any, x: number, z: number): any | null {
    for (const chunk of Object.values(chunks || {}) as any[]) {
        const tile = chunk?.tiles?.find((candidate: any) => candidate.x === x && candidate.z === z);
        if (tile) return tile;
    }
    return null;
}

export function createFPSAimTarget(hit: any, chunks: any): FPSAimTarget | null {
    if (!hit) return null;

    const x = Math.round(hit.x);
    const z = Math.round(hit.z);
    const tile = findFPSAimTile(chunks, x, z);

    return tile ? { x, z, tile } : null;
}

export function describeFPSScanTarget(aim: FPSAimTarget): string {
    const subject = aim.tile.buildingType !== BuildingType.EMPTY
        ? String(aim.tile.buildingType).replace(/_/g, ' ')
        : aim.tile.foliage && aim.tile.foliage !== 'NONE'
            ? String(aim.tile.foliage).replace(/_/g, ' ')
            : `${String(aim.tile.biome).toLowerCase()} ground`;

    return `Scan: ${subject} at ${aim.x}, ${aim.z}. Height ${aim.tile.terrainHeight}.`;
}

export function canFPSHarvestTarget(aim: FPSAimTarget): boolean {
    return Boolean(aim.tile.foliage && aim.tile.foliage !== 'NONE');
}

export function getFPSDigLayer(layeredWorld: any): number {
    return layeredWorld.activeY < layeredWorld.surfaceY
        ? layeredWorld.activeY
        : layeredWorld.surfaceY - 1;
}

export function createFPSQueuedCommand(type: string, payload: any, tickCount: number, sequence = 0) {
    return createQueuedGameCommandCandidateEnvelope(
        type,
        payload,
        GAME_COMMAND_CANDIDATE_SOURCES.UI,
        FPS_COMMAND_REASON,
        tickCount,
        sequence,
    ) as GameCommand;
}

export function enqueueFPSQueuedCommand(commandQueue: any[] | undefined, type: string, payload: any, tickCount: number): boolean {
    if (!commandQueue) return false;

    commandQueue.push(createFPSQueuedCommand(type, payload, tickCount, commandQueue.length));
    return true;
}

export function resolveFPSAbilityIntent(ability: FPSAbility, currentState: any, aim: FPSAimTarget): FPSAbilityIntent | null {
    if (ability === 'SCAN') {
        return {
            message: describeFPSScanTarget(aim),
            sfx: SfxType.UI_CLICK,
        };
    }

    if (ability === 'HARVEST') {
        if (!canFPSHarvestTarget(aim)) {
            return {
                message: 'No harvestable foliage or surface resource on that tile.',
                sfx: SfxType.ERROR,
            };
        }

        return {
            command: { type: 'MARK_HARVEST', payload: { x: aim.x, z: aim.z } },
            message: `Marked ${String(aim.tile.foliage).replace(/_/g, ' ')} for harvest.`,
            sfx: SfxType.UI_CLICK,
        };
    }

    if (ability === 'RESTORE') {
        return {
            dispatchAction: { type: 'REHABILITATE_TILE', payload: { x: aim.x, z: aim.z } },
            message: `Restoration order placed at ${aim.x}, ${aim.z}.`,
            sfx: SfxType.UI_CLICK,
        };
    }

    if (ability === 'DIG') {
        const activeY = getFPSDigLayer(currentState.layeredWorld);
        return {
            command: { type: 'DIG_VOXEL', payload: { x: aim.x, y: activeY, z: aim.z } },
            message: `Excavation order placed at layer ${activeY}.`,
            sfx: SfxType.MINING_HIT,
        };
    }

    if (ability === 'MOVE') {
        if (!currentState.selectedAgentId) {
            return {
                message: 'No agent is linked to this first-person view.',
                sfx: SfxType.ERROR,
            };
        }

        return {
            dispatchAction: { type: 'COMMAND_AGENT', payload: { agentId: currentState.selectedAgentId, x: aim.x, z: aim.z } },
            message: `Move order sent to ${aim.x}, ${aim.z}.`,
            sfx: SfxType.UI_CLICK,
        };
    }

    return null;
}
