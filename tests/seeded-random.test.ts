import assert from 'node:assert/strict';
import test from 'node:test';

import { createSeededRandom } from '../engine/kernel/SeededRandom.ts';
import { StateManager } from '../engine/state/StateManager.ts';

test('the engine random stream is reproducible and independent of Aureus state', () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);
    assert.deepEqual(
        [first.next(), first.range(2, 8), first.rangeInt(3, 9), first.chance(0.5)],
        [second.next(), second.range(2, 8), second.rangeInt(3, 9), second.chance(0.5)],
    );
    assert.notEqual(first.next(), createSeededRandom(43).next());
});

test('loading Aureus state resets the existing seeded sequence', () => {
    const manager = new StateManager({ seed: 42 });
    const first = manager.getRandom().next();
    manager.getRandom().next();
    manager.loadState(manager.getState());
    assert.equal(manager.getRandom().next(), first);
});
