import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getTileInteractionPanelReset } from '../game/ui/appPanelTransitions.ts';

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

test('tile interaction panel reset closes map, sidebar, and selected tile only', () => {
    assert.deepEqual(getTileInteractionPanelReset(), {
        showWorldMap: false,
        sidebarOpen: 'NONE',
        selectedTilePos: null,
    });
});

test('App tile clicks use the shared tile interaction panel reset', () => {
    const app = source('App.tsx');

    assert.match(app, /getTileInteractionPanelReset/);
    assert.match(app, /const reset = getTileInteractionPanelReset\(\);/);
    assert.equal(app.match(/applyTileInteractionPanelReset\(\);/g)?.length, 3);
    assert.equal(app.includes("setShowWorldMap(false);\n                setSidebarOpen('NONE');\n                setSelectedTilePos(null);"), false);
    assert.equal(app.includes("setShowWorldMap(false);\n            setSidebarOpen('NONE');\n            setSelectedTilePos(null);"), false);
});
