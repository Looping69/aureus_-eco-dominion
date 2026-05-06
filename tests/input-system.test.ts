import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldHandlePointerUp } from '../engine/input/pointerSequence.ts';

test('pointerup without a tracked pointer does not leak a world click through UI', () => {
    const shouldHandle = shouldHandlePointerUp({
        pointerId: 99,
        activePointerIds: new Set<number>(),
        isDragging: false,
        hadMultiTouchGesture: false,
    });

    assert.equal(shouldHandle, false);
});

test('pointerup after pointerdown still produces a normal click', () => {
    const shouldHandle = shouldHandlePointerUp({
        pointerId: 7,
        activePointerIds: new Set<number>([7]),
        isDragging: false,
        hadMultiTouchGesture: false,
    });

    assert.equal(shouldHandle, true);
});
