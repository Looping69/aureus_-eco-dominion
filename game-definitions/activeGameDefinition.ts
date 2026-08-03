import { createGameDefinitionRegistry } from '../engine/game-definition/GameDefinitionRegistry';
import { createGamePackRegistry } from '../engine/game-pack';
import { AUREUS_ACTIVE_GAME_DEFINITION, AUREUS_GAME_PACK } from './aureusGamePack';
import { SAMPLE_COLONY_GAME_PACK } from './sampleColonyGamePack';

export const GAME_PACKS = [AUREUS_GAME_PACK, SAMPLE_COLONY_GAME_PACK] as const;

export const GAME_PACK_REGISTRY = createGamePackRegistry([...GAME_PACKS]);

const BOOTABLE_GAME_PACK_WORLD_MODULES = new Set([AUREUS_GAME_PACK.runtime.worldModule]);

export interface GamePackRuntimeDebugSummary {
  id: string;
  title: string;
  version: string;
  active: boolean;
  bootable: boolean;
  runtimeStatus: 'active' | 'bootable' | 'definition-only';
  runtimeWorldModule: string;
  fallbackPackId?: string;
  actionCount: number;
  systemCount: number;
}

export function getActiveGamePack() {
  return GAME_PACK_REGISTRY.getActive() ?? AUREUS_GAME_PACK;
}

export function getActiveGamePackSummary() {
  return GAME_PACK_REGISTRY.getActiveSummary();
}

export function canBootRegisteredGamePack(packId: string) {
  const pack = GAME_PACK_REGISTRY.get(packId);
  return pack ? BOOTABLE_GAME_PACK_WORLD_MODULES.has(pack.runtime.worldModule) : false;
}

export function getGamePackRuntimeDebugSummaries(): GamePackRuntimeDebugSummary[] {
  const activePack = getActiveGamePack();

  return GAME_PACKS.map((pack) => {
    const bootable = canBootRegisteredGamePack(pack.id);
    return {
      id: pack.id,
      title: pack.title,
      version: pack.version,
      active: pack.id === activePack.id,
      bootable,
      runtimeStatus: pack.id === activePack.id ? 'active' : bootable ? 'bootable' : 'definition-only',
      runtimeWorldModule: pack.runtime.worldModule,
      fallbackPackId: bootable ? undefined : AUREUS_GAME_PACK.id,
      actionCount: pack.definition.actions.length,
      systemCount: pack.definition.systems.length,
    };
  });
}

export const ACTIVE_GAME_PACK = getActiveGamePack();
export const ACTIVE_GAME_PACK_SUMMARY = getActiveGamePackSummary();

export const GAME_DEFINITION_REGISTRY = createGameDefinitionRegistry(GAME_PACKS.map((pack) => pack.definition));

export function getActiveGameDefinition() {
  return GAME_DEFINITION_REGISTRY.getActive() ?? AUREUS_ACTIVE_GAME_DEFINITION;
}

export function getActiveGameDefinitionSummary() {
  return GAME_DEFINITION_REGISTRY.getActiveSummary();
}

export const ACTIVE_GAME_DEFINITION = getActiveGameDefinition();
export const ACTIVE_GAME_DEFINITION_SUMMARY = getActiveGameDefinitionSummary();
