import { RuntimeRegistry } from '../engine/game-pack/RuntimeRegistry';
import type { AureusWorld } from '../game/AureusWorld';
import type { ThreeRenderAdapter } from '../engine/render/ThreeRenderAdapter';
import type { SampleColonyWorld } from './sampleColonyRuntime';

interface PackRuntimes {
    'aureus.eco-dominion': { services: { renderer: ThreeRenderAdapter }; world: AureusWorld };
    'sample.micro-colony': { services: { storage?: Storage }; world: SampleColonyWorld };
}

/** Composition root: registering a pack never eagerly loads its implementation. */
export const PACK_RUNTIME_REGISTRY = new RuntimeRegistry<PackRuntimes>()
    .register('aureus.eco-dominion', async ({ renderer }) => {
        const { AureusWorld } = await import('../game/AureusWorld');
        return new AureusWorld(renderer);
    })
    .register('sample.micro-colony', async ({ storage }) => {
        const { SampleColonyWorld } = await import('./sampleColonyRuntime');
        return new SampleColonyWorld(storage);
    });
