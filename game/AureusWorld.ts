/**
 * Aureus Game World
 * Bridge between the engine spine and the current Aureus game code
 * 
 * This wraps the existing game logic to run inside the new engine architecture,
 * allowing incremental migration of systems.
 */

import React from 'react';
import { BaseWorld } from '../engine/world';
import { FrameContext, FixedContext } from '../engine/kernel';

import { StreamingManager } from '../engine/space';
import { JobSystem, MeshChunkResult, PathfindResult, WorkerPool, PathfindJob } from '../engine/jobs';
import { ThreeRenderAdapter } from '../engine/render';
import { Simulation } from '../engine/sim';
import { AgentSystem, JobGenerationSystem } from '../engine/sim/systems';

import { VoxelEngine } from '../services/VoxelEngine';
import { GameState, Action, GameStep, Agent, GridTile, BuildingType } from '../types';
import { DiffBus } from '../services/DiffBus';
import { GRID_SIZE } from '../utils/gameUtils';
import { findPath } from '../engine/sim/algorithms/Pathfinding';
import { AgentRenderSystem } from './render/systems/AgentRenderSystem';
import { GRID_SIZE } from '../utils/gameUtils';

export interface AureusWorldConfig {
    container: HTMLElement;
    onTileClick: (index: number) => void;
    onTileRightClick: (index: number) => void;
    onAgentClick: (id: string | null) => void;
    onTileHover: (index: number | null) => void;
}

export class AureusWorld extends BaseWorld {
    readonly id = 'aureus-main';

    // Engine subsystems
    // Engine subsystems
    private streamMgr: StreamingManager;

    private agentRenderSystem: AgentRenderSystem;

    constructor(render: ThreeRenderAdapter) {
        super();
        this.render = render;

        // Initialize engine subsystems with game-specific config
        this.streamMgr = new StreamingManager({
            viewRadiusH: 12,   // Aureus uses larger flat chunks
            viewRadiusV: 1,    // Mostly 2D terrain
            maxLoadsPerFrame: 4,
            maxUnloadsPerFrame: 8,
        });

        this.jobs = new JobSystem();
        this.workerPool = new WorkerPool();
        this.sim = new Simulation();

        // Register systems
        // this.jobGenerationSystem = new JobGenerationSystem();
        this.agentSystem = new AgentSystem(this.jobs);

        // this.sim.addSystem(this.jobGenerationSystem);
        this.sim.addSystem(this.agentSystem);

        // Render Systems
        // Height callback uses legacy engine if available, or flat 0
        const getHeight = (x: number, z: number) => {
            // @ts-ignore
            return this.legacyEngine?.getSurfaceHeight(x, z) || 0;
        };

        this.agentRenderSystem = new AgentRenderSystem(
            this.render.getScene(),
            GRID_SIZE,
            getHeight
        );
    }

    // ...

    draw(ctx: FrameContext): void {
        const state = this.getState ? this.getState() : null;

        // 1. Legacy Engine Render Phase (Updates Camera & Renders Terrain)
        if (this.legacyEngine) {
            this.legacyEngine.render(ctx.dt, ctx.time);
        }

        // 2. Sync Camera from Legacy to New Engine
        if (this.legacyEngine) {
            const legacyCam = this.legacyEngine.getCamera();
            const newCam = this.render.getCamera();

            newCam.position.copy(legacyCam.position);
            newCam.quaternion.copy(legacyCam.quaternion);
            if ((legacyCam as any).isPerspectiveCamera && (newCam as any).isPerspectiveCamera) {
                newCam.zoom = (legacyCam as any).zoom;
                newCam.fov = (legacyCam as any).fov;
                newCam.updateProjectionMatrix();
            }
        }

        // 3. New Engine Update & Render (Agents Overlay)
        if (state) {
            this.agentRenderSystem.setSelectedAgent(state.selectedAgentId);
            // Estimate zoom level from height for LOD
            const zoomLevel = this.render.getCamera().position.y;
            this.agentRenderSystem.update(ctx.dt, ctx.time, state.agents, zoomLevel);
        }

        this.render.draw(ctx);
    }


