import * as THREE from 'three';
import { FrameContext } from '../../engine/kernel';
import { ChunkStore } from '../../engine/space/ChunkStore';
import { DungeonEngine } from '../../engine/dungeon/DungeonEngine';
import { waterFlowMaterial, oilWaterMaterial, reservoirWaterMaterial } from '../../engine/render/materials/VoxelMaterials';
import { BuildingStatusLabelLayer } from '../render/systems/BuildingStatusLabelLayer';

export interface RenderFrameDeps {
    stateManager: any;
    render: any;
    workerPool: any;
    inputSystem: any;
    terrainRenderSystem: any;
    foliageRenderSystem?: any;
    buildingRenderSystem: any;
    agentRenderSystem: any;
    environmentRenderSystem: any;
    dungeonRenderSystem: any;
    cameraSystem: any;
    dungeonCameraSystem: any;
    fpsCameraSystem: any;
    dungeonInputHandler: any;
    getTerrainHeight: (worldX: number, worldZ: number) => number;
    onSfx?: (sfx: any) => void;
}

let buildingStatusLabelLayer: BuildingStatusLabelLayer | null = null;

class LayeredWorldOverlay {
    private group = new THREE.Group();
    private geometry = new THREE.PlaneGeometry(0.86, 0.86).rotateX(-Math.PI / 2);
    private material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexColors: true,
    });
    private mesh: THREE.InstancedMesh | null = null;
    private lastSignature = '';
    private matrix = new THREE.Matrix4();
    private color = new THREE.Color();

    constructor(scene: THREE.Scene) {
        this.group.name = 'layered-world-overlay';
        this.group.renderOrder = 30;
        scene.add(this.group);
    }

    setVisible(visible: boolean): void {
        this.group.visible = visible;
    }

    update(state: any, getTerrainHeight: (worldX: number, worldZ: number) => number): void {
        const layeredWorld = state.layeredWorld;
        const activeY = layeredWorld?.activeY ?? 0;
        const show = state.activeView === 'SURFACE'
            && activeY < (layeredWorld?.surfaceY ?? 0)
            && ((state.interactionMode as string) === 'DIG' || state.debugMode || activeY !== 0);

        if (!show || !layeredWorld?.chunks) {
            this.setVisible(false);
            this.lastSignature = '';
            return;
        }

        this.setVisible(true);
        const chunkCount = Object.keys(layeredWorld.chunks).length;
        const signature = `${activeY}|${layeredWorld.renderVersion || 0}|${chunkCount}|${state.interactionMode}|${state.debugMode}`;
        if (signature === this.lastSignature) return;
        this.lastSignature = signature;

        const cells: any[] = [];
        for (const chunk of Object.values(layeredWorld.chunks) as any[]) {
            const layer = chunk.layers?.[activeY];
            if (!layer?.cells) continue;
            for (const cell of Object.values(layer.cells) as any[]) {
                if (!cell.revealed) continue;
                if (cell.material === 'BEDROCK') continue;
                cells.push(cell);
                if (cells.length >= 6000) break;
            }
            if (cells.length >= 6000) break;
        }

        this.ensureMesh(Math.max(1, cells.length));
        if (!this.mesh) return;

        for (let i = 0; i < cells.length; i += 1) {
            const cell = cells[i];
            const y = getTerrainHeight(cell.x, cell.z) + 0.045;
            this.matrix.makeTranslation(cell.x, y, cell.z);
            this.mesh.setMatrixAt(i, this.matrix);
            this.mesh.setColorAt(i, this.colorForCell(cell));
        }

        this.mesh.count = cells.length;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) {
            this.mesh.instanceColor.needsUpdate = true;
        }
    }

    private ensureMesh(count: number): void {
        if (this.mesh && this.mesh.instanceMatrix.count >= count) return;
        if (this.mesh) {
            this.group.remove(this.mesh);
            this.mesh.dispose();
        }
        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
        this.mesh.name = 'active-layer-cells';
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 30;
        this.group.add(this.mesh);
    }

    private colorForCell(cell: any): THREE.Color {
        if (cell.material === 'AIR' || cell.contents === 'TUNNEL') return this.color.set('#38e8ff');
        if (cell.material === 'ORE') return this.color.set('#f59e0b');
        if (cell.material === 'GEMS') return this.color.set('#c084fc');
        if (cell.material === 'AUREUS_VEIN') return this.color.set('#facc15');
        if (cell.material === 'SAND') return this.color.set('#d6b06a');
        if (cell.material === 'DIRT') return this.color.set('#7c5a38');
        if (cell.material === 'STONE') return this.color.set('#64748b');
        return this.color.set('#94a3b8');
    }
}

