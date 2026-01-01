/**
 * Game Bootstrap
 * Entry point for running Aureus on the new engine spine
 * 
 * Usage:
 *   import { bootstrap } from './game/bootstrap';
 *   const { runtime, world } = await bootstrap(document.getElementById('app'));
 */

import { WorldHost, Runtime } from '../engine';
import { ThreeRenderAdapter } from '../engine/render';
import { DebugHud } from '../engine/tools';
import { AureusWorld } from './AureusWorld';

export interface BootstrapResult {
    runtime: Runtime;
    worldHost: WorldHost;
    world: AureusWorld;
    renderer: ThreeRenderAdapter;
    debugHud: DebugHud;
}

export async function bootstrap(container: HTMLElement): Promise<BootstrapResult> {
    console.log('╔════════════════════════════════════════╗');
    console.log('║    AUREUS ENGINE v2.0 - Bootstrapping  ║');
    console.log('╚════════════════════════════════════════╝');

    // Create renderer
    const renderer = new ThreeRenderAdapter({
        antialias: true,
        shadowMap: true,
        fogEnabled: true,
        fogNear: 40,
        fogFar: 120,
    });
    renderer.init(container);

    // Create world host
    const worldHost = new WorldHost();

    // Create runtime
    const runtime = new Runtime(worldHost, {
        fixedTickRate: 60,
        maxSimStepsPerFrame: 5,
        profilerEnabled: true,
    });

    // Create and load game world
    const world = new AureusWorld(renderer);
    await worldHost.setWorld(world);

    // Create debug HUD
    const debugHud = new DebugHud({ position: 'top-right' });
    debugHud.init(container, runtime, () => renderer.getStats());

    // Update HUD periodically
    setInterval(() => debugHud.update(), 100);

    // Start engine
    runtime.start();

    console.log('[Bootstrap] Engine started');

    return {
        runtime,
        worldHost,
        world,
        renderer,
        debugHud,
    };
}

/**
 * Cleanup function for when app unmounts
 */
export function cleanup(result: BootstrapResult): void {
    result.runtime.stop();
    result.renderer.dispose();
    result.debugHud.dispose();
}
