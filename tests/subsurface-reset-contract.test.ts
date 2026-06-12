import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const agentsTypesPath = path.join(root, 'engine', 'types', 'agents.ts');
const subsurfaceModelPath = path.join(root, 'engine', 'subsurface', 'SubsurfaceModel.ts');
const commandDispatcherPath = path.join(root, 'engine', 'sim', 'systems', 'CommandDispatcher.ts');
const jobGenerationPath = path.join(root, 'engine', 'sim', 'systems', 'JobGenerationSystem.ts');
const agentSystemPath = path.join(root, 'engine', 'sim', 'systems', 'AgentSystem.ts');
const controlsPath = path.join(root, 'components', 'Controls.tsx');
const aureusWorldPath = path.join(root, 'game', 'AureusWorld.ts');
const renderFramePath = path.join(root, 'game', 'world', 'renderFrame.ts');
const planPath = path.join(root, 'docs', 'subsurface-reset-plan.md');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('subsurface model is the canonical excavation and job helper', () => {
  const text = source(subsurfaceModelPath);

  for (const snippet of [
    'export const SUBSURFACE_FOUNDATION_VERSION = 1;',
    "export const SUBSURFACE_DIG_JOB_PREFIX = 'dig_sub';",
    'export function layeredChunkKey',
    'export function layeredCellKey',
    'export function getOpenPitEntryLayer',
    'export function setActiveSubsurfaceLayer',
    'export function queueSubsurfaceExcavationJob',
    'export function excavateSubsurfaceCell',
    "type: 'MINE',",
    'targetY: y,',
    "cell.material = 'AIR';",
    "cell.contents = 'TUNNEL';",
  ]) {
    assertSnippet(text, snippet);
  }
});

test('subsurface jobs can carry a layer target', () => {
  const text = source(agentsTypesPath);
  assertSnippet(text, 'targetY?: number;');
});

test('dig command queues agent work instead of instantly removing cells', () => {
  const text = source(commandDispatcherPath);

  assert.match(text, /import \{ queueSubsurfaceExcavationJob \} from '..\/..\/subsurface\/SubsurfaceModel';/);
  assert.match(text, /return queueSubsurfaceExcavationJob\(state, x, y, z\);/);
  assert.doesNotMatch(text, /return excavateSubsurfaceCell\(state, x, y, z\);/);
  assert.doesNotMatch(text, /const LAYER_CHUNK_SIZE = 16;/);
});

test('job cleanup preserves valid subsurface excavation jobs', () => {
  const text = source(jobGenerationPath);

  for (const snippet of [
    "import { getSubsurfaceCell, isSubsurfaceDigJob } from '../../subsurface/SubsurfaceModel';",
    'this.cleanupJobs(jobs, state);',
    'if (isSubsurfaceDigJob(job)) {',
    'getSubsurfaceCell(state.layeredWorld, job.targetX, y, job.targetZ)',
    'valid = Boolean(cell?.mineable && cell?.destructible);',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('agents complete subsurface excavation jobs through real work', () => {
  const text = source(agentSystemPath);

  for (const snippet of [
    "import { excavateSubsurfaceCell, getSubsurfaceCell, isSubsurfaceDigJob } from '../../subsurface/SubsurfaceModel';",
    "if (jobId.startsWith('dig_sub_')) return 'Excavating subsurface block.';",
    "if (jobId.startsWith('dig_sub_')) return 'Walking to excavation marker.';",
    "if (job.type === 'MINE' && isSubsurfaceDigJob(job)) {",
    'this.performSubsurfaceExcavation(ctx, agent, state, jobIdx);',
    'const result = excavateSubsurfaceCell(state, job.targetX, y, job.targetZ);',
    "headline: `${agent.name} opened a subsurface block on layer ${y}.`,",
  ]) {
    assertSnippet(text, snippet);
  }
});

test('below-sector controls target layered open-pit mode', () => {
  const text = source(controlsPath);

  for (const snippet of [
    'const SURFACE_LAYER = 0;',
    'const isBelowSurface = activeLayer < SURFACE_LAYER;',
    "title={isBelowSurface ? 'Return to Surface (U)' : 'Open Subsurface Cut (U)'}",
    "className={`view-switch-button ${isBelowSurface ? 'is-dungeon' : 'is-surface'} w-12 h-12 !p-0`}",
  ]) {
    assertSnippet(text, snippet);
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
    assertSnippet(text, snippet);
  }

  assert.doesNotMatch(text, /this\.stateManager\.mutate\('activeView', 'DUNGEON'\);/);
});

test('surface layer overlay highlights the hovered subsurface cell', () => {
  const text = source(renderFramePath);

  for (const snippet of [
    'type HoverCell = { x: number; z: number } | null;',
    'const hoverSignature = hoverCell ? `${hoverCell.x},${hoverCell.z}` : \'none\';',
    'this.mesh.setColorAt(i, this.colorForCell(cell, hoverCell));',
    "if (hoverCell && cell.x === hoverCell.x && cell.z === hoverCell.z) return this.color.set('#f8fafc');",
    'const hoverCell = cursor ? { x: Math.round(cursor.x), z: Math.round(cursor.z) } : null;',
    'getLayeredWorldOverlay(deps).update(state, deps.getTerrainHeight, hoverCell);',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('subsurface reset plan explains what stays and what is retired', () => {
  const text = source(planPath);

  for (const snippet of [
    '`layeredWorld` is now the canonical underground model',
    'Open-pit mining reveals and removes cells below the surface from the normal surface camera.',
    'Deep mines later use shafts/elevators to enter enclosed layers',
    'DungeonState` as a gameplay source of truth',
  ]) {
    assertSnippet(text, snippet);
  }
});