let layeredWorldOverlay: LayeredWorldOverlay | null = null;

function getBuildingStatusLabelLayer(deps: RenderFrameDeps): BuildingStatusLabelLayer {
    if (!buildingStatusLabelLayer) {
        buildingStatusLabelLayer = new BuildingStatusLabelLayer(deps.render.getScene());
    }
    return buildingStatusLabelLayer;
}

function getLayeredWorldOverlay(deps: RenderFrameDeps): LayeredWorldOverlay {
    if (!layeredWorldOverlay) {
        layeredWorldOverlay = new LayeredWorldOverlay(deps.render.getScene());
    }
    return layeredWorldOverlay;
}

function setObjectVisible(object: THREE.Object3D | null | undefined, visible: boolean): void {
    if (object) object.visible = visible;
}

function setSurfaceRenderVisible(deps: RenderFrameDeps, visible: boolean): void {
    const terrainChunks = deps.terrainRenderSystem?.['chunks'] as Map<string, any> | undefined;
    terrainChunks?.forEach((chunk) => {
        setObjectVisible(chunk.mesh, visible);
        setObjectVisible(chunk.waterMesh, visible);
        setObjectVisible(chunk.ghostMesh, visible);
    });

    const foliageChunks = deps.foliageRenderSystem?.['chunkMeshes'] as Map<string, Map<string, THREE.Object3D>> | undefined;
    if (foliageChunks) {
        foliageChunks.forEach((meshes) => {
            meshes.forEach((mesh) => setObjectVisible(mesh, visible));
        });
    } else {
        deps.render.getScene().traverse((object: THREE.Object3D) => {
            if (object.userData?.foliageType) {
                object.visible = visible;
            }
        });
    }

    const buildingMeshes = deps.buildingRenderSystem?.['buildingMeshes'] as Map<number, THREE.Object3D> | undefined;
    buildingMeshes?.forEach((mesh) => setObjectVisible(mesh, visible));
    setObjectVisible(deps.buildingRenderSystem?.['packetGroup'], visible);
    setObjectVisible(deps.buildingRenderSystem?.['overlayGroup'], visible);
    setObjectVisible(deps.buildingRenderSystem?.['packetInstanceLayer']?.['root'], visible);
    setObjectVisible(deps.buildingRenderSystem?.['overlayInstanceLayer']?.['root'], visible);

    const particles = deps.buildingRenderSystem?.['particles'] as Array<{ mesh?: THREE.Object3D }> | undefined;
    particles?.forEach((particle) => setObjectVisible(particle.mesh, visible));

    const agentMeshes = deps.agentRenderSystem?.['agentMeshes'] as Map<string, THREE.Object3D> | undefined;
    agentMeshes?.forEach((mesh) => setObjectVisible(mesh, visible));
    const statusSprites = deps.agentRenderSystem?.['statusSprites'] as Map<string, THREE.Object3D> | undefined;
    statusSprites?.forEach((sprite) => setObjectVisible(sprite, visible));

    if (!visible) {
        setObjectVisible(deps.buildingRenderSystem?.['selectionCursor'], false);
        setObjectVisible(deps.buildingRenderSystem?.['ghostBuilding'], false);
        setObjectVisible(deps.agentRenderSystem?.['agentSelectionRing'], false);
        setObjectVisible(deps.agentRenderSystem?.['eagle'], false);
    }
}

