import { createGameDefinitionRegistry, type GameDefinitionRegistry } from '../engine/game-definition/GameDefinitionRegistry';
import type { GamePack } from '../engine/game-pack';
import { GAME_PACK_REGISTRY, getActiveGamePack } from '../game-definitions/activeGameDefinition';
import { AUREUS_GAME_PACK } from '../game-definitions/aureusGamePack';

export type GamePackRuntimeSelectionStatus = 'selected' | 'fallback';

export interface GamePackRuntimeSelection {
  requestedPackId: string;
  requestedPack: GamePack;
  runtimePack: GamePack;
  definitionRegistry: GameDefinitionRegistry;
  canBootRequestedPack: boolean;
  status: GamePackRuntimeSelectionStatus;
  fallbackReason?: string;
}

const BOOTABLE_WORLD_MODULES = new Set([AUREUS_GAME_PACK.runtime.worldModule]);

export function canBootGamePackRuntime(pack: GamePack): boolean {
  return BOOTABLE_WORLD_MODULES.has(pack.runtime.worldModule);
}

export function createRuntimeDefinitionRegistry(pack: GamePack): GameDefinitionRegistry {
  return createGameDefinitionRegistry([pack.definition]);
}

export function selectGamePackRuntime(requestedPackId?: string): GamePackRuntimeSelection {
  const activePack = getActiveGamePack();
  const requestedPack = requestedPackId ? GAME_PACK_REGISTRY.get(requestedPackId) : activePack;
  const resolvedRequestedPack = requestedPack ?? activePack;
  const canBootRequestedPack = requestedPack !== null && canBootGamePackRuntime(resolvedRequestedPack);
  const runtimePack = canBootRequestedPack ? resolvedRequestedPack : AUREUS_GAME_PACK;
  const unknownPackReason = requestedPackId && !requestedPack ? `Unknown game pack '${requestedPackId}'` : null;
  const unsupportedRuntimeReason = requestedPack && !canBootGamePackRuntime(resolvedRequestedPack)
    ? `Game pack '${resolvedRequestedPack.id}' declares runtime '${resolvedRequestedPack.runtime.worldModule}', which is not bootable yet`
    : null;
  const fallbackReason = unknownPackReason ?? unsupportedRuntimeReason ?? undefined;

  return {
    requestedPackId: requestedPackId ?? activePack.id,
    requestedPack: resolvedRequestedPack,
    runtimePack,
    definitionRegistry: createRuntimeDefinitionRegistry(runtimePack),
    canBootRequestedPack,
    status: fallbackReason ? 'fallback' : 'selected',
    fallbackReason,
  };
}
