/**
 * useAureusEngine Hook (v2 - Engine Owned State)
 * 
 * React integration for the Aureus engine.
 * The engine now owns all game state. This hook:
 * - Creates and manages the engine lifecycle
 * - Subscribes React to state changes for re-rendering
 * - Provides action methods for UI interaction
 */

import { useRef, useEffect, useState, useCallback } from 'react';

import { WorldHost, Runtime } from '../engine';
import { RuntimeQualityGovernor, ThreeRenderAdapter, getRecommendedRenderQuality } from '../engine/render';
import { DebugHud } from '../engine/tools';
import { AureusWorld, AureusWorldConfig } from './AureusWorld';
import { BuildingType, GameCommand, GameState, LogisticsOverlayMode, SfxType } from '../types';
import { ChunkStore } from '../engine/space/ChunkStore';

export interface LoadingProgress {
    stage: string;
    percent: number;
    error?: string;
}

export interface UseAureusEngineOptions {
    /** Container element for the renderer */
    container: HTMLElement | null;

    /** Callbacks for external game interactions (optional, for compatibility) */
    onTileClick?: (x: number, z: number, isTouch?: boolean) => void;
    onTileRightClick?: (x: number, z: number, isTouch?: boolean) => void;
    onAgentClick?: (id: string | null) => void;
    onTileHover?: (x: number | null, z: number | null) => void;
    onSfx?: (type: SfxType) => void;

    /** Whether the game is paused (e.g., on home page) */
    paused?: boolean;
}

export interface AureusEngineHandle {
    /** The Aureus game world */
    world: AureusWorld | null;

    /** Engine runtime */
    runtime: Runtime | null;

    /** Debug HUD */
    debugHud: DebugHud | null;

    /** Whether the engine is ready */
    ready: boolean;

    /** Current game state (engine-owned, React subscribes) */
    state: GameState | null;

    /** Loading progress */
    loading: LoadingProgress;

    /** Get state ref for synchronous access */
    getStateRef: () => GameState | null;

    /** Get debug stats */
    getDebugStats: () => any;

    /** Dispatch action */
    dispatch: (action: any) => void;
}

function reloadWorldState(world: AureusWorld, state: GameState): void {
    world.dispatch({ type: 'LOAD_GAME', payload: state });
}

function enqueueWorldCommand(world: AureusWorld, type: GameCommand['type'], payload?: any): void {
    const state = world.getState();
    state.commandQueue.push({
        id: `ui_${type.toLowerCase()}_${Date.now()}`,
        type,
        payload,
        issuedAtTick: state.tickCount,
    });
}

function setLayeredActiveY(state: GameState, requestedY: number): GameState {
    const layeredWorld = state.layeredWorld;
    const activeY = Math.max(layeredWorld.minY, Math.min(layeredWorld.maxY, Math.round(requestedY)));
    return {
        ...state,
        layeredWorld: {
            ...layeredWorld,
            activeY,
            renderVersion: (layeredWorld.renderVersion || 0) + 1,
        },
    };
}

function enterDigMode(state: GameState): GameState {
    const layeredWorld = state.layeredWorld;
    const fallbackLayer = Math.max(layeredWorld.minY, layeredWorld.surfaceY - 1);
    const activeY = layeredWorld.activeY < layeredWorld.surfaceY ? layeredWorld.activeY : fallbackLayer;
    return {
        ...state,
        selectedBuilding: null,
        selectedAgentId: null,
        interactionMode: 'DIG' as any,
        layeredWorld: {
            ...layeredWorld,
            activeY,
            renderVersion: (layeredWorld.renderVersion || 0) + 1,
        },
    };
}

function findPlannerTargetNode(state: GameState, payload: Record<string, any>) {
    const nodes = state.factory?.nodes || {};
    if (payload?.targetKey && nodes[payload.targetKey]) {
        return nodes[payload.targetKey];
    }

    if (payload?.sectorName) {
        const sectorNodes = Object.values(nodes).filter((node) => node.sectorName === payload.sectorName);
        return sectorNodes.find((node) => node.buildingType === BuildingType.TRAIN_STATION)
            || sectorNodes.find((node) => node.buildingType === BuildingType.DRONE_DEPOT)
            || sectorNodes[0]
            || null;
    }

    return null;
}

