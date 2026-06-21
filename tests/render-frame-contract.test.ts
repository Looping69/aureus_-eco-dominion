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

test('surface renderer covers the full world outside the starting area with feathered black fog', () => {
  const text = source(renderFramePath);

  for (const snippet of [
    'const STARTER_FOG_CLEAR_RADIUS = 18;',
    'const STARTER_FOG_FEATHER_RADIUS = 8;',
    'const STARTER_FOG_WORLD_EXTENT = 4096;',
    'class StarterFogOfWarOverlay',
    "this.group.name = 'starter-fog-of-war-overlay';",
    'private coverMaterial = new THREE.MeshBasicMaterial',
    'private featherMaterials = STARTER_FOG_FEATHER_BANDS.map',
    'new THREE.RingGeometry(fullFogRadius, STARTER_FOG_WORLD_EXTENT, 192, 1)',
    "this.coverMesh.name = 'starter-fog-full-world-cover';",
    'new THREE.RingGeometry(innerRadius, outerRadius, 192, 1)',
    'this.group.position.set(spawnX, getTerrainHeight(spawnX, spawnZ) + 0.16, spawnZ);',
    'getStarterFogOfWarOverlay(deps).update(state, deps.getTerrainHeight);',
    'starterFogOfWarOverlay?.setVisible(false);',
  ]) {
    assertSnippet(text, snippet);
  }
});
