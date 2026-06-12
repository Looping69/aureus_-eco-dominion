import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const subsurfaceModelPath = path.join(root, 'engine', 'subsurface', 'SubsurfaceModel.ts');
const commandDispatcherPath = path.join(root, 'engine', 'sim', 'systems', 'CommandDispatcher.ts');
const controlsPath = path.join(root, 'components', 'Controls.tsx');
const aureusWorldPath = path.join(root, 'game', 'AureusWorld.ts');
const planPath = path.join(root, 'docs', 'subsurface-reset-plan.md');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

test('subsurface model is the canonical excavation helper', () => {
  const text = source(subsurfaceModelPath);

  for (const snippet of [
    'export const SUBSURFACE_FOUNDATION_VERSION = 1;',
    'export function layeredChunkKey',
    'export function layeredCellKey',
    'export function getOpenPitEntryLayer',
    'export function setActiveSubsurfaceLayer',
    'export function excavateSubsurfaceCell',
    "cell.material = 'AIR';",
    "cell.contents = 'TUNNEL';",
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('dig command delegates to subsurface model instead of duplicating cell rules', () => {
  const text = source(commandDispatcherPath);

  assert.match(text, /import \{ excavateSubsurfaceCell \} from '..\/..\/subsurface\/SubsurfaceModel';/);
  assert.match(text, /return excavateSubsurfaceCell\(state, x, y, z\);/);
  assert.doesNotMatch(text, /const LAYER_CHUNK_SIZE = 16;/);
});

test('below-sector controls target layered open-pit mode', () => {
  const text = source(controlsPath);

  for (const snippet of [
    'const SURFACE_LAYER = 0;',
    'const isBelowSurface = activeLayer < SURFACE_LAYER;',
    "title={isBelowSurface ? 'Return to Surface (U)' : 'Open Subsurface Cut (U)'}",
    "className={`view-switch-button ${isBelowSurface ? 'is-dungeon' : 'is-surface'} w-12 h-12 !p-0`}",
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('world toggle opens surface-connected subsurface layers, not the old dungeon view', () => {
  const text = source(aureusWorldPath);

  for (const snippet of [
    "import { getOpenPitEntryLayer, setActiveSubsurfaceLayer } from '../engine/subsurface/SubsurfaceModel';",
    "this.stateManager.mutate('layeredWorld', setActiveSubsurfaceLayer(layeredWorld, getOpenPitEntryLayer(layeredWorld)));",
    "this.setInteractionMode('DIG');",
    "this.stateManager.mutate('layeredWorld', setActiveSubsurfaceLayer(layeredWorld, layeredWorld.surfaceY));",
    "case 'SET_LAYERED_ACTIVE_Y': this.setLayeredActiveY(action.payload); break;",
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.doesNotMatch(text, /this\.stateManager\.mutate\('activeView', 'DUNGEON'\);/);
});

test('subsurface reset plan explains what stays and what is retired', () => {
  const text = source(planPath);

  for (const snippet of [
    '`layeredWorld` is now the canonical underground model',
    'Open-pit mining reveals and removes cells below the surface from the normal surface camera.',
    'Deep mines later use shafts/elevators to enter enclosed layers',
    'DungeonState` as a gameplay source of truth',
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
