import { defineGameDefinition } from '../engine/game-definition';

export const SAMPLE_COLONY_GAME_DEFINITION = defineGameDefinition({
  id: 'sample.micro-colony',
  title: 'Sample Micro Colony',
  version: '0.1.0',
  description: 'A tiny non-Aureus definition used to prove the engine can register another game pack.',
  genreTags: ['sample', 'colony-sim'],
  engineCapabilities: ['game-pack-registry', 'command-validation', 'runtime-module-metadata'],
  resources: [
    {
      id: 'energy',
      label: 'Energy',
      kind: 'material',
      initial: 10,
      min: 0,
      max: 100,
      tradeable: false,
      description: 'A simple resource for sample pack validation.',
    },
  ],
  entityArchetypes: [
    {
      id: 'building.sample.hub',
      label: 'Sample Hub',
      category: 'building',
      tags: ['sample', 'hub'],
      components: {
        consumes: ['energy'],
        footprint: { width: 1, depth: 1 },
      },
      description: 'A minimal building archetype for a second game definition.',
    },
  ],
  actions: [
    {
      id: 'action.samplePing',
      label: 'Sample Ping',
      category: 'debug',
      commandType: 'SAMPLE_PING',
      target: 'none',
      payloadFields: [],
      description: 'A no-op command used to validate non-Aureus command registration.',
    },
  ],
  systems: [
    {
      id: 'system.sampleTick',
      label: 'Sample Tick System',
      module: 'game-definitions/sampleColonyRuntime',
      reads: ['resources.energy'],
      writes: ['resources.energy'],
      description: 'A placeholder runtime binding for sample pack registry validation.',
    },
  ],
});
