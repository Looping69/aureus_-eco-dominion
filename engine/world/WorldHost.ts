/**
 * Engine World - World Host
 * Manages world lifecycle and dispatches frame phases to active world
 */

import { World, WorldState } from './World';
import { FrameContext, FixedContext } from '../kernel/Types';
import { engineEvents } from '../kernel/EventBus';

export class WorldHost {
    private currentWorld: World | null = null;
    private pendingWorld: World | null = null;
    private isTransitioning = false;

    /**
     * Get the currently active world
     */
    get world(): World | null {
        return this.currentWorld;
    }

    /**
     * Get current world state
     */
    get state(): WorldState {
        return this.currentWorld?.state ?? 'uninitialized';
    }

    /**
     * Load a new world, unloading the current one if present
     */
    async setWorld(world: World): Promise<void> {
        if (this.isTransitioning) {
            throw new Error('Cannot set world during transition');
        }

        this.isTransitioning = true;
        this.pendingWorld = world;

        try {
            // Teardown current world
            if (this.currentWorld) {
                engineEvents.emit('world:unload', { worldId: this.currentWorld.id });
                await this.currentWorld.teardown();
            }

            // Initialize new world
            engineEvents.emit('world:load', { worldId: world.id });
            await world.init();

            this.currentWorld = world;
            this.pendingWorld = null;
            engineEvents.emit('world:ready', { worldId: world.id });

        } catch (error) {
            console.error('[WorldHost] Failed to set world:', error);
            this.pendingWorld = null;
            throw error;
        } finally {
            this.isTransitioning = false;
        }
    }

    /**
     * Unload current world without loading a new one
     */
    async unloadWorld(): Promise<void> {
        if (!this.currentWorld) return;

        this.isTransitioning = true;
        try {
            engineEvents.emit('world:unload', { worldId: this.currentWorld.id });
            await this.currentWorld.teardown();
            this.currentWorld = null;
        } finally {
            this.isTransitioning = false;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // FRAME DISPATCH - These are called by Runtime in order
    // ═══════════════════════════════════════════════════════════════

    frameBegin(ctx: FrameContext): void {
        if (!this.currentWorld || this.isTransitioning) return;
        this.currentWorld.frameBegin(ctx);
    }

    streaming(ctx: FrameContext): void {
        if (!this.currentWorld || this.isTransitioning) return;
        this.currentWorld.streaming(ctx);
    }

    jobsFlush(ctx: FrameContext): void {
        if (!this.currentWorld || this.isTransitioning) return;
        this.currentWorld.jobsFlush(ctx);
    }

    simulation(ctx: FixedContext): void {
        if (!this.currentWorld || this.isTransitioning) return;
        this.currentWorld.simulation(ctx);
    }

    renderSync(ctx: FrameContext): void {
        if (!this.currentWorld || this.isTransitioning) return;
        this.currentWorld.renderSync(ctx);
    }

    draw(ctx: FrameContext): void {
        if (!this.currentWorld || this.isTransitioning) return;
        this.currentWorld.draw(ctx);
    }

    frameEnd(ctx: FrameContext): void {
        if (!this.currentWorld || this.isTransitioning) return;
        this.currentWorld.frameEnd(ctx);
    }
}