    /**
     * Configure the world before initialization
     */
    configure(config: AureusWorldConfig): void {
        this.config = config;
    }

    /**
     * Connect to legacy game systems (React state + VoxelEngine)
     * Call this after React has set up its state management
     */
    connectLegacy(
        dispatch: React.Dispatch<Action>,
        getState: () => GameState,
        legacyEngine?: VoxelEngine
    ): void {
        this.dispatch = dispatch;
        this.getState = getState;

        if (legacyEngine) {
            this.legacyEngine = legacyEngine;
        }

        console.log('[AureusWorld] Legacy systems connected');
    }

    /**
     * Create and connect the legacy VoxelEngine
     * Use this when the engine should be created by AureusWorld
     */
    createLegacyEngine(): VoxelEngine | null {
        if (!this.config) {
            console.error('[AureusWorld] Cannot create engine - config not set');
            return null;
        }

        this.legacyEngine = new VoxelEngine(
            this.config.container,
            this.config.onTileClick,
            this.config.onTileRightClick,
            this.config.onAgentClick,
            this.config.onTileHover,
            GRID_SIZE
        );

        return this.legacyEngine;
    }

    /**
     * Get the legacy VoxelEngine for external use
     */
    getEngine(): VoxelEngine | null {
        return this.legacyEngine;
    }

    /**
     * Pause/resume the game simulation
     */
    setGamePaused(paused: boolean): void {
        this.gamePaused = paused;
    }

    // ...

    protected async onInit(): Promise<void> {
        console.log('[AureusWorld] Initializing...');

        // Init workers
        this.workerPool.init();

        // Initialize simulation systems
        this.sim.init();

        console.log('[AureusWorld] Ready');
    }

    protected async onTeardown(): Promise<void> {
        console.log('[AureusWorld] Tearing down...');

        // Cleanup legacy engine
        if (this.legacyEngine) {
            this.legacyEngine.cleanup();
            this.legacyEngine = null;
        }

        // Cleanup engine subsystems
        this.sim.dispose();
        this.workerPool.dispose();
        this.jobs.clear();
    }


    // ═══════════════════════════════════════════════════════════════
    // FRAME PHASES - Engine Spine Integration
    // ═══════════════════════════════════════════════════════════════

    frameBegin(_ctx: FrameContext): void {
        // Input is handled by React in the current architecture
        // This is a future migration point for moving input to engine
    }

    streaming(_ctx: FrameContext): void {
        // The current VoxelEngine handles streaming via TerrainChunkManager
        // This phase can be used to coordinate chunk loading with jobs

        if (!this.legacyEngine) return;

        // Get camera position from scene
        const camera = this.render.getCamera();
        const cameraChunk = {
            x: Math.floor(camera.position.x / 16),
            y: 0, // Aureus is flat
            z: Math.floor(camera.position.z / 16),
        };

        // Update streaming manager for future job-based streaming
        this.streamMgr.update(cameraChunk);
    }

