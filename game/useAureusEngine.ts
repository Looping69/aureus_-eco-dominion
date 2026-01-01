/**
 * useAureusEngine Hook
 * React integration for the Aureus engine spine
 * 
 * This hook provides a clean bridge between React state management
 * and the engine's fixed-step simulation loop.
 */

import { useRef, useEffect, useCallback } from 'react';
import { WorldHost, Runtime } from '../engine';
import { ThreeRenderAdapter } from '../engine/render';
import { DebugHud } from '../engine/tools';
import { AureusWorld, AureusWorldConfig } from './AureusWorld';
import { GameState, Action } from '../types';
import { VoxelEngine } from '../services/VoxelEngine';

export interface UseAureusEngineOptions {
    /** Container element for the renderer */
    container: HTMLElement | null;

    /** Current game state */
    state: GameState;

    /** React dispatch function */
    dispatch: React.Dispatch<Action>;

    /** Callbacks for game interactions */
    onTileClick: (index: number) => void;
    onTileRightClick: (index: number) => void;
    onAgentClick: (id: string | null) => void;
    onTileHover: (index: number | null) => void;

    /** Whether the game is paused (e.g., on home page) */
    paused: boolean;

    /** Enable new engine loop (default: false for gradual migration) */
    useNewLoop?: boolean;
}

export interface AureusEngineHandle {
    /** The Aureus game world */
    world: AureusWorld | null;

    /** The legacy VoxelEngine (for backwards compatibility) */
    engine: VoxelEngine | null;

    /** Engine runtime (when using new loop) */
    runtime: Runtime | null;

    /** Debug HUD */
    debugHud: DebugHud | null;

    /** Whether the engine is ready */
    ready: boolean;
}

/**
 * Hook for integrating Aureus engine with React
 * 
 * Usage:
 * ```tsx
 * const { engine, world, ready } = useAureusEngine({
 *   container: containerRef.current,
 *   state,
 *   dispatch,
 *   onTileClick: handleTileClick,
 *   // ...
 * });
 * ```
 */
export function useAureusEngine(options: UseAureusEngineOptions): AureusEngineHandle {
    const {
        container,
        state,
        dispatch,
        onTileClick,
        onTileRightClick,
        onAgentClick,
        onTileHover,
        paused,
        useNewLoop = false,
    } = options;

    // Refs for persistent instances
    const worldRef = useRef<AureusWorld | null>(null);
    const engineRef = useRef<VoxelEngine | null>(null);
    const runtimeRef = useRef<Runtime | null>(null);
    const renderRef = useRef<ThreeRenderAdapter | null>(null);
    const debugHudRef = useRef<DebugHud | null>(null);
    const worldHostRef = useRef<WorldHost | null>(null);
    const readyRef = useRef(false);

    // State ref for the simulation to read current state
    const stateRef = useRef(state);
    stateRef.current = state;

    // Initialize engine
    useEffect(() => {
        if (!container) return;

        console.log('[useAureusEngine] Initializing...');

        // Create render adapter
        const render = new ThreeRenderAdapter({
            antialias: true,
            shadowMap: true,
            fogEnabled: true,
        });
        renderRef.current = render;

        // Create world
        const world = new AureusWorld(render);
        worldRef.current = world;

        // Configure world
        const config: AureusWorldConfig = {
            container,
            onTileClick,
            onTileRightClick,
            onAgentClick,
            onTileHover,
        };
        world.configure(config);

        // Create the legacy VoxelEngine through the world
        const engine = world.createLegacyEngine();
        engineRef.current = engine;

        // Connect React state management
        world.connectLegacy(dispatch, () => stateRef.current);

        if (useNewLoop) {
            // New engine loop - world handles simulation
            const worldHost = new WorldHost();
            worldHostRef.current = worldHost;

            const runtime = new Runtime(worldHost, {
                fixedTickRate: 60,
                maxSimStepsPerFrame: 5,
                profilerEnabled: true,
            });
            runtimeRef.current = runtime;

            // Create debug HUD
            const debugHud = new DebugHud({ position: 'top-right' });
            debugHud.init(container, runtime, () => render.getStats());
            debugHudRef.current = debugHud;

            // Load world and start
            worldHost.setWorld(world).then(() => {
                runtime.start();
                readyRef.current = true;
                console.log('[useAureusEngine] New engine loop started');
            });
        } else {
            // Legacy mode - VoxelEngine has its own loop
            // Initial sync
            if (engine) {
                engine.initialSync(stateRef.current.grid);
                engine.playIntroAnimation(() => {
                    console.log('[useAureusEngine] Intro animation complete');
                });
            }

            readyRef.current = true;
            console.log('[useAureusEngine] Legacy mode ready');
        }

        // Cleanup
        return () => {
            console.log('[useAureusEngine] Cleaning up...');

            runtimeRef.current?.stop();
            debugHudRef.current?.dispose();

            if (worldRef.current) {
                worldRef.current.teardown();
            }

            renderRef.current?.dispose();

            // Clear refs
            worldRef.current = null;
            engineRef.current = null;
            runtimeRef.current = null;
            renderRef.current = null;
            debugHudRef.current = null;
            worldHostRef.current = null;
            readyRef.current = false;
        };
    }, [container]); // Only reinitialize when container changes

    // Sync pause state
    useEffect(() => {
        if (worldRef.current) {
            worldRef.current.setGamePaused(paused);
        }
    }, [paused]);

    // Sync selected agent
    useEffect(() => {
        engineRef.current?.setSelectedAgent(state.selectedAgentId);
    }, [state.selectedAgentId]);

    // Sync interaction mode
    useEffect(() => {
        engineRef.current?.setInteractionMode(state.interactionMode as 'BUILD' | 'BULLDOZE' | 'INSPECT');
    }, [state.interactionMode]);

    // Sync ghost building
    useEffect(() => {
        engineRef.current?.setGhostBuilding(state.selectedBuilding);
    }, [state.selectedBuilding]);

    // Sync agents
    useEffect(() => {
        engineRef.current?.updateAgents(state.agents);
    }, [state.agents]);

    // Sync events
    useEffect(() => {
        engineRef.current?.syncEvents(state.activeEvents);
    }, [state.activeEvents]);

    return {
        world: worldRef.current,
        engine: engineRef.current,
        runtime: runtimeRef.current,
        debugHud: debugHudRef.current,
        ready: readyRef.current,
    };
}

export default useAureusEngine;
