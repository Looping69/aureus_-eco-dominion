import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { BuildingType } from '../types.ts';
import { getInspectTilePlacementReset, getLinePlacementStartPrompt, getPlacementPromptReset } from '../game/ui/appPlacementReset.ts';

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

test('line placement start helper pins and previews the selected infrastructure start tile', () => {
    assert.deepEqual(getLinePlacementStartPrompt(3, 9, BuildingType.ROAD), {
        pendingPlacementPos: null,
        pinnedTilePos: { x: 3, z: 9 },
        linePlacementStart: { x: 3, z: 9, type: BuildingType.ROAD },
    });
});

test('inspect placement reset helper clears placement prompt state without choosing the inspected tile', () => {
    assert.deepEqual(getInspectTilePlacementReset(), {
        pendingPlacementPos: null,
        pinnedTilePos: null,
    });
});

test('App placement prompt clearing uses the shared reset shape', () => {
    const app = source('App.tsx');

    assert.match(app, /from '\.\/game\/ui\/appPlacementReset'/);
    assert.match(app, /const applyPlacementPromptReset = useCallback\(\(\) => \{/);
    assert.match(app, /const reset = getPlacementPromptReset\(\);/);
    assert.match(app, /setPendingPlacementPos\(reset\.pendingPlacementPos\);/);
    assert.match(app, /setPinnedTilePos\(reset\.pinnedTilePos\);/);
    assert.match(app, /setLinePlacementStart\(reset\.linePlacementStart\);/);
    assert.equal(app.includes("setPendingPlacementPos(null);\n        setPinnedTilePos(null);\n        setLinePlacementStart(null);"), false);
});

test('App line placement start and completion reuse placement helper shapes', () => {
    const app = source('App.tsx');

    assert.match(app, /const placementPrompt = getLinePlacementStartPrompt\(x, z, selectedBuilding\);/);
    assert.match(app, /setLinePlacementStart\(placementPrompt\.linePlacementStart\);/);
    assert.match(app, /setPendingPlacementPos\(placementPrompt\.pendingPlacementPos\);/);
    assert.match(app, /setPinnedTilePos\(placementPrompt\.pinnedTilePos\);/);
    assert.match(app, /worldInstance\?\.placeInfrastructureLine\([\s\S]*?applyPlacementPromptReset\(\);[\s\S]*?return;/);
    assert.equal(app.includes('setLinePlacementStart({ x, z, type: selectedBuilding });'), false);
    assert.equal(app.includes("setLinePlacementStart(null);\n                setPendingPlacementPos(null);\n                setPinnedTilePos(null);"), false);
});

test('App inspect tile clicks reuse the inspect placement reset shape', () => {
    const app = source('App.tsx');

    assert.match(app, /const placementReset = getInspectTilePlacementReset\(\);/);
    assert.match(app, /setPendingPlacementPos\(placementReset\.pendingPlacementPos\);/);
    assert.match(app, /setPinnedTilePos\(placementReset\.pinnedTilePos\);/);
    assert.equal(app.includes("setPendingPlacementPos(null);\n            setPinnedTilePos(null);\n            setSelectedTilePos({ x, z });"), false);
});
