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

test('surface renderer darkens the world outside the starting area', () => {
  const text = source(renderFramePath);

  for (const snippet of [
    'const STARTER_FOG_CLEAR_RADIUS = 18;',
    'class StarterFogOfWarOverlay',
    "this.group.name = 'starter-fog-of-war-overlay';",
    'opacity: 0.72,',
    'depthTest: false,',
    'const spawnX = Math.round(state.spawnX ?? 0);',
    'const spawnZ = Math.round(state.spawnZ ?? 0);',
    'if ((dx * dx) + (dz * dz) <= radiusSq) continue;',
    'getStarterFogOfWarOverlay(deps).update(state, deps.getTerrainHeight);',
    'starterFogOfWarOverlay?.setVisible(false);',
  ]) {
    assertSnippet(text, snippet);
  }
});