function getPlannerPreviewOffsets(buildingType?: BuildingType): Array<[number, number]> {
    if (buildingType === BuildingType.RAIL_LINE) {
        return [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [2, 0],
            [-2, 0],
            [0, 2],
            [0, -2],
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
            [0, 0],
        ];
    }

    if (buildingType === BuildingType.DRONE_DEPOT) {
        return [
            [0, 0],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
            [2, 0],
            [-2, 0],
            [0, 2],
            [0, -2],
        ];
    }

    return [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
    ];
}

function findPlannerPreviewPosition(state: GameState, x: number, z: number, buildingType?: BuildingType) {
    const offsets = getPlannerPreviewOffsets(buildingType);

    for (const [dx, dz] of offsets) {
        const tile = ChunkStore.getTile(state.chunks, x + dx, z + dz);
        if (!tile) continue;
        if (tile.buildingType === BuildingType.EMPTY && !tile.isUnderConstruction) {
            return { x: x + dx, z: z + dz };
        }
    }

    return { x, z };
}

function getPlannerOverlayMode(reason?: string, suggestedBuilding?: BuildingType): LogisticsOverlayMode {
    if (reason === 'ROUTE_DEBT' || suggestedBuilding === BuildingType.RAIL_LINE) {
        return 'FLOW';
    }
    if (reason === 'CONGESTION') {
        return 'CONGESTION';
    }
    if (reason === 'UNDERFED') {
        return suggestedBuilding === BuildingType.DRONE_DEPOT ? 'JUNCTIONS' : 'FLOW';
    }
    return 'FLOW';
}

function getPlannerZoom(buildingType?: BuildingType): number {
    if (buildingType === BuildingType.RAIL_LINE) return 3.1;
    if (buildingType === BuildingType.TRAIN_STATION) return 2.6;
    if (buildingType === BuildingType.DRONE_DEPOT) return 2.35;
    if (buildingType === BuildingType.DISTRIBUTION_HUB) return 2.25;
    return 2;
}

function claimCompletedGoal(state: GameState): GameState | null {
    const goal = state.activeGoal;
    if (!goal || !goal.completed) return null;

    const resources: GameState['resources'] = { ...state.resources };
    if (goal.reward.type === 'AGT') {
        resources.agt += goal.reward.amount;
    } else {
        resources.gems += goal.reward.amount;
    }

    const newsItem: GameState['newsFeed'][number] = {
        id: `goal_claim_${Date.now()}`,
        headline: `MISSION COMPLETE: ${goal.title} reward claimed.`,
        type: 'POSITIVE',
        timestamp: state.tickCount,
    };
    const completeEffect: GameState['pendingEffects'][number] = {
        type: 'AUDIO',
        sfx: SfxType.COMPLETE,
    };

    const updatedState: GameState = {
        ...state,
        resources,
        activeGoal: null,
        newsFeed: [newsItem, ...state.newsFeed].slice(0, 8),
        pendingEffects: [...state.pendingEffects, completeEffect],
    };

    return updatedState;
}

/**
 * Hook for integrating Aureus engine with React
 * Engine owns state, React subscribes for UI updates
 */
