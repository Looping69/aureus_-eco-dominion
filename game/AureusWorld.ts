/**
 * Aureus Game World
 * Bridge between the engine spine and the current Aureus game code
 * 
 * This wraps the existing game logic to run inside the new engine architecture,
 * allowing incremental migration of systems.
 */

import { BaseWorld } from '../engine/world';
import { FrameContext, FixedContext } from '../engine/kernel';
import { StreamingManager } from '../engine/space';
import { JobSystem, MeshChunkResult } from '../engine/jobs';
import { ThreeRenderAdapter } from '../engine/render';
import { Simulation } from '../engine/sim';

// Import existing game systems
import { VoxelEngine } from '../services/VoxelEngine';
import { GameState, Action, GameStep, Agent, GridTile, BuildingType } from '../types';
import { DiffBus } from '../services/DiffBus';
import { GRID_SIZE } from '../utils/gameUtils';

/** Configuration for AureusWorld */
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
    private streaming: StreamingManager;
    private jobs: JobSystem;
    private simulation: Simulation;

    // Render adapter (from engine)
    private render: ThreeRenderAdapter;

    // Configuration
    private config: AureusWorldConfig | null = null;

    // ═══════════════════════════════════════════════════════════════
    // LEGACY BRIDGE - Existing game systems
    // ═══════════════════════════════════════════════════════════════

    /** The existing VoxelEngine that handles rendering */
    private legacyEngine: VoxelEngine | null = null;

    /** React dispatch function for state updates */
    private dispatch: React.Dispatch<Action> | null = null;

    /** Getter for current state (from React ref) */
    private getState: (() => GameState) | null = null;

    /** Track if game is paused (e.g., on home page) */
    private gamePaused = false;

    /** Tick accumulator for 200ms game ticks */
    private tickAccumulator = 0;
    private readonly TICK_INTERVAL_MS = 200;

    /** Auto-save counter */
    private ticksSinceAutoSave = 0;
    private readonly AUTO_SAVE_TICKS = 150;

    constructor(render: ThreeRenderAdapter) {
        super();
        this.render = render;

        // Initialize engine subsystems with game-specific config
        this.streaming = new StreamingManager({
            viewRadiusH: 12,   // Aureus uses larger flat chunks
            viewRadiusV: 1,    // Mostly 2D terrain
            maxLoadsPerFrame: 4,
            maxUnloadsPerFrame: 8,
        });

        this.jobs = new JobSystem();
        this.simulation = new Simulation();
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

    protected async onInit(): Promise<void> {
        console.log('[AureusWorld] Initializing...');

        // Initialize simulation systems
        this.simulation.init();

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
        this.simulation.dispose();
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
        this.streaming.update(cameraChunk);
    }

    jobsFlush(_ctx: FrameContext): void {
        // Apply job results
        const results = this.jobs.drainResults();

        for (const result of results) {
            if (result.kind === 'MESH_CHUNK' && result.success) {
                const meshResult = result as MeshChunkResult;
                // Future: Apply mesh geometry to render
                console.log(`[AureusWorld] Mesh ready: ${meshResult.chunkKey}`);
            }
        }
    }

    simulation(ctx: FixedContext): void {
        // Skip if paused or no dispatch
        if (this.gamePaused || !this.dispatch || !this.getState) return;

        const state = this.getState();

        // Skip if game over
        if (state.step === GameStep.GAME_OVER) return;

        // Accumulate time for 200ms game ticks
        // The engine runs at 60Hz fixed step (16.67ms per step)
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
        this.simulation.tick(ctx);
    }

    renderSync(ctx: FrameContext): void {
        // The VoxelEngine handles its own render loop currently
        // This syncs the state to the renderer

        if (!this.legacyEngine || !this.getState) return;

        const state = this.getState();

        // Sync agents to renderer
        this.legacyEngine.updateAgents(state.agents);

        // Sync global events (affects environment)
        this.legacyEngine.syncEvents(state.activeEvents);

        // Process pending effects
        if (state.pendingEffects && state.pendingEffects.length > 0) {
            for (const effect of state.pendingEffects) {
                DiffBus.publish(effect);
            }
        }
    }

    draw(_ctx: FrameContext): void {
        // VoxelEngine has its own RAF loop currently
        // When fully migrated, this would call:
        // this.render.draw(ctx);
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
                activeChunks: this.streaming.activeCount,
                queuedJobs: this.jobs.queueLength,
                pendingJobs: this.jobs.pendingCount,
            },
        };
    }
}
