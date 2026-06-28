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

test('surface renderer keeps explored fog areas revealed with a persistent mask', () => {
  const text = source(renderFramePath);

  for (const snippet of [
    'const STARTER_FOG_MASK_TEXTURE_SIZE = 2048;',
    'const STARTER_FOG_REVEAL_GRID = 6;',
    'const AGENT_FOG_REVEAL_RADIUS = 12;',
    'const BUILDING_FOG_REVEAL_RADIUS = 14;',
    'class FogExplorationTracker',
    'private centers = new Map<string, FogRevealCenter>();',
    'function collectCurrentFogRevealCenters(state: any): FogRevealCenter[]',
    'fogExplorationTracker.updateFromState(state);',
    'this.drawMask(fogExplorationTracker.getCenters(), spawnX, spawnZ);',
    "this.coverMesh.name = 'starter-fog-persistent-world-mask';",
    "ctx.globalCompositeOperation = 'destination-out';",
    'this.texture.needsUpdate = true;',
    'getStarterFogOfWarOverlay(deps).update(state, deps.getTerrainHeight);',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('first person view anchors unexplored mist to the nearest persistent reveal', () => {
  const text = source(renderFramePath);

  for (const snippet of [
    'class FirstPersonFogOfWarMist',
    'getNearestCenter(point: THREE.Vector3): FogRevealCenter | null',
    'const center = fogExplorationTracker.getNearestCenter(cameraPosition)',
    'getFirstPersonFogOfWarMist(deps).update(state, deps.getTerrainHeight, camera.position);',
    'firstPersonFogOfWarMist?.setVisible(false);',
    'scene.fog = new THREE.Fog(firstPersonFogColor, STARTER_FOG_CLEAR_RADIUS, STARTER_FOG_CLEAR_RADIUS + (STARTER_FOG_FEATHER_RADIUS * 3));',
  ]) {
    assertSnippet(text, snippet);
  }
});