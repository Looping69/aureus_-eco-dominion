import { SfxType } from '../../types';
import { applyDeepLedgerSurvey } from '../../engine/underground/UndergroundGenerator';

export interface PersistenceBridgeDeps {
    stateManager: any;
    persistenceManager: any;
    workerPool: any;
    terrainRenderSystem: any;
}

export function saveGameWithFeedback(deps: PersistenceBridgeDeps): void {
    const state = deps.stateManager.getState();
    const success = deps.persistenceManager.saveGame(state);

    if (success) {
        state.newsFeed.unshift({
            id: `save_${Date.now()}`,
            headline: 'Game Progress Saved.',
            type: 'POSITIVE',
            timestamp: Date.now()
        });
        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.UI_COIN });
    } else {
        state.newsFeed.unshift({
            id: `save_err_${Date.now()}`,
            headline: 'Save Failed!',
            type: 'CRITICAL',
            timestamp: Date.now()
        });
        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.ERROR });
    }
}

export function loadGameState(data: string | undefined, deps: PersistenceBridgeDeps): void {
    const loadedState = data ? deps.persistenceManager.reviveState(data) : deps.persistenceManager.loadGame();
    if (loadedState) {
        applyDeepLedgerSurvey(loadedState as any);
        deps.stateManager.loadState(loadedState);
        deps.workerPool.broadcast({ type: 'SYNC_CHUNKS', payload: loadedState.chunks });
        deps.terrainRenderSystem.syncGrid(Object.values(loadedState.chunks).flatMap((chunk: any) => chunk.tiles));
        console.log('[AureusWorld] Game Loaded.');
    } else {
        console.warn('[AureusWorld] No save file found.');
    }
}

export function loadRawState(saved: any, deps: Pick<PersistenceBridgeDeps, 'stateManager'>): void {
    applyDeepLedgerSurvey(saved);
    deps.stateManager.loadState(saved);
}

export function saveGameQuietly(deps: Pick<PersistenceBridgeDeps, 'stateManager' | 'persistenceManager'>): void {
    const state = deps.stateManager.getState();
    const success = deps.persistenceManager.saveGame(state);
    if (success) {
        console.log('[AureusWorld] Auto-saved.');
    }
}

export function hasStoredSave(storage: Storage = localStorage): boolean {
    return !!storage.getItem('aureus-game-state');
}
