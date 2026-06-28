import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const renderFramePath = path.join(root, 'game', 'world', 'renderFrame.ts');
const environmentRenderPath = path.join(root, 'game', 'render', 'systems', 'EnvironmentRenderSystem.ts');
const gameTypesPath = path.join(root, 'engine', 'types', 'game.ts');
const stateManagerPath = path.join(root, 'engine', 'state', 'StateManager.ts');
const persistenceManagerPath = path.join(root, 'engine', 'sim', 'PersistenceManager.ts');

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
    'fogExplorationTracker.updateFromState(state, markFogExplorationDirty);',
    'this.drawMask(fogExplorationTracker.getCenters(), spawnX, spawnZ);',
    "this.coverMesh.name = 'starter-fog-persistent-world-mask';",
    "ctx.globalCompositeOperation = 'destination-out';",
    'this.texture.needsUpdate = true;',
    "getStarterFogOfWarOverlay(deps).update(state, deps.getTerrainHeight, () => deps.stateManager.markDirty?.('fogExploration'));",
  ]) {
    assertSnippet(text, snippet);
  }
});

test('first person view anchors unexplored mist to the nearest persistent reveal without covering the sky', () => {
  const text = source(renderFramePath);

  for (const snippet of [
    'class FirstPersonFogOfWarMist',
    'const FIRST_PERSON_MIST_HEIGHT = 2.5;',
    'const FIRST_PERSON_MIST_GROUND_OFFSET = 0.05;',
    'getNearestCenter(point: THREE.Vector3): FogRevealCenter | null',
    'const center = fogExplorationTracker.getNearestCenter(cameraPosition)',
    "getFirstPersonFogOfWarMist(deps).update(state, deps.getTerrainHeight, camera.position, () => deps.stateManager.markDirty?.('fogExploration'));",
    'this.group.position.set(center.x, getTerrainHeight(center.x, center.z) + (FIRST_PERSON_MIST_HEIGHT / 2) + FIRST_PERSON_MIST_GROUND_OFFSET, center.z);',
    'firstPersonFogOfWarMist?.setVisible(false);',
    'scene.fog = new THREE.Fog(firstPersonFogColor, STARTER_FOG_CLEAR_RADIUS, STARTER_FOG_CLEAR_RADIUS + (STARTER_FOG_FEATHER_RADIUS * 3));',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('environment sun and moon render above first person fog overlays', () => {
  const text = source(environmentRenderPath);

  for (const snippet of [
    'const CELESTIAL_RENDER_ORDER = 10050;',
    'depthTest: false,',
    'depthWrite: false,',
    'fog: false // Sun not affected by fog',
    "mesh.name = 'environment-sun-moon';",
    'mesh.renderOrder = CELESTIAL_RENDER_ORDER;',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('fog exploration is persisted through save-load game state', () => {
  const gameTypes = source(gameTypesPath);
  const stateManager = source(stateManagerPath);
  const persistenceManager = source(persistenceManagerPath);
  const renderFrame = source(renderFramePath);

  for (const snippet of [
    'export interface FogRevealCenter',
    'export interface FogExplorationState',
    'fogExploration?: FogExplorationState;',
  ]) {
    assertSnippet(gameTypes, snippet);
  }

  for (const snippet of [
    'function normalizeFogExplorationState(fogExploration: any): FogExplorationState',
    'fogExploration: { centers: [], version: 0 },',
    'fogExploration: normalizeFogExplorationState(overrides?.fogExploration ?? baseState.fogExploration),',
  ]) {
    assertSnippet(stateManager, snippet);
  }

  for (const snippet of [
    'private ensureFogExplorationState(state: GameState): void',
    'state.fogExploration = { centers, version } satisfies FogExplorationState;',
    'this.ensureFogExplorationState(state);',
  ]) {
    assertSnippet(persistenceManager, snippet);
  }

  for (const snippet of [
    'function ensureFogExplorationState(state: any): FogExplorationState',
    'private hydratedVersion = -1;',
    'private hydrateFromState(state: any): void',
    'private writeToState(state: any): void',
    'fogState.centers = this.getCenters();',
    'fogState.version = this.version;',
  ]) {
    assertSnippet(renderFrame, snippet);
  }
});