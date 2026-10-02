import assert from 'node:assert/strict';
import test from 'node:test';

import { JsonSaveStorage } from '../engine/state/JsonSaveStorage.ts';
import { PersistenceManager } from '../game/state/PersistenceManager.ts';
import { StateManager } from '../game/state/StateManager.ts';
import { hasStoredSave, loadGameState } from '../game/world/persistenceBridge.ts';
import { readFileSync } from 'node:fs';

test('engine save storage accepts a game-specific key and keeps packs isolated', () => {
    const values = new Map<string, string>();
    const storage = {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); },
    } as Storage;
    const first = new JsonSaveStorage('first', () => storage);
    const second = new JsonSaveStorage('second', () => storage);
    first.write('{"score":5}');
    assert.equal(first.read(), '{"score":5}');
    assert.equal(first.has(), true);
    assert.equal(second.has(), false);
    first.remove();
    assert.equal(first.has(), false);
});

test('Aureus save keeps its existing key and revives pruned state', () => {
    const values = new Map<string, string>();
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => { values.set(key, value); },
            removeItem: (key: string) => { values.delete(key); },
        },
    });
    try {
        const persistence = new PersistenceManager();
        const original = new StateManager({ seed: 42 }).getState();
        original.research.unlocked = ['ADVANCED_DRILLING'];
        assert.equal(hasStoredSave(), false);
        assert.equal(persistence.saveGame(original), true);
        assert.equal(values.has('aureus_save_v2'), true);
        assert.equal(hasStoredSave(), true);
        assert.equal(persistence.hasSave(), true);
        const loaded = persistence.loadGame();
        assert.equal(loaded?.seed, 42);
        assert.deepEqual(loaded?.fogExploration, { centers: [], version: 0 });
        assert.ok(loaded?.layeredWorld);
        const manager = new StateManager({ seed: 99 });
        let synced = 0;
        const deps = {
            persistenceManager: persistence, stateManager: manager,
            workerPool: { broadcast: () => { synced++; } },
            terrainRenderSystem: { syncGrid: () => { synced++; } },
        };
        assert.equal(loadGameState(undefined, deps), true);
        assert.equal(manager.getState().seed, 42);
        assert.deepEqual(manager.getState().research.unlocked, ['ADVANCED_DRILLING']);
        assert.equal(synced, 2);
        const restored = manager.getState();
        values.set('aureus_save_v2', '{broken');
        assert.equal(loadGameState(undefined, deps), false);
        assert.equal(manager.getState(), restored, 'invalid save must not replace the live colony');
        assert.equal(synced, 2);
        persistence.clearSave();
        assert.equal(hasStoredSave(), false);
    } finally {
        if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
        else Reflect.deleteProperty(globalThis, 'localStorage');
    }
});

test('Continue loads the stored colony before dismissing the home screen', () => {
    const app = readFileSync('App.tsx', 'utf8');
    const handler = app.slice(app.indexOf('const onContinue ='), app.indexOf('const handleHUDToggle'));
    assert.match(handler, /if \(world\?\.hasSave\(\) && world\.loadGame\(\)\)/);
    assert.ok(handler.indexOf('world.loadGame()') < handler.indexOf('setShowHomePage(false)'));
});

test('Aureus rejects foreign pack envelopes before migration without changing legacy saves', () => {
    const persistence = new PersistenceManager();
    const foreign = JSON.stringify({packId: 'sample.micro-colony', schemaVersion: 1, state: {ticks: 30, energy: 6, beacons: 1}});
    assert.equal(persistence.reviveState(foreign), null);
    const legacy = new StateManager({seed: 42}).serializeState();
    assert.equal(persistence.reviveState(legacy)?.seed, 42);
});
