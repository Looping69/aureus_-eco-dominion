import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const renderFramePath = path.join(root, 'game', 'world', 'renderFrame.ts');
const environmentRenderPath = path.join(root, 'game', 'render', 'systems', 'EnvironmentRenderSystem.ts');
const gameTypesPath = path.join(root, 'game', 'types', 'game.ts');
const stateManagerPath = path.join(root, 'game', 'state', 'createAureusInitialState.ts');
const persistenceManagerPath = path.join(root, 'game', 'state', 'PersistenceManager.ts');
const debugMenuPath = path.join(root, 'components', 'DebugMenu.tsx');
const useAureusEnginePath = path.join(root, 'game', 'useAureusEngine.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

function assertNoSnippet(text: string, snippet: string) {
  assert.doesNotMatch(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('surface fog reads persisted exploration without mutating simulation state', () => {
  const text = source(renderFramePath);
  assertSnippet(text, 'this.drawMask(exploration?.centers ?? [], spawnX, spawnZ);');
  assertSnippet(text, 'exploration === this.lastExploration');
  assertNoSnippet(text, 'fogExplorationTracker.updateFromState');
  assertSnippet(text, "this.coverMesh.name = 'starter-fog-persistent-world-mask';");
});

test('first person fog follows the explored boundary and respects foreground depth', () => {
  const text = source(renderFramePath);
  assertSnippet(text, 'getExploredRayDistance(cameraPosition,');
  assertSnippet(text, 'depthWrite: false, depthTest: true');
  assertSnippet(text, 'this.group.position.set(cameraPosition.x, 0, cameraPosition.z);');
  assertSnippet(text, 'firstPersonFogOfWarMist?.setVisible(false);');
  assertNoSnippet(text, 'getNearestCenter');
  assertNoSnippet(text, 'new THREE.CylinderGeometry');
});

test('system monitor can remove fog overlays completely', () => {
  const debugMenu = source(debugMenuPath);
  const useAureusEngine = source(useAureusEnginePath);
  const renderFrame = source(renderFramePath);

  for (const snippet of [
    "dispatch({ type: 'REMOVE_FOG_OF_WAR' });",
    'fogOfWarDisabled?: boolean',
    "{fogRemoved ? 'Fog Removed' : 'Remove Fog'}",
    'Remove fog of war from both map and first-person views',
  ]) {
    assertSnippet(debugMenu, snippet);
  }

  for (const snippet of [
    "if (action?.type === 'REMOVE_FOG_OF_WAR')",
    'fogOfWarDisabled: true,',
    'version: (state.fogExploration?.version ?? 0) + 1,',
    'reloadWorldState(world, updatedState);',
  ]) {
    assertSnippet(useAureusEngine, snippet);
  }

  for (const snippet of [
    "if (state.fogOfWarDisabled || state.activeView !== 'SURFACE')",
    'starterFogOfWarOverlay?.setVisible(false);',
    'firstPersonFogOfWarMist?.setVisible(false);',
  ]) {
    assertSnippet(renderFrame, snippet);
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
  const renderFrame = source(path.join(root, 'game', 'fog', 'FogExploration.ts'));

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
