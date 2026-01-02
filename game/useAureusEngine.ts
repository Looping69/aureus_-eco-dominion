/**
 * useAureusEngine Hook
 * React integration for the Aureus engine spine
 * 
 * This hook provides a clean bridge between React state management
 * and the engine's fixed-step simulation loop.
 */

import React, { useRef, useEffect, useState } from 'react';

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

    // Instance state
    const [world, setWorldInstance] = useState<AureusWorld | null>(null);
    const [engine, setEngineInstance] = useState<VoxelEngine | null>(null);
    const [runtime, setRuntimeInstance] = useState<Runtime | null>(null);
    const [debugHud, setDebugHudInstance] = useState<DebugHud | null>(null);
    const [ready, setReady] = useState(false);

    // State ref for the simulation to read current state without triggering effects
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
        render.init(container);

        // Create world
        const worldInstance = new AureusWorld(render);

        // Configure world
        const config: AureusWorldConfig = {
            container,
            onTileClick,
            onTileRightClick,
            onAgentClick,
            onTileHover,
        };
        worldInstance.configure(config);

        // Create the legacy VoxelEngine through the world
        const engineInstance = worldInstance.createLegacyEngine();

        // Connect React state management
        worldInstance.connectLegacy(dispatch, () => stateRef.current);

        // Set instances to state
        setWorldInstance(worldInstance);
        setEngineInstance(engineInstance);

        let activeRuntime: Runtime | null = null;
        let activeDebugHud: DebugHud | null = null;

        if (useNewLoop) {
            // New engine loop - world handles simulation
            const worldHost = new WorldHost();

            activeRuntime = new Runtime(worldHost, {
                fixedTickRate: 60,
                maxSimStepsPerFrame: 5,
                profilerEnabled: true,
            });
            setRuntimeInstance(activeRuntime);

            // Create debug HUD
            activeDebugHud = new DebugHud({ position: 'top-right' });
            activeDebugHud.init(container, activeRuntime, () => render.getStats());
            setDebugHudInstance(activeDebugHud);

            // Load world and start
            worldHost.setWorld(worldInstance).then(() => {
                // Initial sync
                worldInstance.initialSync(stateRef.current.grid);

                activeRuntime?.start();
                setReady(true);
                console.log('[useAureusEngine] New engine loop started');
            });
        } else {
            // Legacy mode - VoxelEngine has its own loop
            if (engineInstance) {
                engineInstance.initialSync(stateRef.current.grid);
            }

            setReady(true);
            console.log('[useAureusEngine] Legacy mode ready');
        }

        // Cleanup
        return () => {
            console.log('[useAureusEngine] Cleaning up...');

            setReady(false);

            if (activeRuntime) {
                activeRuntime.stop();
            }

            if (activeDebugHud) {
                activeDebugHud.dispose();
            }

            worldInstance.teardown();
            render.dispose();

            setWorldInstance(null);
            setEngineInstance(null);
            setRuntimeInstance(null);
            setDebugHudInstance(null);
        };
    }, [container, useNewLoop]);

    // Sync pause state
    useEffect(() => {
        if (world) {
            world.setGamePaused(paused);
        }
    }, [world, paused]);

    // Sync selected agent
    useEffect(() => {
        engine?.setSelectedAgent(state.selectedAgentId);
    }, [engine, state.selectedAgentId]);

    // Sync interaction mode
    useEffect(() => {
        if (engine) {
            engine.setInteractionMode(state.interactionMode as 'BUILD' | 'BULLDOZE' | 'INSPECT');
        }
    }, [engine, state.interactionMode]);

    // Sync ghost building
    useEffect(() => {
        engine?.setGhostBuilding(state.selectedBuilding);
    }, [engine, state.selectedBuilding]);

    // Sync agents
    useEffect(() => {
        engine?.updateAgents(state.agents);
    }, [engine, state.agents]);

    // Sync events
    useEffect(() => {
        engine?.syncEvents(state.activeEvents);
    }, [engine, state.activeEvents]);

    return {
        world,
        engine,
        runtime,
        debugHud,
        ready,
    };
}

export default useAureusEngine;
