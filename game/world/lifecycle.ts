export interface WorldLifecycleDeps {
    workerPool: any;
    sim: any;
    jobs: any;
    inputSystem: any;
    stateManager: any;
    terrainRenderSystem: any;
    buildingRenderSystem: any;
    cameraSystem: any;
    render: any;
    setupAutoSave: () => void;
    cleanupAutoSave: () => void;
    saveGameQuiet: () => void;
}

export async function initializeWorldRuntime(deps: WorldLifecycleDeps): Promise<void> {
    console.log('[AureusWorld] Initializing...');

    deps.workerPool.init();
    deps.sim.init();

    const state = deps.stateManager.getState();
    deps.workerPool.broadcast({ type: 'SYNC_CHUNKS', payload: state.chunks });
    deps.terrainRenderSystem.syncGrid(Object.values(state.chunks).flatMap((chunk: any) => chunk.tiles));
    deps.buildingRenderSystem.update(
        0,
        0,
        state.chunks,
        state.factory,
        state.logistics.overlayMode,
        new Set(),
        undefined,
        'SURFACE',
        deps.cameraSystem.cameraZoom,
        deps.render.getRuntimeQuality().smoothDetail
    );

    if (state.agents.length > 0) {
        const firstAgent = state.agents[0];
        deps.cameraSystem.zoomToPosition(firstAgent.x, firstAgent.z, 2);
        console.log(`[AureusWorld] Camera focused on agent "${firstAgent.name}" at (${firstAgent.x}, ${firstAgent.z})`);
    }

    console.log('[AureusWorld] Ready');
    deps.setupAutoSave();
}

export async function teardownWorldRuntime(deps: WorldLifecycleDeps): Promise<void> {
    console.log('[AureusWorld] Tearing down...');

    deps.cleanupAutoSave();
    deps.saveGameQuiet();
    deps.sim.dispose();
    deps.workerPool.dispose();
    deps.jobs.clear();
    deps.inputSystem?.dispose();
}