export function useAureusEngine(options: UseAureusEngineOptions): AureusEngineHandle {
    const {
        container,
        onTileClick,
        onTileRightClick,
        onAgentClick,
        onTileHover,
        onSfx,
        paused = false,
    } = options;

    const [world, setWorld] = useState<AureusWorld | null>(null);
    const [runtime, setRuntime] = useState<Runtime | null>(null);
    const [debugHud, setDebugHud] = useState<DebugHud | null>(null);
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState<LoadingProgress>({ stage: 'Waiting for DOM...', percent: 0 });
    const [state, setState] = useState<GameState | null>(null);
    const stateRef = useRef<GameState | null>(null);

    const getStateRef = useCallback(() => stateRef.current, []);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const callbacksRef = useRef({ onTileClick, onTileRightClick, onAgentClick, onTileHover, onSfx });
    useEffect(() => {
        callbacksRef.current = { onTileClick, onTileRightClick, onAgentClick, onTileHover, onSfx };
    }, [onTileClick, onTileRightClick, onAgentClick, onTileHover, onSfx]);

    useEffect(() => {
        if (!container) {
            setLoading({ stage: 'Waiting for container...', percent: 5 });
            return;
        }

        console.log('[useAureusEngine] Container ready, starting initialization...');
        let cancelled = false;

        const initializeEngine = async () => {
            const stageDelay = (ms: number = 500) => new Promise(r => setTimeout(r, ms));

            try {
                setLoading({ stage: 'Initializing renderer...', percent: 10 });
                console.log('[useAureusEngine] Creating render adapter...');

                const renderQuality = getRecommendedRenderQuality();
                const render = new ThreeRenderAdapter({
                    antialias: renderQuality.antialias,
                    shadowMap: renderQuality.shadowMap,
                    pixelRatio: renderQuality.pixelRatio,
                    shadowMapSize: renderQuality.shadowMapSize,
                    fogEnabled: true,
                });
                render.init(container);

                if (cancelled) return;
                await stageDelay();

                setLoading({ stage: 'Creating game world...', percent: 20 });
                console.log('[useAureusEngine] Creating AureusWorld...');

                const worldInstance = new AureusWorld(render);

                if (cancelled) return;
                await stageDelay();

                setLoading({ stage: 'Configuring input system...', percent: 30 });
                console.log('[useAureusEngine] Configuring world...');

                const config: AureusWorldConfig = {
                    container,
                    onTileClick: (x, z, isTouch) => callbacksRef.current.onTileClick?.(x, z, isTouch),
                    onTileRightClick: (x, z, isTouch) => callbacksRef.current.onTileRightClick?.(x, z, isTouch),
                    onAgentClick: (id) => callbacksRef.current.onAgentClick?.(id),
                    onTileHover: (x, z) => callbacksRef.current.onTileHover?.(x, z),
                    onSfx: (type) => callbacksRef.current.onSfx?.(type),
                };

                try {
                    worldInstance.configure(config);
                    console.log('[useAureusEngine] ✓ Configure complete');
                } catch (e) {
                    console.error('[useAureusEngine] Configure failed:', e);
                    throw e;
                }

                if (cancelled) return;
                await stageDelay();
                console.log('[useAureusEngine] Proceeding to state subscription...');

                const unsubscribe = worldInstance.subscribeToState((newState) => {
                    setState(newState);
                });
                console.log('[useAureusEngine] ✓ State subscription set up');

                const initialState = worldInstance.getState();
                console.log('[useAureusEngine] Initial state prepared:', initialState ? 'OK' : 'NULL');

                if (cancelled) {
                    unsubscribe();
                    return;
                }

                setWorld(worldInstance);
                console.log('[useAureusEngine] ✓ World set');
                await stageDelay();

                setLoading({ stage: 'Creating runtime...', percent: 40 });
                console.log('[useAureusEngine] Creating WorldHost and Runtime...');

                const worldHost = new WorldHost();
                const runtimeInstance = new Runtime(worldHost, {
                    fixedTickRate: 30,
                    maxSimStepsPerFrame: 3,
                    profilerEnabled: true,
                });
                const qualityGovernor = new RuntimeQualityGovernor(runtimeInstance, render);
                setRuntime(runtimeInstance);

                if (cancelled) {
                    unsubscribe();
                    return;
                }
                await stageDelay();

                setLoading({ stage: 'Initializing debug tools...', percent: 50 });
                console.log('[useAureusEngine] Creating DebugHud...');

                if (cancelled) {
                    unsubscribe();
                    return;
                }
                await stageDelay();

                setLoading({ stage: 'Loading world data...', percent: 60 });
                console.log('[useAureusEngine] Setting world on host...');

                try {
                    console.log('[useAureusEngine] Calling worldHost.setWorld...');
                    await worldHost.setWorld(worldInstance);
                    console.log('[useAureusEngine] ✓ worldHost.setWorld completed');
                } catch (e) {
                    console.error('[useAureusEngine] worldHost.setWorld failed:', e);
                    throw e;
                }

                if (cancelled) {
                    unsubscribe();
                    return;
                }
                await stageDelay();

                setLoading({ stage: 'Starting simulation...', percent: 80 });
                runtimeInstance.start();
                qualityGovernor.start();

                if (cancelled) {
                    unsubscribe();
                    qualityGovernor.stop();
                    runtimeInstance.stop();
                    return;
                }

                await stageDelay();
                setLoading({ stage: 'Finalizing...', percent: 90 });

                await stageDelay();
                setLoading({ stage: 'Game Engine Running!', percent: 100 });

                await new Promise(r => setTimeout(r, 1500));

                setReady(true);
                setState(worldInstance.getState());

                if (import.meta.env.DEV) {
                    (window as any).__aureusWorld = worldInstance;
                    (window as any).__aureusGetState = () => worldInstance.getState();
                }

                (window as any).__aureusCleanup = () => {
                    if (import.meta.env.DEV) {
                        delete (window as any).__aureusWorld;
                        delete (window as any).__aureusGetState;
                    }
                    unsubscribe();
                    qualityGovernor.stop();
                    runtimeInstance.stop();
                    worldInstance.teardown();
                    render.dispose();
                };

            } catch (error) {
                console.error('[useAureusEngine] ❌ FATAL ERROR:', error);
                setLoading({
                    stage: 'Error!',
                    percent: 0,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        };

        initializeEngine();

        return () => {
            console.log('[useAureusEngine] Cleaning up...');
            cancelled = true;
            setReady(false);

            if ((window as any).__aureusCleanup) {
                (window as any).__aureusCleanup();
                delete (window as any).__aureusCleanup;
            }

            setWorld(null);
            setRuntime(null);
            setState(null);
        };
    }, [container]);

    useEffect(() => {
        if (world) {
            world.setGamePaused(paused);
        }
    }, [world, paused]);

    return {
        world,
        runtime,
        debugHud,
        ready,
        state,
        loading,
        getStateRef,
        getDebugStats: useCallback(() => {
            if (!world || !runtime) return null;

            const worldStats = world.getDebugStats();
            const cpuTime = runtime.profiler?.get('frame') || 0;

            return {
                ...worldStats,
                cpuTime
            };
        }, [world, runtime]),
        dispatch: useCallback((action: any) => {
            if (!world) return;

            if (action?.type === 'SET_LAYERED_ACTIVE_Y') {
                const state = world.getState();
                reloadWorldState(world, setLayeredActiveY(state, Number(action.payload)));
                return;
            }

            if (action?.type === 'SET_INTERACTION_MODE' && action.payload === 'DIG') {
                const state = world.getState();
                reloadWorldState(world, enterDigMode(state));
                return;
            }

            if (action?.type === 'CLAIM_GOAL') {
                const state = world.getState();
                const updatedState = claimCompletedGoal(state);
                if (updatedState) {
                    reloadWorldState(world, updatedState);
                }
                return;
            }

            if (action?.type === 'DELIVER_CONTRACT') {
                enqueueWorldCommand(world, 'DELIVER_CONTRACT', { contractId: action.payload?.contractId ?? action.payload });
                return;
            }

            if (action?.type === 'UPDATE_SECTOR_POLICY') {
                const state = world.getState();
                if (!state.factory?.sectors) return;

                const updatedState: GameState = {
                    ...state,
                    factory: {
                        ...state.factory,
                        sectors: state.factory.sectors.map((sector) =>
                            sector.name === action.payload.sectorName
                                ? {
                                    ...sector,
                                    directive: action.payload.directive ?? sector.directive ?? 'BALANCED',
                                    priorityResource: action.payload.priorityResource ?? sector.priorityResource ?? sector.exportFocus,
                                    flowMode: action.payload.flowMode ?? sector.flowMode ?? 'STABLE',
                                    congestionPolicy: action.payload.congestionPolicy ?? sector.congestionPolicy ?? 'BALANCED',
                                    contractResource: action.payload.contractResource ?? sector.contractResource ?? sector.importFocus,
                                    contractTarget: action.payload.contractTarget ?? sector.contractTarget ?? 24,
                                }
                                : sector
                        ),
                    },
                };

                reloadWorldState(world, updatedState);
                return;
            }

            if (action?.type === 'UPDATE_FACTORY_PLANNER') {
                const state = world.getState();
                if (!state.factory) return;

                if (action.payload?.plannerAction === 'FOCUS_RECOMMENDATION') {
                    const targetNode = findPlannerTargetNode(state, action.payload);
                    if (!targetNode) return;

                    if (state.isFPS) {
                        world.exitFPS();
                    }
                    if (state.activeView === 'DUNGEON') {
                        world.toggleViewMode();
                    }

                    const overlayMode = getPlannerOverlayMode(action.payload?.reason, action.payload?.suggestedBuilding);
                    if (state.logistics.overlayMode !== overlayMode) {
                        reloadWorldState(world, {
                            ...state,
                            logistics: {
                                ...state.logistics,
                                overlayMode,
                            },
                        });
                    }

                    if (action.payload?.suggestedBuilding) {
                        world.selectBuilding(action.payload.suggestedBuilding);
                        const preview = findPlannerPreviewPosition(state, targetNode.x, targetNode.z, action.payload.suggestedBuilding);
                        world.pinBuildingForConfirmation(preview.x, preview.z);
                    }

                    const tile = ChunkStore.getTile(state.chunks, targetNode.x, targetNode.z);
                    const focusY = tile ? tile.terrainHeight * 0.5 : 0;
                    const zoomLevel = getPlannerZoom(action.payload?.suggestedBuilding);
                    (world as any).cameraSystem?.setTargetHeight?.(focusY);
                    (world as any).cameraSystem?.zoomToPosition?.(targetNode.x, targetNode.z, zoomLevel);
                    return;
                }

                const currentPressure = state.factory.pressure || {
                    routeDebt: 0,
                    underfedProcessors: 0,
                    hotspots: 0,
                    bottlenecks: [],
                    pinnedKeys: [],
                    emergencyReliefSectors: [],
                    recommendations: [],
                    efficiencyPenalty: 0,
                    corridors: [],
                };
                const pinnedKeys = new Set(currentPressure.pinnedKeys || []);
                const emergencyReliefSectors = new Set(currentPressure.emergencyReliefSectors || []);

                if (action.payload?.plannerAction === 'TOGGLE_PIN' && action.payload?.targetKey) {
                    if (pinnedKeys.has(action.payload.targetKey)) {
                        pinnedKeys.delete(action.payload.targetKey);
                    } else {
                        pinnedKeys.add(action.payload.targetKey);
                    }
                }

                if (action.payload?.plannerAction === 'TOGGLE_RELIEF' && action.payload?.sectorName) {
                    if (emergencyReliefSectors.has(action.payload.sectorName)) {
                        emergencyReliefSectors.delete(action.payload.sectorName);
                    } else {
                        emergencyReliefSectors.add(action.payload.sectorName);
                    }
                }

                const updatedState: GameState = {
                    ...state,
                    factory: {
                        ...state.factory,
                        pressure: {
                            ...currentPressure,
                            pinnedKeys: Array.from(pinnedKeys),
                            emergencyReliefSectors: Array.from(emergencyReliefSectors),
                        },
                    },
                };

                reloadWorldState(world, updatedState);
                return;
            }

            world.dispatch(action);
        }, [world])
    };
}

export default useAureusEngine;