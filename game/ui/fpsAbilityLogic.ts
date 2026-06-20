import { BuildingType } from '../../types';
import type { FPSAbility } from '../../components/FPSAbilityHUD';

export const FPS_ABILITY_BY_KEY: Partial<Record<string, FPSAbility>> = {
    KeyQ: 'SCAN',
    KeyE: 'HARVEST',
    KeyR: 'RESTORE',
    KeyF: 'DIG',
    KeyG: 'MOVE',
};

export interface FPSAimTarget {
    x: number;
    z: number;
    tile: any;
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

export function createFPSQueuedCommand(type: string, payload: any, tickCount: number) {
    return {
        id: `fps_${type.toLowerCase()}_${Date.now()}`,
        type,
        payload,
        issuedAtTick: tickCount,
    };
}
