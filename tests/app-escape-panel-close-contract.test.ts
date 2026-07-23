import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getSelectedTileClearTransition, getSidebarCloseTransition, getWorldMapCloseTransition } from '../game/ui/appPanelTransitions.ts';

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

test('Escape panel close helpers preserve one-action close behavior', () => {
    assert.deepEqual(getWorldMapCloseTransition(), { showWorldMap: false });
    assert.deepEqual(getSelectedTileClearTransition(), { selectedTilePos: null });
    assert.deepEqual(getSidebarCloseTransition(), { sidebarOpen: 'NONE' });
});

test('App Escape close actions use shared panel close transitions', () => {
    const app = source('App.tsx');

    assert.match(app, /type AppEscapePanelCloseTransition/);
    assert.match(app, /const applyEscapePanelCloseTransition = useCallback/);
    assert.match(app, /applyEscapePanelCloseTransition\(getWorldMapCloseTransition\(\)\);/);
    assert.match(app, /applyEscapePanelCloseTransition\(getSelectedTileClearTransition\(\)\);/);
    assert.match(app, /applyEscapePanelCloseTransition\(getSidebarCloseTransition\(\)\);/);
    assert.equal(app.includes("if (escapeAction === 'CLOSE_WORLD_MAP') {\n                    setShowWorldMap(false);"), false);
    assert.equal(app.includes("if (escapeAction === 'CLEAR_SELECTED_TILE') {\n                    setSelectedTilePos(null);"), false);
    assert.equal(app.includes("if (escapeAction === 'CLOSE_SIDEBAR') {\n                    setSidebarOpen('NONE');"), false);
});
