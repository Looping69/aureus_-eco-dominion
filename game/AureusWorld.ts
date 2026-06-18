/**
 * Aureus Game World (v2 - Engine Owned State)
 *
 * The engine owns all game state. React is a pure view layer.
 */

import { BaseWorld } from '../engine/world';
import { FrameContext, FixedContext } from '../engine/kernel';
import * as THREE from 'three';
import { StreamingManager } from '../engine/space';
import { JobSystem, MeshChunkResult, PathfindResult, WorkerPool } from '../engine/jobs';
import { ThreeRenderAdapter } from '../engine/render';
import { Simulation } from '../engine/sim';
import {
    AgentSystem, JobGenerationSystem, EnvironmentSystem, EconomySystem,
    ColonySystem, LogisticsSystem, EventSystem, MissionSystem,
    ProductionSystem, ConstructionSystem, EraSystem,
    PowerGridSystem, WaterNetworkSystem,
    TutorialDemoSystem, CommandDispatcher, UndergroundSurveySystem,
    ResearchSystem, EmploymentSystem, BureaucracySystem, AmbientNPCSystem,
    AIOverseerSystem
} from '../engine/sim/systems';
import { DungeonMinerSystem } from '../engine/sim/systems/DungeonMinerSystem';
import { DungeonStabilitySystem } from '../engine/sim/systems/DungeonStabilitySystem';
import { PersistenceManager } from '../engine/sim/PersistenceManager';
import { getOpenPitEntryLayer, setActiveSubsurfaceLayer } from '../engine/subsurface/SubsurfaceModel';
import { GameState, GameStep, BuildingType, SfxType, Action } from '../types';
import { BUILDINGS } from '../engine/data/VoxelConstants';
import { getBiomeAt } from '../engine/worldgen/Core';
import { TerrainRenderSystem } from './render/systems/TerrainRenderSystem';
import { FoliageRenderSystem } from './render/systems/FoliageRenderSystem';
import { BuildingRenderSystem } from './render/systems/BuildingRenderSystem';
import { AgentRenderSystem } from './render/systems/AgentRenderSystem';
import { AmbientWildlifeRenderSystem } from './render/systems/AmbientWildlifeRenderSystem';
import { EnvironmentRenderSystem } from './render/systems/EnvironmentRenderSystem';
import { DungeonRenderSystem } from './render/systems/DungeonRenderSystem';
import { LinePlacementPreview } from './render/LinePlacementPreview';
import { IsoCameraSystem } from './render/IsoCameraSystem';
import { DungeonCameraSystem } from './render/DungeonCameraSystem';
import { FPSCameraSystem } from './render/FPSCameraSystem';
import { DungeonInputHandler } from './dungeon/DungeonInputHandler';
import { InputSystem } from '../engine/input/InputSystem';
import { StateManager, StateListener } from '../engine/state/StateManager';
import { EconomyManager, BuildingManager, ResearchManager, AgentManager } from './world';
import { ChunkStore } from '../engine/space/ChunkStore';
import { confirmMobilePlacement } from './mobilePlacement';
import { drawWorldFrame } from './world/renderFrame';
import { handleSurfaceInteraction as handleWorldSurfaceInteraction, SurfaceInteractionType } from './world/interaction';
import { initializeWorldRuntime, teardownWorldRuntime } from './world/lifecycle';
import { hasStoredSave, loadGameState, loadRawState, saveGameQuietly, saveGameWithFeedback } from './world/persistenceBridge';
import { acceptWorldContract, abandonWorldContract, deliverWorldContract } from './world/contractBridge';

export interface AureusWorldConfig {
    container: HTMLElement;
    onTileClick?: (x: number, z: number, isTouch?: boolean) => void;
    onTileRightClick?: (x: number, z: number, isTouch?: boolean) => void;
    onAgentClick?: (agentId: string | null) => void;
    onTileHover?: (x: number | null, z: number | null) => void;
    onSfx?: (type: SfxType) => void;
}

const INFRASTRUCTURE_LINE_TYPES = new Set<BuildingType>([
    BuildingType.ROAD,
    BuildingType.PIPE,
    BuildingType.POWER_LINE,
    BuildingType.FENCE,
]);

export class AureusWorld extends BaseWorld {
    readonly id = 'aureus-main';

    private render: ThreeRenderAdapter;
    private inputSystem: InputSystem | null = null;
    private streamMgr: StreamingManager;
    private jobs: JobSystem;
    private workerPool: WorkerPool;
    private sim: Simulation;
    private stateManager: StateManager;

