import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getClosedPanelTransition } from '../game/ui/appPanelTransitions.ts';

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

test('closed panel transition clears transient App panel state', () => {
    assert.deepEqual(getClosedPanelTransition(), {
        showWorldMap: false,
        sidebarOpen: 'NONE',
        selectedTilePos: null,
        activeHUDBlock: null,
    });
});

test('App start flows use the shared closed panel transition', () => {
    const app = source('App.tsx');

    assert.match(app, /getClosedPanelTransition/);
    assert.equal(app.match(/applyPanelOpenTransition\(getClosedPanelTransition\(\)\)/g)?.length, 3);
    assert.equal(app.includes("setShowWorldMap(false);\n        setSidebarOpen('NONE');\n        setSelectedTilePos(null);\n        clearPlacementPrompt();\n        setShowHomePage(false);"), false);
    assert.equal(app.includes("clearPlacementPrompt();\n                                            setShowWorldMap(false);\n                                            setSidebarOpen('NONE');\n                                            setSelectedTilePos(null);"), false);
});