    jobsFlush(_ctx: FrameContext): void {
        // Dispatch new jobs to workers
        this.workerPool.dispatch(this.jobs);

        // Process completed results
        const results = this.jobs.drainResults();

        // Get current state to resolve agent references
        const state = this.getState ? this.getState() : null;

        for (const result of results) {
            if (result.kind === 'MESH_CHUNK' && result.success) {
                const meshResult = result as MeshChunkResult;
                // Future: Apply mesh geometry to render
                console.log(`[AureusWorld] Mesh ready: ${meshResult.chunkKey}`);
            } else if (result.kind === 'PATHFIND') {
                if (state) {
                    this.agentSystem.receiveJobResult(result as PathfindResult, state);
                }
            }
            ```
        }
    }

    simulation(ctx: FixedContext): void {
        // Skip if paused or no dispatch
        if(this.gamePaused || !this.dispatch || !this.getState) return;

        const state = this.getState();
        // IMPORTANT: Updates from AgentSystem (x, z, state) are in 'state.agents'.
        // We MUST dispatch these changes back to React, otherwise the Reducer will
        // reset them to the old values on the next TICK!
        // Actually, we don't have a specific dispatch for "SYNC_AGENTS".
        // Using "TICK" causes Reducer to process simulationLogic.ts
        // simulationLogic.ts uses [...state.agents].
        // So we need to ensure the `state` object WE have is the one Reducer uses?
        // No, Reducer runs in its own context.
        // We need an action 'UPDATE_AGENTS_POSITIONS'
        // OR rely on Mutable References if Reducer allows it?
        // React State is immutable.
        
        // TEMPORARY FIX: Mutable hack usually works if Reducer refs are shared.
        // But if Reducer does shallow copy, it might preserve the objects.
        
        // If agents are wiggling, the Render sees the updates.
        // If they reset position, it's because Reducer overwrote them.


        // Skip if game over
        if (state.step === GameStep.GAME_OVER) return;

        // Accumulate time for 200ms game ticks
        // Game ticks are 200ms, so we need ~12 steps per tick
        this.tickAccumulator += ctx.fixedDt * 1000;

        if (this.tickAccumulator >= this.TICK_INTERVAL_MS) {
            this.tickAccumulator -= this.TICK_INTERVAL_MS;

            // Dispatch the game TICK
            this.dispatch({ type: 'TICK' });

            // Auto-save check
            this.ticksSinceAutoSave++;
            if (this.ticksSinceAutoSave >= this.AUTO_SAVE_TICKS) {
                this.ticksSinceAutoSave = 0;
                // Auto-save is handled by App.tsx currently
                // Future: Move save logic here
            }
        }

        // Run additional simulation systems (future migration)
        this.sim.tick(ctx, state);
    }


    renderSync(ctx: FrameContext): void {
        // The VoxelEngine handles its own render loop currently
        // This syncs the state to the renderer

        if (!this.legacyEngine || !this.getState) return;

        const state = this.getState();

        // Sync agents to renderer
        // Sync agents to renderer
        // this.legacyEngine.updateAgents(state.agents);

        // Sync global events (affects environment)
        this.legacyEngine.syncEvents(state.activeEvents);

        // Process pending effects
        if (state.pendingEffects && state.pendingEffects.length > 0) {
            let gridUpdated = false;
            for (const effect of state.pendingEffects) {
                DiffBus.publish(effect);
                if (effect.type === 'GRID_UPDATE') gridUpdated = true;
            }

            if (gridUpdated) {
                this.workerPool.broadcast({ type: 'SYNC_GRID', payload: state.grid });
            }
        }
    }



    frameEnd(_ctx: FrameContext): void {
        // Cleanup, telemetry
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════

    /**
     * Perform initial sync of game state to the engine
     */
    initialSync(grid: GridTile[]): void {
        this.workerPool.broadcast({ type: 'SYNC_GRID', payload: grid });
        if (this.legacyEngine) {
            this.legacyEngine.initialSync(grid);
        }
    }

    /**
     * Update agents (called from React when agents change)
     */
    updateAgents(agents: Agent[]): void {
        if (this.legacyEngine) {
            this.legacyEngine.updateAgents(agents);
        }
    }

    /**
     * Set ghost building for placement preview
     */
    setGhostBuilding(type: BuildingType | null): void {
        if (this.legacyEngine) {
            this.legacyEngine.setGhostBuilding(type);
        }
    }

    /**
     * Set interaction mode
     */
    setInteractionMode(mode: 'BUILD' | 'BULLDOZE' | 'INSPECT'): void {
        if (this.legacyEngine) {
            this.legacyEngine.setInteractionMode(mode);
        }
    }

    /**
     * Set selected agent
     */
    setSelectedAgent(id: string | null): void {
        if (this.legacyEngine) {
            this.legacyEngine.setSelectedAgent(id);
        }
    }

    /**
     * Play intro animation
     */
    playIntroAnimation(onComplete: () => void): void {
        if (this.legacyEngine) {
            this.legacyEngine.playIntroAnimation(onComplete);
        }
    }

    /**
     * Get debug stats from the engine
     */
    getDebugStats() {
        return {
            engineStats: this.legacyEngine?.getDebugStats() ?? null,
            streamingStats: {
                activeChunks: this.streamMgr.activeCount,
                queuedJobs: this.jobs.queueLength,
                pendingJobs: this.jobs.pendingCount,
            },
        };
    }
}
