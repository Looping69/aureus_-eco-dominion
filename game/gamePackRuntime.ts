import { createGameDefinitionRegistry, type GameDefinitionRegistry } from '../engine/game-definition/GameDefinitionRegistry';
import type { GamePack } from '../engine/game-pack';
import { GAME_PACK_REGISTRY, getActiveGamePack } from '../game-definitions/activeGameDefinition';
import { PACK_RUNTIME_REGISTRY } from '../game-definitions/runtimeRegistry';

export type GamePackRuntimeSelectionStatus = 'selected';

export interface GamePackRuntimeSelection {
  requestedPackId: string;
  requestedPack: GamePack;
  runtimePack: GamePack;
  definitionRegistry: GameDefinitionRegistry;
  canBootRequestedPack: boolean;
  status: GamePackRuntimeSelectionStatus;
  fallbackReason?: string;
}



export function canBootGamePackRuntime(pack: GamePack): boolean {
  return PACK_RUNTIME_REGISTRY.has(pack.id);
}

export function createRuntimeDefinitionRegistry(pack: GamePack): GameDefinitionRegistry {
  return createGameDefinitionRegistry([pack.definition]);
}

export function selectGamePackRuntime(requestedPackId?: string): GamePackRuntimeSelection {
  const activePack = getActiveGamePack();
  const requestedPack = requestedPackId ? GAME_PACK_REGISTRY.get(requestedPackId) : activePack;
  if (!requestedPack) throw new Error(`Unknown game pack '${requestedPackId}'`);
  if (!canBootGamePackRuntime(requestedPack)) throw new Error(`Game pack '${requestedPack.id}' has no executable runtime`);
  return {
    requestedPackId: requestedPack.id,
    requestedPack,
    runtimePack: requestedPack,
    definitionRegistry: createRuntimeDefinitionRegistry(requestedPack),
    canBootRequestedPack: true,
    status: 'selected',
  };
}