    private agentSystem: AgentSystem;
    private constructionSystem: ConstructionSystem;
    private commandDispatcher: CommandDispatcher;
    private aiOverseerSystem: AIOverseerSystem;

    private agentRenderSystem: AgentRenderSystem;
    private terrainRenderSystem: TerrainRenderSystem;
    private foliageRenderSystem: FoliageRenderSystem;
    private buildingRenderSystem: BuildingRenderSystem;
    private wildlifeRenderSystem: AmbientWildlifeRenderSystem;
    private environmentRenderSystem: EnvironmentRenderSystem;
    private linePlacementPreview: LinePlacementPreview;
    protected cameraSystem!: IsoCameraSystem;
    protected dungeonCameraSystem!: DungeonCameraSystem;
    protected fpsCameraSystem!: FPSCameraSystem;
    private dungeonRenderSystem: DungeonRenderSystem;
    private dungeonInputHandler: DungeonInputHandler;

    private persistenceManager: PersistenceManager;
    private economyManager: EconomyManager;
    private buildingManager: BuildingManager;
    private researchManager: ResearchManager;
    private agentManager: AgentManager;
    private getTerrainHeight: (worldX: number, worldZ: number) => number;

    private gamePaused = false;
    private config: AureusWorldConfig | null = null;

    private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
    private visibilityHandler: (() => void) | null = null;
    private readonly AUTO_SAVE_INTERVAL_MS = 60000;

    constructor(render: ThreeRenderAdapter) {
        super();
        this.render = render;
        this.stateManager = new StateManager();
        this.persistenceManager = new PersistenceManager();
        this.streamMgr = new StreamingManager({
            viewRadiusH: 12,
            viewRadiusV: 2,
            maxLoadsPerFrame: 8,
            maxUnloadsPerFrame: 16,
        });
        this.jobs = new JobSystem();
        this.workerPool = new WorkerPool();
        this.sim = new Simulation();

        const econ = this.registerSimulationSystems();
        const researchSystem = this.registerAgentAndResearchSystems();
        this.commandDispatcher.setSystems([
            econ,
            this.constructionSystem,
            this.agentSystem,
            researchSystem,
            this.aiOverseerSystem,
            this.simSystems.tutorialDemo,
            this.simSystems.bureaucracySystem
        ]);

        const getHeight = (worldX: number, worldZ: number) => {
            const state = this.stateManager.getState();
            const tile = ChunkStore.getTile(state.chunks, Math.round(worldX), Math.round(worldZ));
            if (tile) return tile.terrainHeight * 0.5;
            const biomeData = getBiomeAt(Math.round(worldX), Math.round(worldZ));
            return biomeData.height * 0.5;
        };

        this.getTerrainHeight = getHeight;
        this.agentRenderSystem = new AgentRenderSystem(this.render.getScene(), getHeight);
        this.terrainRenderSystem = new TerrainRenderSystem(this.render.getScene(), this.jobs);
        this.foliageRenderSystem = new FoliageRenderSystem(this.render.getScene());
        this.buildingRenderSystem = new BuildingRenderSystem(this.render.getScene());
        this.wildlifeRenderSystem = new AmbientWildlifeRenderSystem(this.render.getScene());
        this.environmentRenderSystem = new EnvironmentRenderSystem(this.render);
        this.linePlacementPreview = new LinePlacementPreview(this.render.getScene(), getHeight);
        this.dungeonRenderSystem = new DungeonRenderSystem(this.render.getScene());
        this.cameraSystem = new IsoCameraSystem(this.render);
        this.dungeonCameraSystem = new DungeonCameraSystem(this.render);
        this.fpsCameraSystem = new FPSCameraSystem(this.render);
        this.fpsCameraSystem.setOnExit(() => this.dispatch({ type: 'EXIT_FPS' } as any));
        this.dungeonInputHandler = new DungeonInputHandler(this.stateManager, this.render.getScene());

        this.terrainRenderSystem.onFoliageUpdate = (key: string, items: any[]) => {
            this.foliageRenderSystem.updateChunk(key, items);
        };
        this.terrainRenderSystem.onGroundDetailUpdate = (key: string, tiles: any[]) => {
            this.foliageRenderSystem.updateGroundDetailChunk(key, tiles);
        };
        this.terrainRenderSystem.onChunkDispose = (key: string) => {
            this.foliageRenderSystem.removeChunk(key);
        };

        this.cameraSystem.setEnabled(true);
        const state = this.stateManager.getState();
        this.cameraSystem.jumpTo(state.spawnX, state.spawnZ);

        this.economyManager = new EconomyManager(this.stateManager);
        this.buildingManager = new BuildingManager(this.stateManager, this.buildingRenderSystem);
        this.researchManager = new ResearchManager(this.stateManager);
        this.agentManager = new AgentManager(this.stateManager, this.cameraSystem);
    }

