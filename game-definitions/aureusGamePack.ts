import { defineGamePack } from '../engine/game-pack';
import type { GameDefinition } from '../engine/game-definition';
import { AUREUS_GAME_DEFINITION } from './aureus';
import { withAureusBuildActionPayloadSchemas } from './aureusBuildActionPayloadSchemas';

export const AUREUS_ACTIVE_GAME_DEFINITION: GameDefinition = withAureusBuildActionPayloadSchemas(AUREUS_GAME_DEFINITION);

export const AUREUS_GAME_PACK = defineGamePack({
  id: AUREUS_ACTIVE_GAME_DEFINITION.id,
  title: AUREUS_ACTIVE_GAME_DEFINITION.title,
  version: AUREUS_ACTIVE_GAME_DEFINITION.version,
  description: AUREUS_ACTIVE_GAME_DEFINITION.description,
  genreTags: [...AUREUS_ACTIVE_GAME_DEFINITION.genreTags],
  definition: AUREUS_ACTIVE_GAME_DEFINITION,
  runtime: {
    worldModule: 'game/AureusWorld',
    stateModule: 'game/useAureusEngine',
    uiModule: 'App',
  },
});
