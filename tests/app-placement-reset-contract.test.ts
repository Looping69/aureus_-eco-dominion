import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getPlacementPromptReset } from '../game/ui/appPlacementReset.ts';

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

test('placement prompt reset helper clears pending, pinned, and line placement state', () => {
    assert.deepEqual(getPlacementPromptReset(), {
        pendingPlacementPos: null,
        pinnedTilePos: null,
        linePlacementStart: null,
    });
});

test('App placement prompt clearing uses the shared reset shape', () => {
    const app = source('App.tsx');

    assert.match(app, /from '\.\/game\/ui\/appPlacementReset'/);
    assert.match(app, /const reset = getPlacementPromptReset\(\);/);
    assert.match(app, /setPendingPlacementPos\(reset\.pendingPlacementPos\);/);
    assert.match(app, /setPinnedTilePos\(reset\.pinnedTilePos\);/);
    assert.match(app, /setLinePlacementStart\(reset\.linePlacementStart\);/);
    assert.equal(app.includes("setPendingPlacementPos(null);\n        setPinnedTilePos(null);\n        setLinePlacementStart(null);"), false);
});
