import { createGameDefinitionRegistry } from '../engine/game-definition/GameDefinitionRegistry';
import { createGamePackRegistry } from '../engine/game-pack';
import { AUREUS_ACTIVE_GAME_DEFINITION, AUREUS_GAME_PACK } from './aureusGamePack';

export const GAME_PACK_REGISTRY = createGamePackRegistry([AUREUS_GAME_PACK]);

export function getActiveGamePack() {
  return GAME_PACK_REGISTRY.getActive() ?? AUREUS_GAME_PACK;
}

export function getActiveGamePackSummary() {
  return GAME_PACK_REGISTRY.getActiveSummary();
}

export const ACTIVE_GAME_PACK = getActiveGamePack();
export const ACTIVE_GAME_PACK_SUMMARY = getActiveGamePackSummary();

export const GAME_DEFINITION_REGISTRY = createGameDefinitionRegistry([ACTIVE_GAME_PACK.definition]);

export function getActiveGameDefinition() {
  return GAME_DEFINITION_REGISTRY.getActive() ?? AUREUS_ACTIVE_GAME_DEFINITION;
}

export function getActiveGameDefinitionSummary() {
  return GAME_DEFINITION_REGISTRY.getActiveSummary();
}

export const ACTIVE_GAME_DEFINITION = getActiveGameDefinition();
export const ACTIVE_GAME_DEFINITION_SUMMARY = getActiveGameDefinitionSummary();
