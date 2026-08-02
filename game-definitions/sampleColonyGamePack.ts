import { defineGamePack } from '../engine/game-pack';
import { SAMPLE_COLONY_GAME_DEFINITION } from './sampleColony';

export const SAMPLE_COLONY_GAME_PACK = defineGamePack({
  id: SAMPLE_COLONY_GAME_DEFINITION.id,
  title: SAMPLE_COLONY_GAME_DEFINITION.title,
  version: SAMPLE_COLONY_GAME_DEFINITION.version,
  description: SAMPLE_COLONY_GAME_DEFINITION.description,
  genreTags: [...SAMPLE_COLONY_GAME_DEFINITION.genreTags],
  definition: SAMPLE_COLONY_GAME_DEFINITION,
  runtime: {
    worldModule: 'game-definitions/sampleColonyRuntime',
    stateModule: 'game-definitions/sampleColonyState',
    uiModule: 'game-definitions/sampleColonyUi',
  },
});
