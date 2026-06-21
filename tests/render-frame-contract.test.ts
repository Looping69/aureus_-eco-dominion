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
    'const STARTER_FOG_RENDER_ORDER = 10000;',
    'class StarterFogOfWarOverlay',
    "this.group.name = 'starter-fog-of-war-overlay';",
    'this.group.renderOrder = STARTER_FOG_RENDER_ORDER;',
    'private coverMaterial = new THREE.MeshBasicMaterial',
    'transparent: true,',
    'opacity: 1,',
    'private featherMaterials = STARTER_FOG_FEATHER_BANDS.map',
    'new THREE.RingGeometry(fullFogRadius, STARTER_FOG_WORLD_EXTENT, 192, 1)',
    "this.coverMesh.name = 'starter-fog-full-world-cover';",
    'this.coverMesh.renderOrder = STARTER_FOG_RENDER_ORDER;',
    'new THREE.RingGeometry(innerRadius, outerRadius, 192, 1)',
    'mesh.renderOrder = STARTER_FOG_RENDER_ORDER;',
    'this.group.position.set(spawnX, getTerrainHeight(spawnX, spawnZ) + 0.16, spawnZ);',
    'getStarterFogOfWarOverlay(deps).update(state, deps.getTerrainHeight);',
    'starterFogOfWarOverlay?.setVisible(false);',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('first person view shows unexplored starter fog as dark mist', () => {
  const text = source(renderFramePath);

  for (const snippet of [
    'const firstPersonFogColor = new THREE.Color(0x05070b);',
    'const FIRST_PERSON_MIST_HEIGHT = 72;',
    'const FIRST_PERSON_MIST_RENDER_ORDER = 9990;',
    'const FIRST_PERSON_MIST_BANDS = [',
    'class FirstPersonFogOfWarMist',
    "this.group.name = 'first-person-fog-of-war-mist';",
    'new THREE.CylinderGeometry(band.radius, band.radius, FIRST_PERSON_MIST_HEIGHT, 192, 1, true)',
    'mesh.renderOrder = FIRST_PERSON_MIST_RENDER_ORDER;',
    'getFirstPersonFogOfWarMist(deps).update(state, deps.getTerrainHeight);',
    'firstPersonFogOfWarMist?.setVisible(false);',
    'scene.fog = new THREE.Fog(firstPersonFogColor, STARTER_FOG_CLEAR_RADIUS, STARTER_FOG_CLEAR_RADIUS + (STARTER_FOG_FEATHER_RADIUS * 3));',
  ]) {
    assertSnippet(text, snippet);
  }
});