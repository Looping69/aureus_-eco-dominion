import { FrameContext } from '../../engine/kernel';
import { ChunkStore } from '../../engine/space/ChunkStore';
import { DungeonEngine } from '../../engine/dungeon/DungeonEngine';
import { waterFlowMaterial, oilWaterMaterial, reservoirWaterMaterial } from '../../engine/render/materials/VoxelMaterials';

export interface RenderFrameDeps {
    stateManager: any;
    render: any;
    workerPool: any;
    inputSystem: any;
    terrainRenderSystem: any;
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

export function drawWorldFrame(ctx: FrameContext, deps: RenderFrameDeps): void {
    const state = deps.stateManager.getState();
    const affectedBuildingChunks = new Set<string>();

    waterFlowMaterial.uniforms.time.value = ctx.time;
    oilWaterMaterial.uniforms.time.value = ctx.time;
    reservoirWaterMaterial.uniforms.time.value = ctx.time;

    processPendingEffects(state, affectedBuildingChunks, deps);
    updateActiveView(ctx, state, affectedBuildingChunks, deps);
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

function updateActiveView(ctx: FrameContext, state: any, affectedBuildingChunks: Set<string>, deps: RenderFrameDeps): void {
    if (state.activeView === 'DUNGEON') {
        updateDungeonView(state, deps);
        return;
    }

    if (deps.fpsCameraSystem.enabled) {
        updateFirstPersonView(ctx, state, affectedBuildingChunks, deps);
        return;
    }

    updateSurfaceView(ctx, state, affectedBuildingChunks, deps);
}

function updateDungeonView(state: any, deps: RenderFrameDeps): void {
    deps.dungeonRenderSystem.setVisible(true);
    deps.dungeonRenderSystem.update(state.dungeon);

    if (!deps.dungeonCameraSystem.enabled) deps.dungeonCameraSystem.setEnabled(true);
    if (deps.cameraSystem.enabled) deps.cameraSystem.setEnabled(false);
    if (deps.fpsCameraSystem.enabled) deps.fpsCameraSystem.setEnabled(false);

    deps.dungeonInputHandler.setCamera(deps.render.getCamera());
    deps.dungeonInputHandler.setMeshGroup(deps.dungeonRenderSystem.getMeshGroup());
    deps.dungeonInputHandler.setDungeonEngine(new DungeonEngine(state.dungeon));
}

function updateFirstPersonView(ctx: FrameContext, state: any, affectedBuildingChunks: Set<string>, deps: RenderFrameDeps): void {
    deps.dungeonRenderSystem.setVisible(false);

    if (deps.cameraSystem.enabled) deps.cameraSystem.setEnabled(false);
    if (deps.dungeonCameraSystem.enabled) deps.dungeonCameraSystem.setEnabled(false);

    deps.fpsCameraSystem.update(ctx.dt, state.agents, deps.getTerrainHeight);
    deps.agentRenderSystem.setSelectedAgent(state.selectedAgentId);

    const allAgents = [...state.agents, ...state.ambientNpcs];
    deps.agentRenderSystem.update(ctx.dt, ctx.time, allAgents, 0.1);
    deps.terrainRenderSystem.update(deps.render.getCamera().position, deps.render.getCamera());
    deps.buildingRenderSystem.update(
        ctx.dt,
        ctx.time,
        state.chunks,
        state.factory,
        state.logistics.overlayMode,
        deps.stateManager.getDirtyKeys(),
        affectedBuildingChunks,
        'FIRST_PERSON',
        0.1,
        deps.render.getRuntimeQuality().smoothDetail
    );
}

function updateSurfaceView(ctx: FrameContext, state: any, affectedBuildingChunks: Set<string>, deps: RenderFrameDeps): void {
    deps.dungeonRenderSystem.setVisible(false);

    if (!deps.cameraSystem.enabled) deps.cameraSystem.setEnabled(true);
    if (deps.dungeonCameraSystem.enabled) deps.dungeonCameraSystem.setEnabled(false);
    if (deps.fpsCameraSystem.enabled) deps.fpsCameraSystem.setEnabled(false);

    deps.cameraSystem.update(ctx.dt);
    deps.agentRenderSystem.setSelectedAgent(state.selectedAgentId);

    const zoomLevel = deps.cameraSystem.cameraZoom;
    const allAgents = [...state.agents, ...state.ambientNpcs];
    deps.agentRenderSystem.update(ctx.dt, ctx.time, allAgents, zoomLevel);
    deps.terrainRenderSystem.update(deps.cameraSystem.cameraFocus, deps.render.getCamera());
    deps.buildingRenderSystem.update(
        ctx.dt,
        ctx.time,
        state.chunks,
        state.factory,
        state.logistics.overlayMode,
        deps.stateManager.getDirtyKeys(),
        affectedBuildingChunks,
        'SURFACE',
        zoomLevel,
        deps.render.getRuntimeQuality().smoothDetail
    );
}

function updateCursor(state: any, deps: RenderFrameDeps): void {
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
