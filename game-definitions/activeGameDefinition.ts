import { createGameDefinitionRegistry } from '../engine/game-definition/GameDefinitionRegistry';
import { createGamePackRegistry } from '../engine/game-pack';
import { AUREUS_ACTIVE_GAME_DEFINITION, AUREUS_GAME_PACK } from './aureusGamePack';
import { SAMPLE_COLONY_GAME_PACK } from './sampleColonyGamePack';

export const GAME_PACKS = [AUREUS_GAME_PACK, SAMPLE_COLONY_GAME_PACK] as const;

export const GAME_PACK_REGISTRY = createGamePackRegistry([...GAME_PACKS]);

export function getActiveGamePack() {
  return GAME_PACK_REGISTRY.getActive() ?? AUREUS_GAME_PACK;
}

export function getActiveGamePackSummary() {
  return GAME_PACK_REGISTRY.getActiveSummary();
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
