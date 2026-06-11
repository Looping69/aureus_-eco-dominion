import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const appPath = path.join(process.cwd(), 'App.tsx');
const engineHookPath = path.join(process.cwd(), 'game', 'useAureusEngine.ts');
const undergroundHudPath = path.join(process.cwd(), 'components', 'UndergroundHUD.tsx');
const dungeonInputPath = path.join(process.cwd(), 'game', 'dungeon', 'DungeonInputHandler.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Deep Ledger HUD only renders while underground view is active', () => {
  assert.equal(existsSync(appPath), true, 'App.tsx is missing');

  const source = readFileSync(appPath, 'utf8');

  for (const snippet of [
    "state.activeView === 'DUNGEON'",
    '<UndergroundHUD underground={state.underground} />',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Deep Ledger HUD shows the Phase 1 survey metrics explicitly', () => {
  assert.equal(existsSync(undergroundHudPath), true, 'UndergroundHUD.tsx is missing');

  const source = readFileSync(undergroundHudPath, 'utf8');

  for (const snippet of [
    'const sectorLabel = `Sector B${underground.depthLevel}`;',
    '>Depth<',
    '>Stability<',
    '>Oxygen<',
    '>Exposure<',
    '>Surveyed Tiles<',
    '>Hazards<',
    'visibleTiles.length',
    'hazardCount',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Underground HUD exposes playable mine controls', () => {
  assert.equal(existsSync(undergroundHudPath), true, 'UndergroundHUD.tsx is missing');

  const source = readFileSync(undergroundHudPath, 'utf8');

  for (const snippet of [
    'Mine Console',
    'emitDungeonAction',
    "'SET_MODE'",
    "'HIRE_MINER'",
    "'SURFACE_RESOURCES'",
    'build_support',
    'build_recharger',
    'Driller',
    'Excavator',
    'Foreman',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Dungeon input handler receives HUD actions and mutates real mine state', () => {
  assert.equal(existsSync(dungeonInputPath), true, 'DungeonInputHandler.ts is missing');

  const source = readFileSync(dungeonInputPath, 'utf8');

  for (const snippet of [
    "window.addEventListener('aureus:dungeon-action'",
    'handleUiAction',
    'hireMiner',
    'surfaceResources',
    'MINER_COSTS',
    'state.dungeon.miners.push',
    'state.resources.agt += agtGain',
    'window.removeEventListener',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Engine subscription gives React a fresh state reference for UI toggles', () => {
  assert.equal(existsSync(engineHookPath), true, 'useAureusEngine.ts is missing');

  const source = readFileSync(engineHookPath, 'utf8');

  for (const snippet of [
    'worldInstance.subscribeToState((newState) => {',
    'setState({ ...newState });',
    'setState({ ...worldInstance.getState() });',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