    private simSystems!: {
        tutorialDemo: TutorialDemoSystem;
        bureaucracySystem: BureaucracySystem;
    };

    private registerSimulationSystems(): EconomySystem {
        this.commandDispatcher = new CommandDispatcher();
        this.sim.addSystem(this.commandDispatcher);

        this.constructionSystem = new ConstructionSystem();
        this.sim.addSystem(this.constructionSystem);
        this.sim.addSystem(new JobGenerationSystem());
        this.sim.addSystem(new EnvironmentSystem());
        this.sim.addSystem(new UndergroundSurveySystem());

        const econ = new EconomySystem();
        this.sim.addSystem(econ);
        this.sim.addSystem(new ColonySystem());
        this.sim.addSystem(new LogisticsSystem());
        this.sim.addSystem(new EventSystem());
        this.sim.addSystem(new MissionSystem());
        this.aiOverseerSystem = new AIOverseerSystem();
        this.sim.addSystem(this.aiOverseerSystem);
        this.sim.addSystem(new PowerGridSystem());
        this.sim.addSystem(new WaterNetworkSystem());
        this.sim.addSystem(new ProductionSystem());
        this.sim.addSystem(new EraSystem());

        const tutorialDemo = new TutorialDemoSystem();
        this.sim.addSystem(tutorialDemo);
        this.sim.addSystem(new DungeonMinerSystem());
        this.sim.addSystem(new DungeonStabilitySystem());

        const bureaucracySystem = new BureaucracySystem();
        this.sim.addSystem(bureaucracySystem);
        this.simSystems = { tutorialDemo, bureaucracySystem };

        return econ;
    }

    private registerAgentAndResearchSystems(): ResearchSystem {
        this.sim.addSystem(new EmploymentSystem());
        this.agentSystem = new AgentSystem(this.jobs, this.constructionSystem);
        this.sim.addSystem(this.agentSystem);
        this.sim.addSystem(new AmbientNPCSystem());

        const researchSystem = new ResearchSystem();
        this.sim.addSystem(researchSystem);
        return researchSystem;
    }

    getState(): GameState {
        return this.stateManager.getState();
    }

    subscribeToState(listener: StateListener): () => void {
        return this.stateManager.subscribe(listener);
    }

    placeBuilding(x: number, z: number, type?: string): void {
        const state = this.stateManager.getState();
        const buildingType = (type || state.selectedBuilding) as BuildingType;
        console.log('[placeBuilding] Called with (x, z):', x, z, 'buildingType:', buildingType);

        if (!buildingType) {
            console.warn('[placeBuilding] No buildingType, returning');
            return;
        }

        const def = BUILDINGS[buildingType];
        if (!def) {
            console.warn('[placeBuilding] No def for buildingType, returning');
            return;
        }

        this.stateManager.pushCommand('PLACE_BUILDING', { x, z, buildingType });
        this.stateManager.pushEffect({ type: 'AUDIO', sfx: SfxType.BUILD });
    }

    previewInfrastructureLine(startX: number, startZ: number, endX: number, endZ: number, type?: string): void {
        const state = this.stateManager.getState();
        const buildingType = (type || state.selectedBuilding) as BuildingType;
        if (!INFRASTRUCTURE_LINE_TYPES.has(buildingType)) {
            this.clearInfrastructureLinePreview();
            return;
        }

        const deltaX = endX - startX;
        const deltaZ = endZ - startZ;
        const horizontal = Math.abs(deltaX) >= Math.abs(deltaZ);
        const finalX = horizontal ? endX : startX;
        const finalZ = horizontal ? startZ : endZ;
        const requestedLength = Math.max(Math.abs(finalX - startX), Math.abs(finalZ - startZ)) + 1;
        const available = state.cheatsEnabled ? requestedLength : (state.inventory?.[buildingType] || 0);
        this.linePlacementPreview.setLine(startX, startZ, endX, endZ, buildingType, available);
    }

    clearInfrastructureLinePreview(): void {
        this.linePlacementPreview.clear();
    }

