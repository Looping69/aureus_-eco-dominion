import assert from 'node:assert/strict';
import test from 'node:test';

import { JsonSaveStorage } from '../engine/state/JsonSaveStorage.ts';
import { PersistenceManager } from '../game/state/PersistenceManager.ts';
import { StateManager } from '../game/state/StateManager.ts';

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
        assert.equal(persistence.saveGame(original), true);
        assert.equal(values.has('aureus_save_v2'), true);
        const loaded = persistence.loadGame();
        assert.equal(loaded?.seed, 42);
        assert.deepEqual(loaded?.fogExploration, { centers: [], version: 0 });
        assert.ok(loaded?.layeredWorld);
    } finally {
        if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
        else Reflect.deleteProperty(globalThis, 'localStorage');
    }
});
