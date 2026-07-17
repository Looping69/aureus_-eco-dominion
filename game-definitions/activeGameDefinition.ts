import { createGameDefinitionRegistry } from '../engine/game-definition/GameDefinitionRegistry';
import { AUREUS_GAME_DEFINITION } from './aureus';
import { withAureusBuildActionPayloadSchemas } from './aureusBuildActionPayloadSchemas';

const AUREUS_ACTIVE_GAME_DEFINITION = withAureusBuildActionPayloadSchemas(AUREUS_GAME_DEFINITION);

export const GAME_DEFINITION_REGISTRY = createGameDefinitionRegistry([AUREUS_ACTIVE_GAME_DEFINITION]);

export function getActiveGameDefinition() {
  return GAME_DEFINITION_REGISTRY.getActive() ?? AUREUS_ACTIVE_GAME_DEFINITION;
}

export function getActiveGameDefinitionSummary() {
  return GAME_DEFINITION_REGISTRY.getActiveSummary();
}

export const ACTIVE_GAME_DEFINITION = getActiveGameDefinition();
export const ACTIVE_GAME_DEFINITION_SUMMARY = getActiveGameDefinitionSummary();