    placeInfrastructureLine(startX: number, startZ: number, endX: number, endZ: number, type?: string): void {
        const state = this.stateManager.getState();
        const buildingType = (type || state.selectedBuilding) as BuildingType;
        if (!INFRASTRUCTURE_LINE_TYPES.has(buildingType)) {
            this.placeBuilding(endX, endZ, buildingType);
            return;
        }

        this.clearInfrastructureLinePreview();
        const deltaX = endX - startX;
        const deltaZ = endZ - startZ;
        const horizontal = Math.abs(deltaX) >= Math.abs(deltaZ);
        const finalX = horizontal ? endX : startX;
        const finalZ = horizontal ? startZ : endZ;
        const stepX = Math.sign(finalX - startX);
        const stepZ = Math.sign(finalZ - startZ);
        const requestedLength = Math.max(Math.abs(finalX - startX), Math.abs(finalZ - startZ)) + 1;
        const available = state.cheatsEnabled ? requestedLength : (state.inventory?.[buildingType] || 0);
        const placeCount = Math.min(requestedLength, available);

        if (placeCount <= 0) {
            this.stateManager.pushEffect({ type: 'AUDIO', sfx: SfxType.ERROR });
            return;
        }

        for (let i = 0; i < placeCount; i++) {
            this.stateManager.pushCommand('PLACE_BUILDING', {
                x: startX + stepX * i,
                z: startZ + stepZ * i,
                buildingType,
            });
        }

        this.stateManager.pushEffect({ type: 'AUDIO', sfx: SfxType.BUILD });

        if (placeCount < requestedLength) {
            const def = BUILDINGS[buildingType];
            state.newsFeed.unshift({
                id: `line_short_${Date.now()}`,
                headline: `Only ${placeCount}/${requestedLength} ${def?.name || 'infrastructure'} pieces available for that line.`,
                type: 'NEGATIVE',
                timestamp: state.tickCount,
            });
            this.stateManager.markDirty('newsFeed');
        }
    }

    bulldozeTile(x: number, z: number): void {
        const tile = ChunkStore.getTile(this.stateManager.getState().chunks, x, z);
        if (!tile) return;
        this.stateManager.pushCommand('BULLDOZE', { x, z });
        this.stateManager.pushEffect({ type: 'AUDIO', sfx: SfxType.BUILD });
    }

    selectBuilding(type: string | null): void {
        this.buildingRenderSystem.setGhostBuilding(type as BuildingType | null);
        if (type) {
            this.stateManager.update({ selectedBuilding: type as BuildingType, interactionMode: 'BUILD' });
        } else {
            this.clearInfrastructureLinePreview();
            this.stateManager.update({ selectedBuilding: null, selectedAgentId: null, interactionMode: 'INSPECT' });
        }
    }

    pinBuildingForConfirmation(x: number, z: number): void {
        const tile = ChunkStore.getTile(this.stateManager.getState().chunks, x, z);
        const y = tile ? tile.terrainHeight * 0.5 : 0;
        this.buildingRenderSystem.setPinnedGhost({ x, z }, y);
    }

    clearPinnedBuilding(): void {
        this.buildingRenderSystem.setPinnedGhost(null);
    }

    confirmMobileBuildingPlacement(index: number): boolean {
        return confirmMobilePlacement(() => false, () => this.clearPinnedBuilding(), index);
    }

    selectAgent(id: string | null): void {
        this.stateManager.update({ selectedAgentId: id });
    }

    commandAgent(agentId: string, x: number, z: number): void {
        this.stateManager.pushCommand('COMMAND_AGENT', { agentId, x, z });
    }

    setInteractionMode(mode: 'BUILD' | 'BULLDOZE' | 'INSPECT' | 'DIG'): void {
        if (mode !== 'BUILD') this.clearInfrastructureLinePreview();
        this.stateManager.update({ interactionMode: mode });
        this.buildingRenderSystem.setCursorMode(mode as any);
    }

    sellResource(resource: 'minerals' | 'gems' | 'wood' | 'stone'): void { this.economyManager.sellResource(resource); }
    sellMinerals(): void { this.economyManager.sellMinerals(); }
    sellGems(address?: string): void { this.economyManager.sellGems(address); }
    sellWood(): void { this.economyManager.sellWood(); }
    sellStone(): void { this.economyManager.sellStone(); }
    buyResource(resource: 'minerals' | 'gems' | 'wood' | 'stone', amount: number): void { this.economyManager.buyResource(resource, amount); }
    buyBuilding(buildingType: string, cost: number): void { this.economyManager.buyBuilding(buildingType, cost); }
    setAutoSell(enabled: boolean, threshold: number): void { this.economyManager.setAutoSell(enabled, threshold); }
    upgradeBuilding(x: number, z: number): void { this.buildingManager.upgradeBuilding(x, z); }
    researchTech(techId: string): void { this.stateManager.pushCommand('RESEARCH_TECH', { techId }); }