export function drawWorldFrame(ctx: FrameContext, deps: RenderFrameDeps): void {
    const state = deps.stateManager.getState();
    const affectedBuildingChunks = new Set<string>();

    waterFlowMaterial.uniforms.time.value = ctx.time;
    oilWaterMaterial.uniforms.time.value = ctx.time;
    reservoirWaterMaterial.uniforms.time.value = ctx.time;

    processPendingEffects(state, affectedBuildingChunks, deps);
    includeActiveConstructionChunks(state, affectedBuildingChunks);

    const renderDirtyKeys = deps.stateManager.getDirtyKeys();
    if (affectedBuildingChunks.size > 0) {
        renderDirtyKeys.add('chunks');
    }

    updateActiveView(ctx, state, affectedBuildingChunks, renderDirtyKeys, deps);
    updateCursor(state, deps);
    updateEnvironmentAndDraw(ctx, state, deps);

    deps.stateManager.notifyIfDirty();
}

function processPendingEffects(state: any, affectedBuildingChunks: Set<string>, deps: RenderFrameDeps): void {
    if (state.pendingEffects.length === 0) return;

    state.pendingEffects.forEach((effect: any) => {
        if (effect.type === 'AUDIO' && deps.onSfx) {
            deps.onSfx(effect.sfx);
        } else if (effect.type === 'FX') {
            deps.buildingRenderSystem.triggerEffect(effect.x, effect.z, effect.fxType, 0);
        } else if (effect.type === 'CHUNK_UPDATE') {
            const affectedChunks = deps.terrainRenderSystem.updateChunk(effect.cx, effect.cz, effect.updates);
            affectedChunks.forEach((key: string) => affectedBuildingChunks.add(key));

            const key = `${effect.cx},${effect.cz}`;
            const chunk = state.chunks[key];
            if (chunk) {
                deps.workerPool.broadcast({ type: 'UPDATE_CHUNK', payload: { key, chunk } });
            }
        }
    });

    state.pendingEffects.length = 0;
}

function includeActiveConstructionChunks(state: any, affectedBuildingChunks: Set<string>): void {
    Object.entries(state.chunks).forEach(([key, chunk]: [string, any]) => {
        const hasActiveConstruction = chunk.tiles.some((tile: any) => tile.isUnderConstruction);
        if (!hasActiveConstruction) return;

        chunk.simDirty = true;
        affectedBuildingChunks.add(key);
    });
}

function updateActiveView(
    ctx: FrameContext,
    state: any,
    affectedBuildingChunks: Set<string>,
    renderDirtyKeys: Set<string>,
    deps: RenderFrameDeps
): void {
    if (state.activeView === 'DUNGEON') {
        updateDungeonView(state, deps);
        return;
    }

    if (deps.fpsCameraSystem.enabled) {
        updateFirstPersonView(ctx, state, affectedBuildingChunks, renderDirtyKeys, deps);
        return;
    }

    updateSurfaceView(ctx, state, affectedBuildingChunks, renderDirtyKeys, deps);
}

function updateDungeonView(state: any, deps: RenderFrameDeps): void {
    setSurfaceRenderVisible(deps, false);
    deps.dungeonRenderSystem.setVisible(true);
    deps.dungeonRenderSystem.update(state.dungeon);
    buildingStatusLabelLayer?.clear();
    layeredWorldOverlay?.setVisible(false);

    if (!deps.dungeonCameraSystem.enabled) deps.dungeonCameraSystem.setEnabled(true);
    if (deps.cameraSystem.enabled) deps.cameraSystem.setEnabled(false);
    if (deps.fpsCameraSystem.enabled) deps.fpsCameraSystem.setEnabled(false);

    deps.dungeonInputHandler.setCamera(deps.render.getCamera());
    deps.dungeonInputHandler.setMeshGroup(deps.dungeonRenderSystem.getMeshGroup());
    deps.dungeonInputHandler.setDungeonEngine(new DungeonEngine(state.dungeon));
}

