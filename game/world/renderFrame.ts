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
    wildlifeRenderSystem?: any;
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
const dungeonBackgroundColor = new THREE.Color(0x000000);

type HoverCell = { x: number; z: number } | null;

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

    update(state: any, getTerrainHeight: (worldX: number, worldZ: number) => number, hoverCell: HoverCell): void {
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
        const hoverSignature = hoverCell ? `${hoverCell.x},${hoverCell.z}` : 'none';
        const signature = `${activeY}|${layeredWorld.renderVersion || 0}|${chunkCount}|${state.interactionMode}|${state.debugMode}|${hoverSignature}`;
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
            this.mesh.setColorAt(i, this.colorForCell(cell, hoverCell));
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

    private colorForCell(cell: any, hoverCell: HoverCell): THREE.Color {
        if (hoverCell && cell.x === hoverCell.x && cell.z === hoverCell.z) return this.color.set('#f8fafc');
        if (cell.material === 'AIR' || cell.contents === 'TUNNEL') return this.color.set('#38e8ff');
        if (cell.material === 'RUBBLE' || cell.contents === 'RUBBLE_PILE') return this.color.set('#9a6b3d');
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
    const contactShadows = deps.agentRenderSystem?.['agentContactShadows'] as Map<string, THREE.Object3D> | undefined;
    contactShadows?.forEach((shadow) => setObjectVisible(shadow, visible));
    deps.wildlifeRenderSystem?.setVisible?.(visible);

    if (!visible) {
        deps.foliageRenderSystem?.setGroundDetailVisible?.(false);
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
    deps: RenderFrameDeps,
): void {
    const activeView = state.activeView || 'SURFACE';
    const isSurfaceView = activeView === 'SURFACE';
    const layeredWorld = state.layeredWorld;
    const activeY = layeredWorld?.activeY ?? 0;
    const showLayeredSurface = isSurfaceView && activeY < (layeredWorld?.surfaceY ?? 0);

    setSurfaceRenderVisible(deps, isSurfaceView);
    if (!isSurfaceView) getLayeredWorldOverlay(deps).setVisible(false);

    if (isSurfaceView) {
        if (renderDirtyKeys.has('chunks') || renderDirtyKeys.has('factory')) {
            deps.buildingRenderSystem.update(state.chunks, state.factory, state.logisticsOverlayMode || 'OFF');
        }
        deps.buildingRenderSystem.setVisible(true);
        deps.agentRenderSystem.update(state.agents, deps.getTerrainHeight, state.selectedAgentId ?? null);
        deps.agentRenderSystem.setVisible(true);
        deps.foliageRenderSystem?.update?.(state.chunks, deps.getTerrainHeight, ctx.time, state.dayNightCycle);
        deps.foliageRenderSystem?.setGroundDetailVisible?.(!showLayeredSurface);
        deps.wildlifeRenderSystem?.update?.(state.wildlife, deps.getTerrainHeight, state.dayNightCycle, ctx.time);
        deps.wildlifeRenderSystem?.setVisible?.(!showLayeredSurface);
        deps.cameraSystem.update();
        deps.cameraSystem.applyCamera();
        const cursor = deps.inputSystem.getCursorWorldPosition?.();
        const hoverCell = cursor ? { x: Math.round(cursor.x), z: Math.round(cursor.z) } : null;
        getLayeredWorldOverlay(deps).update(state, deps.getTerrainHeight, hoverCell);
    } else {
        getLayeredWorldOverlay(deps).setVisible(false);
        deps.dungeonRenderSystem.update(ctx, deps.dungeonCameraSystem.getCamera(), state.dungeon, state.underground);
        deps.dungeonInputHandler.update(ctx, state.dungeon);
        deps.dungeonCameraSystem.update(ctx);
    }

    if (state.firstPersonMode && state.controlledAgentId) {
        deps.fpsCameraSystem.update(state, ctx.time);
    }
}

function updateCursor(state: any, deps: RenderFrameDeps): void {
    if (state.activeView !== 'SURFACE') return;
    const cursorPos = deps.inputSystem.getCursorWorldPosition();
    deps.buildingRenderSystem.updateCursor(
        cursorPos,
        state.selectedBuildingType,
        state.interactionMode,
        state.buildingInventory,
        state.era,
        state.previewLineStart,
        state.previewLineEnd,
    );
}

function updateEnvironmentAndDraw(ctx: FrameContext, state: any, deps: RenderFrameDeps): void {
    deps.environmentRenderSystem.update(ctx.time, state.dayNightCycle, state.weather, state.activeEvents, state.activeView || 'SURFACE');
    deps.render.renderFrame();
}