    toggleDebug(): void {
        const state = this.stateManager.getState();
        this.stateManager.mutate('debugMode', !state.debugMode);
        this.stateManager.notifyIfDirty();
    }

    toggleCheats(): void {
        const state = this.stateManager.getState();
        this.stateManager.mutate('cheatsEnabled', !state.cheatsEnabled);
        this.stateManager.notifyIfDirty();
    }

    speedUpConstruction(x: number, z: number): void { this.buildingManager.speedUpConstruction(x, z); }

    setLayeredActiveY(y: number): void {
        const state = this.stateManager.getState();
        if (!state.layeredWorld?.enabled) return;
        this.stateManager.mutate('activeView', 'SURFACE');
        this.stateManager.mutate('layeredWorld', setActiveSubsurfaceLayer(state.layeredWorld, y));
    }

    zoomToAgent(agentId: string): void {
        const agent = this.stateManager.getState().agents.find(a => a.id === agentId);
        if (agent) this.cameraSystem.zoomToPosition(agent.x, agent.z, 2);
    }

    enterFPS(agentId: string): void {
        this.selectAgent(agentId);
        this.fpsCameraSystem.attachTo(agentId);
        this.stateManager.update({ interactionMode: 'INSPECT', isFPS: true });
    }

    exitFPS(): void {
        const state = this.stateManager.getState();
        if (state.selectedAgentId) {
            const agent = state.agents.find(a => a.id === state.selectedAgentId);
            if (agent) {
                if (agent.state === 'MANUAL') agent.state = 'IDLE';
                this.cameraSystem.jumpTo(agent.x, agent.z);
            }
        }
        this.stateManager.markDirty('agents');
        this.fpsCameraSystem.setEnabled(false);
        this.stateManager.update({ isFPS: false });
    }

    dismissEraPopup(): void {
        this.stateManager.update({ eraUnlockedPopup: null });
        this.stateManager.notifyIfDirty();
    }

    acceptContract(contractId: string): void { acceptWorldContract(this.stateManager, contractId); }
    deliverContract(contractId: string): void { deliverWorldContract(this.stateManager, contractId); }
    abandonContract(contractId: string): void { abandonWorldContract(this.stateManager, contractId); }
    advanceTutorial(): void { this.stateManager.pushCommand('ADVANCE_TUTORIAL', {}); }

    startDemo(): void {
        this.stateManager.pushCommand('START_DEMO', {});
        this.setGamePaused(false);
    }

    rehabilitateTile(x: number, z: number): void { this.stateManager.pushCommand('REHABILITATE', { x, z }); }
    saveGame(): void { saveGameWithFeedback(this.getPersistenceDeps()); }
    loadGame(data?: string): void { loadGameState(data, this.getPersistenceDeps()); }

    configure(config: AureusWorldConfig): void {
        this.config = config;
        this.inputSystem = new InputSystem(this.render, this.getTerrainHeight);
        this.inputSystem.onTileClick = (x, z, isTouch, clientX, clientY) => {
            this.handleSurfaceInteraction(x, z, 'click', isTouch, clientX, clientY);
        };
        this.inputSystem.onTileRightClick = (x, z, isTouch, clientX, clientY) => {
            this.handleSurfaceInteraction(x, z, 'right-click', isTouch, clientX, clientY);
        };
        this.inputSystem.onTileHover = (x, z, clientX, clientY) => {
            this.handleSurfaceInteraction(x || 0, z || 0, 'hover', false, clientX, clientY);
            this.config?.onTileHover?.(x, z);
        };
        this.fpsCameraSystem.onLeftClick = () => {
            const hit = this.getFPSIntersection();
            if (hit) this.handleSurfaceInteraction(hit.x, hit.z, 'click');
        };
        this.fpsCameraSystem.onRightClick = () => {
            const hit = this.getFPSIntersection();
            if (hit) this.handleSurfaceInteraction(hit.x, hit.z, 'right-click');
        };
        this.inputSystem.init();
    }

