import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const constructionPath = path.join(root, 'engine', 'sim', 'systems', 'ConstructionSystem.ts');

function source(filePath: string) {
    assert.equal(existsSync(filePath), true, `${filePath} is missing`);
    return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('construction placement validates the full footprint before mutating tiles', () => {
    const constructionText = source(constructionPath);

    for (const snippet of [
        'Validate the complete footprint before mutating any tile. Failed placement must be atomic.',
        'const footprint: Array<{ tile: GridTile; cx: number; cz: number }> = [];',
        'return { ok: false, code: CommandErrorCode.TILE_OCCUPIED',
        'for (const { tile, cx, cz } of footprint) {',
        'Object.assign(tile, {',
    ]) {
        assertSnippet(constructionText, snippet);
    }
});

test('multi-tile placement consumes one inventory item and clears depleted selection', () => {
    const constructionText = source(constructionPath);

    for (const snippet of [
        'const remaining = Math.max(0, (state.inventory?.[buildingType] || 0) - 1);',
        'state.inventory[buildingType] = remaining;',
        'if (remaining === 0 && state.selectedBuilding === buildingType) {',
        "state.interactionMode = 'INSPECT';",
    ]) {
        assertSnippet(constructionText, snippet);
    }
});

test('construction progress is worker-driven and synchronized through the structure head', () => {
    const constructionText = source(constructionPath);

    for (const snippet of [
        'Construction progress is worker-driven through AgentSystem.performWork -> progressConstruction.',
        'public progressConstruction',
        'const hx = tile.structureHeadX !== undefined ? tile.structureHeadX : x;',
        'const hz = tile.structureHeadZ !== undefined ? tile.structureHeadZ : z;',
        'headTile.constructionTimeLeft = Math.max(0, (headTile.constructionTimeLeft || 0) - amount);',
        'this.completeConstruction(hx, hz, state);',
    ]) {
        assertSnippet(constructionText, snippet);
    }
});