function updateFirstPersonView(
    ctx: FrameContext,
    state: any,
    affectedBuildingChunks: Set<string>,
    renderDirtyKeys: Set<string>,
    deps: RenderFrameDeps
): void {
    setSurfaceRenderVisible(deps, true);
    deps.dungeonRenderSystem.setVisible(false);
    layeredWorldOverlay?.setVisible(false);

    if (deps.cameraSystem.enabled) deps.cameraSystem.setEnabled(false);
    if (deps.dungeonCameraSystem.enabled) deps.dungeonCameraSystem.setEnabled(false);

    const camera = deps.render.getCamera();
    deps.fpsCameraSystem.update(ctx.dt, state.agents, deps.getTerrainHeight);
    deps.agentRenderSystem.setSelectedAgent(state.selectedAgentId);

    const allAgents = [...state.agents, ...state.ambientNpcs];
    deps.agentRenderSystem.update(ctx.dt, ctx.time, allAgents, 0.1, camera);
    deps.terrainRenderSystem.update(camera.position, camera);
    deps.buildingRenderSystem.update(
        ctx.dt,
        ctx.time,
        state.chunks,
        state.factory,
        state.logistics.overlayMode,
        renderDirtyKeys,
        affectedBuildingChunks,
        'FIRST_PERSON',
        0.1,
        deps.render.getRuntimeQuality().smoothDetail
    );
    getBuildingStatusLabelLayer(deps).update(state.chunks, camera, ctx.time, 0.1, 'FIRST_PERSON');
}

function updateSurfaceView(
    ctx: FrameContext,
    state: any,
    affectedBuildingChunks: Set<string>,
    renderDirtyKeys: Set<string>,
    deps: RenderFrameDeps
): void {
    setSurfaceRenderVisible(deps, true);
    deps.dungeonRenderSystem.setVisible(false);

    if (!deps.cameraSystem.enabled) deps.cameraSystem.setEnabled(true);
    if (deps.dungeonCameraSystem.enabled) deps.dungeonCameraSystem.setEnabled(false);
    if (deps.fpsCameraSystem.enabled) deps.fpsCameraSystem.setEnabled(false);

    deps.cameraSystem.update(ctx.dt);
    deps.agentRenderSystem.setSelectedAgent(state.selectedAgentId);

    const zoomLevel = deps.cameraSystem.cameraZoom;
    const allAgents = [...state.agents, ...state.ambientNpcs];
    const camera = deps.render.getCamera();
    deps.agentRenderSystem.update(ctx.dt, ctx.time, allAgents, zoomLevel, camera);
    deps.terrainRenderSystem.update(deps.cameraSystem.cameraFocus, camera);
    getLayeredWorldOverlay(deps).update(state, deps.getTerrainHeight);
    deps.buildingRenderSystem.update(
        ctx.dt,
        ctx.time,
        state.chunks,
        state.factory,
        state.logistics.overlayMode,
        renderDirtyKeys,
        affectedBuildingChunks,
        'SURFACE',
        zoomLevel,
        deps.render.getRuntimeQuality().smoothDetail
    );
    getBuildingStatusLabelLayer(deps).update(state.chunks, camera, ctx.time, zoomLevel, 'SURFACE');
}

function updateCursor(state: any, deps: RenderFrameDeps): void {
    if (state.activeView === 'DUNGEON') {
        deps.render.getRenderer().localClippingEnabled = false;
        deps.buildingRenderSystem.updateCursor(null, null);
        return;
    }

    const cursor = deps.inputSystem?.getCurrentCursor() || null;
    if (cursor) {
        const gx = Math.round(cursor.x);
        const gz = Math.round(cursor.z);
        const tile = ChunkStore.getTile(state.chunks, gx, gz);
        cursor.y = tile ? tile.terrainHeight * 0.5 : 0;
    }

    deps.render.getRenderer().localClippingEnabled = false;
    deps.buildingRenderSystem.updateCursor(cursor, deps.cameraSystem.getFocus());
}

function updateEnvironmentAndDraw(ctx: FrameContext, state: any, deps: RenderFrameDeps): void {
    deps.environmentRenderSystem.update(
        ctx.dt,
        state.dayNightCycle?.timeOfDay || 12000,
        state.weather,
        deps.cameraSystem.cameraFocus
    );

    deps.render.draw(ctx);
}