    private getFPSIntersection(): { x: number, z: number } | null {
        const camera = this.render.getPerspectiveCamera();
        const raycaster = new THREE.Raycaster();
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        raycaster.set(camera.position, direction);

        const target = new THREE.Vector3();
        let currentPlaneHeight = 0;
        for (let iter = 0; iter < 4; iter++) {
            const iterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -currentPlaneHeight);
            const hit = raycaster.ray.intersectPlane(iterPlane, target);
            if (!hit) return null;
            const terrainHeight = this.getTerrainHeight(hit.x, hit.z);
            if (Math.abs(terrainHeight - currentPlaneHeight) < 0.1) {
                return { x: Math.round(hit.x), z: Math.round(hit.z) };
            }
            currentPlaneHeight = terrainHeight;
        }
        return { x: Math.round(target.x), z: Math.round(target.z) };
    }

    protected async onInit(): Promise<void> {
        return initializeWorldRuntime(this.getLifecycleDeps());
    }

    protected async onTeardown(): Promise<void> {
        this.linePlacementPreview.dispose();
        this.wildlifeRenderSystem.dispose();
        return teardownWorldRuntime(this.getLifecycleDeps());
    }

    private setupAutoSave(): void {
        this.autoSaveInterval = setInterval(() => this.saveGameQuiet(), this.AUTO_SAVE_INTERVAL_MS);
        this.visibilityHandler = () => {
            if (document.visibilityState === 'hidden') this.saveGameQuiet();
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);
        window.addEventListener('beforeunload', () => this.saveGameQuiet());
        console.log('[AureusWorld] Auto-save enabled (interval: 60s)');
    }

    private cleanupAutoSave(): void {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }
    }

    private saveGameQuiet(): void {
        saveGameQuietly(this.getPersistenceDeps());
    }

    frameBegin(_ctx: FrameContext): void {}

    streaming(_ctx: FrameContext): void {
        const camera = this.render.getCamera();
        this.streamMgr.update({
            x: Math.floor(camera.position.x / 16),
            y: 0,
            z: Math.floor(camera.position.z / 16),
        });
    }

    jobsFlush(_ctx: FrameContext): void {
        this.workerPool.dispatch(this.jobs);
        const results = this.jobs.drainResults();
        if (results.length === 0) return;

        this.stateManager.setMutableContext('simTick');
        const state = this.stateManager.getMutableState();
        for (const result of results) {
            if (result.kind === 'MESH_CHUNK' && result.success) {
                this.terrainRenderSystem.processResults([result as MeshChunkResult]);
            } else if (result.kind === 'PATHFIND') {
                this.agentSystem.receiveJobResult(result as PathfindResult, state);
            }
        }
        this.stateManager.setMutableContext('none');
    }

    simulation(ctx: FixedContext): void {
        if (this.gamePaused) return;
        ctx.random = this.stateManager.getRandom();
        ctx.getNextId = (prefix) => this.stateManager.getNextId(prefix);

        this.stateManager.setMutableContext('simTick');
        const state = this.stateManager.getMutableState();
        if (state.step === GameStep.GAME_OVER) {
            this.stateManager.setMutableContext('none');
            return;
        }

        state.tickCount++;
        if (state.isFPS && state.selectedAgentId) {
            const move = this.fpsCameraSystem.getMovement();
            if (move.length() > 0) {
                const speed = 4.0;
                this.stateManager.pushCommand('MANUAL_MOVE_AGENT', {
                    agentId: state.selectedAgentId,
                    dx: move.x * speed * ctx.fixedDt,
                    dz: move.z * speed * ctx.fixedDt
                });
            }
        }

        this.sim.tick(ctx, state);
        this.stateManager.setMutableContext('none');
    }

    draw(ctx: FrameContext): void {
        drawWorldFrame(ctx, {
            stateManager: this.stateManager,
            render: this.render,
            workerPool: this.workerPool,
            inputSystem: this.inputSystem,
            terrainRenderSystem: this.terrainRenderSystem,
            foliageRenderSystem: this.foliageRenderSystem,
            buildingRenderSystem: this.buildingRenderSystem,
            wildlifeRenderSystem: this.wildlifeRenderSystem,
            agentRenderSystem: this.agentRenderSystem,
            environmentRenderSystem: this.environmentRenderSystem,
            dungeonRenderSystem: this.dungeonRenderSystem,
            cameraSystem: this.cameraSystem,
            dungeonCameraSystem: this.dungeonCameraSystem,
            fpsCameraSystem: this.fpsCameraSystem,
            dungeonInputHandler: this.dungeonInputHandler,
            getTerrainHeight: this.getTerrainHeight,
            onSfx: this.config?.onSfx,
        });
    }

    frameEnd(_ctx: FrameContext): void {}

    private handleSurfaceInteraction(
        x: number,
        z: number,
        type: SurfaceInteractionType,
        isTouch: boolean = false,
        clientX?: number,
        clientY?: number
    ): void {
        if (!this.config) return;
        handleWorldSurfaceInteraction(x, z, type, {
            stateManager: this.stateManager,
            dungeonInputHandler: this.dungeonInputHandler,
            config: this.config,
            selectAgent: (agentId) => this.selectAgent(agentId),
            bulldozeTile: (tileX, tileZ) => this.bulldozeTile(tileX, tileZ),
        }, isTouch, clientX, clientY);
    }

    setGamePaused(paused: boolean): void { this.gamePaused = paused; }
    playIntroAnimation(onComplete: () => void): void { this.cameraSystem.playIntroAnimation(onComplete); }
    setGhostBuilding(type: BuildingType | null): void { this.buildingRenderSystem.setGhostBuilding(type); }

    toggleViewMode(): void {
        const state = this.stateManager.getState();
        const layeredWorld = state.layeredWorld;
        if (!layeredWorld?.enabled) return;

        const isBelowSurface = layeredWorld.activeY < layeredWorld.surfaceY;
        if (!isBelowSurface) {
            const accessUnlocked = state.cheatsEnabled || state.underground.unlocked || state.dungeon.unlocked;
            if (!accessUnlocked) {
                state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.ERROR });
                state.newsFeed.push({
                    id: `subsurface_locked_${Date.now()}`,
                    headline: state.resources.trust < 50
                        ? 'Subsurface cut locked. Reach Trust 50 to authorize excavation.'
                        : 'Subsurface cut locked. Build a Survey Drill to authorize excavation.',
                    type: 'NEGATIVE',
                    timestamp: Date.now(),
                });
                this.stateManager.markDirty('pendingEffects', 'newsFeed');
                return;
            }
            if (state.cheatsEnabled && !state.underground.unlocked) {
                state.underground.unlocked = true;
                state.dungeon.unlocked = true;
                this.stateManager.markDirty('underground', 'dungeon');
            }

            this.stateManager.mutate('activeView', 'SURFACE');
            this.stateManager.mutate('layeredWorld', setActiveSubsurfaceLayer(layeredWorld, getOpenPitEntryLayer(layeredWorld)));
            this.setInteractionMode('DIG');
            return;
        }

        this.stateManager.mutate('activeView', 'SURFACE');
        this.stateManager.mutate('layeredWorld', setActiveSubsurfaceLayer(layeredWorld, layeredWorld.surfaceY));
        if (state.interactionMode === 'DIG') this.setInteractionMode('INSPECT');
    }

    toggleView(): void { this.toggleViewMode(); }

    dispatch(action: Action): void {
        console.log(`[AureusWorld] Dispatching: ${action.type}`, (action as any).payload);
        switch (action.type) {
            case 'PLACE_BUILDING': this.placeBuilding(action.payload.x, action.payload.z); break;
            case 'BULLDOZE_TILE': this.bulldozeTile(action.payload.x, action.payload.z); break;
            case 'ACTIVATE_BULLDOZER': this.setInteractionMode('BULLDOZE'); break;
            case 'UPGRADE_BUILDING': this.upgradeBuilding(action.payload.x, action.payload.z); break;
            case 'SPEED_UP_BUILDING': this.speedUpConstruction(action.payload.x, action.payload.z); break;
            case 'REHABILITATE_TILE': this.rehabilitateTile(action.payload.x, action.payload.z); break;
            case 'SELECT_BUILDING_TO_PLACE': this.selectBuilding(action.payload); break;
            case 'SELECT_AGENT': this.selectAgent(action.payload); break;
            case 'COMMAND_AGENT': this.commandAgent(action.payload.agentId, action.payload.x, action.payload.z); break;
            case 'SET_INTERACTION_MODE': this.setInteractionMode(action.payload as any); break;
            case 'SET_LAYERED_ACTIVE_Y': this.setLayeredActiveY(action.payload); break;
            case 'SELL_MINERALS': this.sellMinerals(); break;
            case 'SELL_GEMS': this.sellGems(action.payload.address); break;
            case 'SELL_WOOD': this.sellWood(); break;
            case 'SELL_STONE': this.sellStone(); break;
            case 'BUY_RESOURCE': this.buyResource(action.payload.resource, action.payload.amount); break;
            case 'BUY_BUILDING':
                this.buyBuilding(action.payload.type, action.payload.cost);
                this.selectBuilding(action.payload.type);
                break;
            case 'UPDATE_LOGISTICS': this.updateLogistics(action.payload); break;
            case 'UNLOCK_TECH': this.researchTech(action.payload); break;
            case 'TOGGLE_DEBUG': this.toggleDebug(); break;
            case 'TOGGLE_CHEATS': this.toggleCheats(); break;
            case 'TOGGLE_VIEW': this.toggleViewMode(); break;
            case 'SAVE_GAME': this.saveGame(); break;
            case 'LOAD_GAME': this.loadState(action.payload); break;
            case 'ADVANCE_TUTORIAL': this.advanceTutorial(); break;
            case 'START_DEMO': this.startDemo(); break;
            case 'ACCEPT_CONTRACT': this.acceptContract(action.payload?.contractId ?? action.payload); break;
            case 'DELIVER_CONTRACT': this.deliverContract(action.payload?.contractId ?? action.payload); break;
            case 'ABANDON_CONTRACT': this.abandonContract(action.payload?.contractId ?? action.payload); break;
            case 'ENTER_FPS': this.enterFPS(action.payload || this.stateManager.getState().selectedAgentId || ''); break;
            case 'EXIT_FPS': this.exitFPS(); break;
            case 'DISMISS_NEWS': break;
            case 'SUBMIT_PERMIT': this.stateManager.pushCommand('SUBMIT_PERMIT', { permitId: action.payload }); break;
            case 'TALK_TO_NPC': this.stateManager.pushCommand('TALK_TO_NPC', { npcId: action.payload }); break;
            case 'CHOOSE_DIALOGUE': this.stateManager.pushCommand('CHOOSE_DIALOGUE', { optionIndex: action.payload }); break;
            case 'CLOSE_DIALOGUE': this.stateManager.pushCommand('CLOSE_DIALOGUE', {}); break;
            default: console.warn(`[AureusWorld] Unhandled action type: ${(action as any).type}`);
        }
    }

    private updateLogistics(payload: any): void {
        const state = this.stateManager.getState();
        if (payload.autoSell !== undefined) {
            this.setAutoSell(payload.autoSell, payload.sellThreshold ?? state.logistics.sellThreshold);
        }
        if (payload.overlayMode !== undefined && state.logistics.overlayMode !== payload.overlayMode) {
            this.stateManager.mutate('logistics', { ...state.logistics, overlayMode: payload.overlayMode });
        }
    }

    private loadState(saved: any): void {
        loadRawState(saved, this.getPersistenceDeps());
    }

    hasSave(): boolean {
        return hasStoredSave();
    }

    getDebugStats() {
        const renderStats = this.render.getStats();
        const state = this.stateManager.getState();
        return {
            qualityLevel: this.render.getRuntimeQuality().label,
            qualitySmoothDetail: this.render.getRuntimeQuality().smoothDetail,
            qualityPixelRatio: this.render.getRuntimeQuality().pixelRatio,
            qualityShadows: this.render.getRuntimeQuality().shadowMap,
            drawCalls: renderStats.drawCalls,
            triangles: renderStats.triangles,
            points: renderStats.points,
            lines: renderStats.lines,
            geometries: renderStats.geometries,
            textures: renderStats.textures,
            programs: renderStats.programs,
            buildings: Object.values(state.chunks).reduce((sum, chunk) =>
                sum + (chunk as any).tiles.filter((tile: any) => tile.buildingType !== 'EMPTY').length, 0),
            agents: state.agents.length,
            particles: 0,
            instancedMeshes: this.streamMgr.activeCount,
            queuedJobs: this.jobs.queueLength,
            pendingJobs: this.jobs.pendingCount,
        };
    }

    private getPersistenceDeps() {
        return {
            stateManager: this.stateManager,
            persistenceManager: this.persistenceManager,
            workerPool: this.workerPool,
            terrainRenderSystem: this.terrainRenderSystem,
        };
    }

    private getLifecycleDeps() {
        return {
            workerPool: this.workerPool,
            sim: this.sim,
            jobs: this.jobs,
            inputSystem: this.inputSystem,
            stateManager: this.stateManager,
            terrainRenderSystem: this.terrainRenderSystem,
            buildingRenderSystem: this.buildingRenderSystem,
            cameraSystem: this.cameraSystem,
            render: this.render,
            setupAutoSave: () => this.setupAutoSave(),
            cleanupAutoSave: () => this.cleanupAutoSave(),
            saveGameQuiet: () => this.saveGameQuiet(),
        };
    }
}
