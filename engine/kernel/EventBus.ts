/**
 * Engine Kernel - Event Bus
 * Type-safe pub/sub for decoupled engine communication
 */

type Handler<T> = (payload: T) => void;
type Unsubscribe = () => void;

/** Event type registry - extend this for type-safe events */
export interface EngineEvents {
    // Lifecycle
    'engine:start': void;
    'engine:stop': void;
    'engine:pause': void;
    'engine:resume': void;

    // World
    'world:load': { worldId: string };
    'world:unload': { worldId: string };
    'world:ready': { worldId: string };

    // Streaming
    'chunk:load': { key: string };
    'chunk:unload': { key: string };
    'chunk:meshReady': { key: string };

    // Debug
    'debug:toggle': boolean;
    'debug:log': { level: 'info' | 'warn' | 'error'; message: string };
}

export class EventBus<Events extends Record<string, any> = EngineEvents> {
    private handlers = new Map<keyof Events, Set<Handler<any>>>();
    private onceHandlers = new Map<keyof Events, Set<Handler<any>>>();

    /**
     * Subscribe to an event
     * @returns Unsubscribe function
     */
    on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): Unsubscribe {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        this.handlers.get(type)!.add(handler);

        return () => {
            this.handlers.get(type)?.delete(handler);
        };
    }

    /**
     * Subscribe to an event - fires only once
     */
    once<K extends keyof Events>(type: K, handler: Handler<Events[K]>): Unsubscribe {
        if (!this.onceHandlers.has(type)) {
            this.onceHandlers.set(type, new Set());
        }
        this.onceHandlers.get(type)!.add(handler);

        return () => {
            this.onceHandlers.get(type)?.delete(handler);
        };
    }

    /**
     * Emit an event to all subscribers
     */
    emit<K extends keyof Events>(type: K, payload: Events[K]): void {
        // Regular handlers
        const handlers = this.handlers.get(type);
        if (handlers) {
            for (const fn of handlers) {
                try {
                    fn(payload);
                } catch (e) {
                    console.error(`[EventBus] Error in handler for '${String(type)}':`, e);
                }
            }
        }

        // Once handlers - fire and remove
        const onceSet = this.onceHandlers.get(type);
        if (onceSet) {
            for (const fn of onceSet) {
                try {
                    fn(payload);
                } catch (e) {
                    console.error(`[EventBus] Error in once handler for '${String(type)}':`, e);
                }
            }
            onceSet.clear();
        }
    }

    /**
     * Remove all handlers for an event type
     */
    off<K extends keyof Events>(type: K): void {
        this.handlers.delete(type);
        this.onceHandlers.delete(type);
    }

    /**
     * Clear all event handlers
     */
    clear(): void {
        this.handlers.clear();
        this.onceHandlers.clear();
    }

    /**
     * Get count of handlers for debugging
     */
    getHandlerCount<K extends keyof Events>(type: K): number {
        return (this.handlers.get(type)?.size || 0) +
            (this.onceHandlers.get(type)?.size || 0);
    }
}

/** Global engine event bus singleton */
export const engineEvents = new EventBus<EngineEvents>();
