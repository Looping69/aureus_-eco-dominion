import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const deps = packageJson.dependencies || {};

const expectedLibraries: Record<string, string> = {
  xstate: 'explicit contracts, tutorial, era, modal, and agent lifecycle state machines',
  zustand: 'React-only UI state for collapsible panels, selected HUD blocks, and modal/session UI',
  'three-mesh-bvh': 'accelerated terrain picking, raycasts, and spatial queries for large Three.js scenes',
  'troika-three-text': 'readable world-space labels for agent intent and building failure reasons',
  'simplex-noise': 'coherent grass, dirt, stone, and water texture variation without smoothing terrain geometry',
  'rot-js': 'underground map, field-of-view, procedural dungeon, and grid-path tooling',
  '@dimforge/rapier3d-compat': 'focused 3D grounding/collision probes for agents, terrain contact, and future vehicles',
};

test('external gameplay and rendering libraries stay declared with documented intent', () => {
  for (const [libraryName, reason] of Object.entries(expectedLibraries)) {
    assert.equal(
      typeof deps[libraryName],
      'string',
      `${libraryName} should stay in package.json because it supports ${reason}.`,
    );
  }
});

test('library choices are pinned to known major versions', () => {
  assert.match(deps.xstate, /^\^5\./);
  assert.match(deps.zustand, /^\^5\./);
  assert.match(deps['three-mesh-bvh'], /^\^0\.9\./);
  assert.match(deps['troika-three-text'], /^\^0\.52\./);
  assert.match(deps['simplex-noise'], /^\^4\./);
  assert.match(deps['rot-js'], /^\^2\./);
  assert.match(deps['@dimforge/rapier3d-compat'], /^\^0\.17\./);
});
