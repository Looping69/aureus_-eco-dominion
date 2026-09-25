import assert from 'node:assert/strict';
import test from 'node:test';

import { StateStore } from '../engine/state/StateStore.ts';
import { StateManager } from '../game/state/StateManager.ts';

test('engine state storage accepts an unrelated game state factory', () => {
    type OtherGame = { score: number; scene: string };
    const store = new StateStore<OtherGame>(overrides => ({ score: overrides?.score ?? 1, scene: overrides?.scene ?? 'menu' }));
    const snapshots: OtherGame[] = [];
    const unsubscribe = store.subscribe(state => snapshots.push({ ...state }));
    store.update({ score: 4 });
    assert.deepEqual([...store.getDirtyKeys()], ['score']);
    store.notifyIfDirty();
    assert.deepEqual(snapshots, [{ score: 4, scene: 'menu' }]);
    store.loadState({ score: 9, scene: 'playing' });
    assert.equal(store.serializeState(), '{"score":9,"scene":"playing"}');
    unsubscribe();
    store.update({ score: 10 });
    store.notifyIfDirty();
    assert.equal(snapshots.length, 2);
});

test('game-owned state manager revives partial legacy Aureus state', () => {
    const manager = new StateManager({ seed: 42 });
    const original = manager.getState();
    const legacy = { ...original, fogExploration: undefined, layeredWorld: undefined } as typeof original;
    manager.loadState(legacy);
    assert.deepEqual(manager.getState().fogExploration, { centers: [], version: 0 });
    assert.ok(manager.getState().layeredWorld);
    assert.equal(manager.getState().seed, 42);
});
