
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { BuildingType, GridTile, Agent, GameDiff, GlobalEvent } from '../types';
import { DiffBus } from './DiffBus';
import { SceneManager } from './SceneManager';
import { WorldManager } from './WorldManager';
import { AgentManager } from './AgentManager';
import { InputManager } from './InputManager';
import { FoliageManager } from './FoliageManager';

export class VoxelEngine {
    private container: HTMLElement;
    private unsubscribeBus: () => void;
    private animationId: number = 0;
    private gridSize: number;
    private lastCpuTime: number = 0;

    // Sub-Systems
    private sceneMgr: SceneManager;
    private worldMgr: WorldManager;
    private agentMgr: AgentManager;
    private inputMgr: InputManager;
    private foliageMgr: FoliageManager;

    constructor(
        container: HTMLElement,
        onTileClick: (index: number) => void,
        onTileRightClick: (index: number) => void,
        onAgentClick: (id: string | null) => void,
        onTileHover: (index: number | null) => void,
        gridSize: number
    ) {
        this.container = container;
        this.gridSize = gridSize;

        // 1. Scene
        this.sceneMgr = new SceneManager(container, gridSize);

        // 2. Systems
        this.foliageMgr = new FoliageManager(this.sceneMgr.scene, gridSize);

        this.worldMgr = new WorldManager(
            this.sceneMgr.scene,
            gridSize,
            // Callback to forward procedural foliage from chunks to FoliageManager
            (key, items) => this.foliageMgr.updateChunk(key, items),
            // Callback to remove chunk foliage
            (key) => this.foliageMgr.removeChunk(key)
        );

        this.agentMgr = new AgentManager(this.sceneMgr.scene, gridSize, (x, z) => this.getSurfaceHeight(x, z));

        // 3. Input
        this.inputMgr = new InputManager(this.sceneMgr, gridSize, {
            onTileClick,
            onTileRightClick,
            onAgentClick,
            onTileHover: (idx, point) => {
                onTileHover(idx);
                this.worldMgr.updateCursor(idx !== null ? point : null, this.worldMgr['currentGhostType']);
            },
            getInteractables: () => [
                ...this.worldMgr.getInteractables(),
                ...this.foliageMgr.getInteractables()
            ],
            getAgents: () => this.agentMgr.getMeshes(),
            getHeightAt: (idx) => this.worldMgr.tileHeightMap.get(idx) || 0
        });

        // 4. Events
        this.unsubscribeBus = DiffBus.subscribe(this.onDiff.bind(this));

        // 5. Loop (Handled by Engine Runtime now)
    }

    // --- API ---

    public initialSync(grid: GridTile[]) {
        this.worldMgr.initialSync(grid);
        this.foliageMgr.updateGrid(grid);
    }

    public updateAgents(agents: Agent[]) {
        this.agentMgr.updateAgents(agents);
    }

    public syncEvents(events: GlobalEvent[]) {
        if (events.length > 0) {
            const currentEvent = events[0];
            this.sceneMgr.setEnvironmentTarget(currentEvent.visualTheme || 'NORMAL');
        } else {
            this.sceneMgr.setEnvironmentTarget('NORMAL');
        }
    }

    public setSelectedAgent(id: string | null) {
        this.agentMgr.setSelectedAgent(id);
    }

    public setInteractionMode(mode: 'BUILD' | 'BULLDOZE' | 'INSPECT') {
        this.worldMgr.setCursorMode(mode);
    }

    public setGhostBuilding(type: BuildingType | null) {
        this.worldMgr.setGhostBuilding(type);
    }

    public setPinnedGhost(index: number | null) {
        this.worldMgr.setPinnedGhost(index);
    }

    public updateGhostColor(isValid: boolean) {
        this.worldMgr.updateGhostColor(isValid);
    }

    public setGhostPath(indices: number[]) {
        this.worldMgr.setGhostPath(indices);
    }

    public triggerEmit(index: number, type: string) {
        this.worldMgr.triggerEmit(index, type);
    }

    public playIntroAnimation(onComplete: () => void) {
        this.sceneMgr.playIntroAnimation(onComplete);
    }

    public getCamera(): THREE.Camera {
        return this.sceneMgr.camera;
    }

    public getDebugStats() {
        const renderInfo = this.sceneMgr.renderer.info;
        const interactables = this.worldMgr.getInteractables();
        const chunksCount = interactables.filter(o => o.type === 'Mesh').length;

        return {
            drawCalls: renderInfo.render.calls,
            triangles: renderInfo.render.triangles,
            points: renderInfo.render.points,
            lines: renderInfo.render.lines,
            geometries: renderInfo.memory.geometries,
            textures: renderInfo.memory.textures,
            programs: renderInfo.programs?.length ?? 0,
            instancedMeshes: chunksCount,
            buildings: this.worldMgr.buildingMeshes.size,
            agents: this.agentMgr.agentMeshes.size,
            particles: this.worldMgr.getParticleCount(),
            cpuTime: this.lastCpuTime
        };
    }

    public cleanup() {
        this.unsubscribeBus();
        cancelAnimationFrame(this.animationId);
        this.inputMgr.cleanup();
        this.sceneMgr.cleanup();
        this.container.removeChild(this.sceneMgr.renderer.domElement);
    }

    // --- Internal ---

    private onDiff(diff: GameDiff) {
        if (diff.type === 'GRID_UPDATE') {
            this.worldMgr.applyGridUpdates(diff.updates);
            this.foliageMgr.updateGrid(diff.updates);
        } else if (diff.type === 'FX') {
            this.worldMgr.triggerEmit(diff.index, diff.fxType);
        }
    }

    /**
     * Render a single frame (driven by Engine Runtime)
     * @param dt Delta time in seconds
     * @param totalTime Total running time in seconds
     */
    public render(dt: number, totalTime: number) {
        this.sceneMgr.updateEnvironment(dt);
        this.worldMgr.updateChunks(this.sceneMgr.cameraFocus.x, this.sceneMgr.cameraFocus.z);

        // Disable shadows earlier for performance
        if (this.sceneMgr.cameraZoom > 40) {
            this.sceneMgr.setShadowsEnabled(false);
        } else {
            this.sceneMgr.setShadowsEnabled(true);
        }

        this.worldMgr.animate(totalTime, this.sceneMgr.cameraZoom);
        this.agentMgr.animate(totalTime, this.sceneMgr.cameraZoom);

        this.sceneMgr.render();

        // this.lastCpuTime = ... // Performance tracking moved to engine profiler
    }

    private getSurfaceHeight(worldX: number, worldZ: number): number {
        const offset = (this.gridSize - 1) / 2;
        const x = Math.max(0, Math.min(this.gridSize - 1, Math.round(worldX + offset)));
        const z = Math.max(0, Math.min(this.gridSize - 1, Math.round(worldZ + offset)));
        const idx = z * this.gridSize + x;
        return this.worldMgr.tileHeightMap.get(idx) || 0;
    }
}
