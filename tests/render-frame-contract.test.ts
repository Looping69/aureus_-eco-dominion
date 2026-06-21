import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const renderFramePath = path.join(root, 'game', 'world', 'renderFrame.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('surface renderer darkens unexplored tiles with feathered black fog', () => {
  const text = source(renderFramePath);

  for (const snippet of [
    "import { getFogOfWarRevealSources, getFogRevealDistance } from '../../engine/sim/fogOfWar/FogOfWarModel';",
    'const FOG_EDGE_FEATHER_RADIUS = 8;',
    "{ name: 'starter-fog-full', opacity: 1 },",
    'class StarterFogOfWarOverlay',
    "this.group.name = 'starter-fog-of-war-overlay';",
    'color: 0x000000,',
    'transparent: opacity < 1,',
    'depthTest: false,',
    'const revealSources = getFogOfWarRevealSources(state);',
    'const sourceSignature = revealSources.map(source => `${source.x},${source.z},${source.radius}`).join('|');',
    'if (tile.fogExplored) continue;',
    'const revealDistance = getFogRevealDistance(tile.x, tile.z, revealSources);',
    'tile.fogExplored = true;',
    'Math.floor((revealDistance / FOG_EDGE_FEATHER_RADIUS)',
    'getStarterFogOfWarOverlay(deps).update(state, deps.getTerrainHeight);',
    'starterFogOfWarOverlay?.setVisible(false);',
  ]) {
    assertSnippet(text, snippet);
  }
});
