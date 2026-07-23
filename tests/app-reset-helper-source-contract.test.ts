import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { BuildingType } from '../types.ts';
import {
    getClosedPanelTransition,
    getSelectedTileClearTransition,
    getSidebarCloseTransition,
    getSidebarOpenTransition,
    getTileInteractionPanelReset,
    getWorldMapCloseTransition,
    getWorldMapOpenTransition,
} from '../game/ui/appPanelTransitions.ts';
import {
    getInspectTilePlacementReset,
    getLinePlacementStartPrompt,
    getPlacementPromptReset,
} from '../game/ui/appPlacementReset.ts';

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

test('App reset helpers cover panel and placement reset state shapes', () => {
    assert.deepEqual(getClosedPanelTransition(), { showWorldMap: false, sidebarOpen: 'NONE', selectedTilePos: null, activeHUDBlock: null });
    assert.deepEqual(getSidebarOpenTransition('TRADE'), { showWorldMap: false, sidebarOpen: 'TRADE', selectedTilePos: null, activeHUDBlock: null });
    assert.deepEqual(getWorldMapOpenTransition(), { showWorldMap: true, sidebarOpen: 'NONE', selectedTilePos: null, activeHUDBlock: null });
    assert.deepEqual(getTileInteractionPanelReset(), { showWorldMap: false, sidebarOpen: 'NONE', selectedTilePos: null });
    assert.deepEqual(getWorldMapCloseTransition(), { showWorldMap: false });
    assert.deepEqual(getSelectedTileClearTransition(), { selectedTilePos: null });
    assert.deepEqual(getSidebarCloseTransition(), { sidebarOpen: 'NONE' });
    assert.deepEqual(getPlacementPromptReset(), { pendingPlacementPos: null, pinnedTilePos: null, linePlacementStart: null });
    assert.deepEqual(getLinePlacementStartPrompt(4, 8, BuildingType.PIPE), {
        pendingPlacementPos: null,
        pinnedTilePos: { x: 4, z: 8 },
        linePlacementStart: { x: 4, z: 8, type: BuildingType.PIPE },
    });
    assert.deepEqual(getInspectTilePlacementReset(), { pendingPlacementPos: null, pinnedTilePos: null });
});

test('App reset flows stay routed through reset helper applicators', () => {
    const app = source('App.tsx');

    for (const snippet of [
        'const applyPlacementPromptReset = useCallback(() => {',
        'const applyTileInteractionPanelReset = useCallback(() => {',
        'const applyPanelOpenTransition = useCallback((transition: AppPanelOpenTransition) => {',
        'const applyEscapePanelCloseTransition = useCallback((transition: AppEscapePanelCloseTransition) => {',
        'applyPanelOpenTransition(getSidebarOpenTransition(mode))',
        'applyPanelOpenTransition(getWorldMapOpenTransition())',
        'applyPanelOpenTransition(getClosedPanelTransition())',
        'applyEscapePanelCloseTransition(getWorldMapCloseTransition())',
        'applyEscapePanelCloseTransition(getSelectedTileClearTransition())',
        'applyEscapePanelCloseTransition(getSidebarCloseTransition())',
        'const placementPrompt = getLinePlacementStartPrompt(x, z, selectedBuilding)',
        'const placementReset = getInspectTilePlacementReset()',
    ]) {
        assert.equal(app.includes(snippet), true, `Expected App.tsx to include: ${snippet}`);
    }

    assert.equal(app.match(/applyTileInteractionPanelReset\(\);/g)?.length, 3);
    assert.equal(app.match(/applyEscapePanelCloseTransition\(/g)?.length, 3);

    for (const staleInlineSnippet of [
        'setLinePlacementStart({ x, z, type: selectedBuilding });',
        "setLinePlacementStart(null);\n                setPendingPlacementPos(null);\n                setPinnedTilePos(null);",
        "setPendingPlacementPos(null);\n        setPinnedTilePos(null);\n        setLinePlacementStart(null);",
        "setShowWorldMap(false);\n                setSidebarOpen('NONE');\n                setSelectedTilePos(null);",
        "setShowWorldMap(false);\n            setSidebarOpen('NONE');\n            setSelectedTilePos(null);",
        "if (escapeAction === 'CLOSE_WORLD_MAP') {\n                    setShowWorldMap(false);",
        "if (escapeAction === 'CLEAR_SELECTED_TILE') {\n                    setSelectedTilePos(null);",
        "if (escapeAction === 'CLOSE_SIDEBAR') {\n                    setSidebarOpen('NONE');",
    ]) {
        assert.equal(app.includes(staleInlineSnippet), false, `App.tsx should not reintroduce inline reset state: ${staleInlineSnippet}`);
    }
});
