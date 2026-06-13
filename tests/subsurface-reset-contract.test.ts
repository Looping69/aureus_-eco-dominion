import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const agentsTypesPath = path.join(root, 'engine', 'types', 'agents.ts');
const worldTypesPath = path.join(root, 'engine', 'types', 'world.ts');
const layeredWorldTypesPath = path.join(root, 'engine', 'types', 'layeredWorld.ts');
const layeredWorldGeneratorPath = path.join(root, 'engine', 'worldgen', 'LayeredWorldGenerator.ts');
const subsurfaceModelPath = path.join(root, 'engine', 'subsurface', 'SubsurfaceModel.ts');
const commandDispatcherPath = path.join(root, 'engine', 'sim', 'systems', 'CommandDispatcher.ts');
const jobGenerationPath = path.join(root, 'engine', 'sim', 'systems', 'JobGenerationSystem.ts');
const agentSystemPath = path.join(root, 'engine', 'sim', 'systems', 'AgentSystem.ts');
const controlsPath = path.join(root, 'components', 'Controls.tsx');
const aureusWorldPath = path.join(root, 'game', 'AureusWorld.ts');
const interactionPath = path.join(root, 'game', 'world', 'interaction.ts');
const renderFramePath = path.join(root, 'game', 'world', 'renderFrame.ts');
const planPath = path.join(root, 'docs', 'subsurface-reset-plan.md');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('layered world generation supports deeper migrated subsurface chunks and preserves edits', () => {
  const text = source(layeredWorldGeneratorPath);

  for (const snippet of [
    'export const LAYERED_WORLD_MIGRATION_VERSION = 3;',
    'export const DEFAULT_LAYER_MIN_Y = -24;',
    'const minY = Math.min(existing?.minY ?? DEFAULT_LAYER_MIN_Y, DEFAULT_LAYER_MIN_Y);',
    'const maxY = Math.max(existing?.maxY ?? DEFAULT_LAYER_MAX_Y, DEFAULT_LAYER_MAX_Y);',
    'existingChunk.minY > minY',
    'existingChunk.maxY < maxY',
    'rubbleStockpile: existing?.rubbleStockpile ?? 0,',
    'rubbleDropZones: existing?.rubbleDropZones ?? {},',
    'return createLayeredChunkFromSurfaceChunk(chunkKey, chunk, minY, maxY);',
  ]) {
    assertSnippet(text, snippet);
  }

  assert.doesNotMatch(text, /existingChunk\.generatedFromSurfaceVersion !== surfaceVersion/);
});

test('surface tile types track open-pit depth separately from terrain height', () => {
  const text = source(worldTypesPath);

  for (const snippet of [
    'openPitBaseHeight?: number;',
    'openPitDepth?: number;',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('layered world types include rubble piles, buried yield, and dump zones', () => {
  const text = source(layeredWorldTypesPath);

  for (const snippet of [
    "| 'RUBBLE'",
    "| 'RUBBLE_PILE'",
    'buriedMaterial?: WorldVoxelMaterial;',
    'buriedResourceAmount?: number;',
    'export interface RubbleDropZone',
    'capacity: number;',
    'stored: number;',
    'rubbleStockpile?: number;',
    'rubbleDropZones?: Record<string, RubbleDropZone>;',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('subsurface model is the canonical excavation and job helper', () => {
  const text = source(subsurfaceModelPath);

  for (const snippet of [
    'export const SUBSURFACE_FOUNDATION_VERSION = 1;',
    "export const SUBSURFACE_DIG_JOB_PREFIX = 'dig_sub';",
    "export const SUBSURFACE_CLEAR_RUBBLE_JOB_PREFIX = 'clear_sub';",
    'export function layeredChunkKey',
    'export function layeredCellKey',
    'export function getOpenPitEntryLayer',
    'export function setActiveSubsurfaceLayer',
    'export function queueSubsurfaceExcavationJob',
    'export function queueSubsurfaceRubbleClearJob',
    'export function excavateSubsurfaceCell',
    "type: 'MINE',",
    'targetY: y,',
    "context: 'SURFACE_CUT',",
  ]) {
    assertSnippet(text, snippet);
  }
});

test('surface-cut excavation lowers connected pits with a two-level cap', () => {
  const text = source(subsurfaceModelPath);

  for (const snippet of [
    'export const SUBSURFACE_MAX_OPEN_PIT_DEPTH = 2;',
    'export const SUBSURFACE_TERRAIN_DROP_PER_LAYER = 1;',
    'const CARDINAL_NEIGHBORS = [',
    'const SURFACE_REFRESH_NEIGHBORS = [',
    'function ensureOpenPitMetrics',
    'export function lowerSurfaceForOpenPit',
    'if (depth >= SUBSURFACE_MAX_OPEN_PIT_DEPTH) return false;',
    'tile.openPitDepth = nextDepth;',
    'tile.terrainHeight = baseHeight - (nextDepth * SUBSURFACE_TERRAIN_DROP_PER_LAYER);',
    'function refreshSurfaceTiles',
    'function refreshSurfaceTile',
    'surfaceChunk.meshDirty = true;',
    'surfaceChunk.simDirty = true;',
    'surfaceChunk.version = (surfaceChunk.version || 0) + 1;',
    "state.pendingEffects.push({ type: 'CHUNK_UPDATE', cx, cz, updates });",
    'function collectConnectedOpenPit',
    'function syncConnectedOpenPit',
    'targetDepth = Math.min(SUBSURFACE_MAX_OPEN_PIT_DEPTH, targetDepth);',
    'tile.openPitDepth = targetDepth;',
    'tile.terrainHeight = baseHeight - (targetDepth * SUBSURFACE_TERRAIN_DROP_PER_LAYER);',
    'refreshSurfaceTiles(state, connected);',
    'if (options.deformSurface) {',
    'lowerSurfaceForOpenPit(state, cell.x, cell.z);',
  ]) {
    assertSnippet(text, snippet);
  }

  assert.doesNotMatch(text, /tile\.terrainHeight -= SUBSURFACE_TERRAIN_DROP_PER_LAYER;/);
  assert.doesNotMatch(text, /tile\.terrainHeight = targetHeight;/);
});

test('digging is blocked below the open-pit cap and cannot dig rubble piles', () => {
  const text = source(subsurfaceModelPath);

  for (const snippet of [
    'if (y < layeredWorld.surfaceY - SUBSURFACE_MAX_OPEN_PIT_DEPTH) {',
    'Open-pit cuts are limited to 2 levels. Build a shaft for deeper mining.',
    'This open pit is already at the 2-level safety limit.',
    "if (cell.material === 'RUBBLE') {",
    'Clear rubble before digging deeper.',
  ]) {
    assertSnippet(text, snippet);
  }

  assert.doesNotMatch(text, /cell\.material === 'RUBBLE' && !hasRubbleDropCapacity/);
});

test('excavation creates visible rubble first, then rubble clearing opens tunnel and pays buried yield', () => {
  const text = source(subsurfaceModelPath);

  for (const snippet of [
    'export const SUBSURFACE_RUBBLE_PER_BLOCK = 1;',
    'export const SUBSURFACE_RUBBLE_DUMP_CAPACITY = 24;',
    'function markSurfaceRubble',
    "tile.foliage = 'ROCK_PEBBLE';",
    'syncConnectedOpenPit(state, x, z);',
    'function clearSurfaceRubble',
    "tile.foliage = 'NONE';",
    'function breakSubsurfaceCellIntoRubble',
    'cell.buriedMaterial = cell.material;',
    'cell.buriedResourceAmount = cell.resourceAmount;',
    "cell.material = 'RUBBLE';",
    "cell.contents = 'RUBBLE_PILE';",
    'markSurfaceRubble(state, cell.x, cell.z);',
    'function clearRubbleCell',
    'const validation = validateSubsurfaceRubbleClearTarget(state, cell.x, cell.y, cell.z);',
    'if (!depositRubble(state.layeredWorld, SUBSURFACE_RUBBLE_PER_BLOCK))',
    'applySubsurfaceYield(state, getSubsurfaceResourceYield({',
    "cell.material = 'AIR';",
    "cell.contents = 'TUNNEL';",
    'clearSurfaceRubble(state, cell.x, cell.z);',
    'return breakSubsurfaceCellIntoRubble(state, cell, options);',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('rubble clearing and fill commands use stored rubble deliberately', () => {
  const modelText = source(subsurfaceModelPath);
  const commandText = source(commandDispatcherPath);

  for (const snippet of [
    'export function validateSubsurfaceRubbleClearTarget',
    "if (cell.material !== 'RUBBLE')",
    'Only rubble piles can be cleared.',
    'export function queueSubsurfaceRubbleClearJob',
    'export function designateRubbleDropZone',
    'Rubble dumps need an open excavated cell.',
    'export function fillSubsurfaceCellWithRubble',
    'Only an open tunnel cell can be filled with rubble.',
    'if (!consumeRubble(layeredWorld, SUBSURFACE_RUBBLE_PER_BLOCK))',
    'Not enough stored rubble to fill this block.',
  ]) {
    assertSnippet(modelText, snippet);
  }

  for (const snippet of [
    'queueSubsurfaceExcavationJob, queueSubsurfaceRubbleClearJob',
    "commandType === 'CLEAR_RUBBLE'",
    "commandType === 'DESIGNATE_RUBBLE_DUMP'",
    "commandType === 'FILL_VOXEL'",
    'return queueSubsurfaceRubbleClearJob(state, target.x, target.y, target.z);',
    'return designateRubbleDropZone(state, target.x, target.y, target.z);',
    'return fillSubsurfaceCellWithRubble(state, target.x, target.y, target.z);',
    "'CLEAR_RUBBLE'",
    "'DESIGNATE_RUBBLE_DUMP'",
    "'FILL_VOXEL'",
  ]) {
    assertSnippet(commandText, snippet);
  }
});

test('rubble clicks route to clear jobs instead of dig jobs', () => {
  const text = source(interactionPath);

  for (const snippet of [
    "import { getSubsurfaceCell } from '../../engine/subsurface/SubsurfaceModel';",
    'const cell = getSubsurfaceCell(layeredWorld, x, activeY, z);',
    "const command = cell?.material === 'RUBBLE' ? 'CLEAR_RUBBLE' : 'DIG_VOXEL';",
    'deps.stateManager.pushCommand(command, { x, y: activeY, z });',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('subsurface jobs can carry a layer target and job context', () => {
  const text = source(agentsTypesPath);
  assertSnippet(text, "export type JobContext = 'SURFACE_CUT' | 'DEEP_MINE';");
  assertSnippet(text, 'targetY?: number;');
  assertSnippet(text, 'context?: JobContext;');
});

test('dig command queues agent work instead of instantly removing cells', () => {
  const text = source(commandDispatcherPath);

  assertSnippet(text, 'queueSubsurfaceExcavationJob(state, target.x, target.y, target.z);');
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
    "const result = excavateSubsurfaceCell(state, job.targetX, y, job.targetZ, { deformSurface: job.context === 'SURFACE_CUT' });",
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

test('surface layer overlay highlights the hovered subsurface cell and rubble piles', () => {
  const text = source(renderFramePath);

  for (const snippet of [
    'type HoverCell = { x: number; z: number } | null;',
    "const hoverSignature = hoverCell ? `${hoverCell.x},${hoverCell.z}` : 'none';",
    'this.mesh.setColorAt(i, this.colorForCell(cell, hoverCell));',
    "if (hoverCell && cell.x === hoverCell.x && cell.z === hoverCell.z) return this.color.set('#f8fafc');",
    "if (cell.material === 'RUBBLE' || cell.contents === 'RUBBLE_PILE') return this.color.set('#9a6b3d');",
    'const hoverCell = cursor ? { x: Math.round(cursor.x), z: Math.round(cursor.z) } : null;',
    'getLayeredWorldOverlay(deps).update(state, deps.getTerrainHeight, hoverCell);',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('terrain refresh effects support both terrain renderer APIs', () => {
  const text = source(renderFramePath);

  for (const snippet of [
    "if (typeof deps.terrainRenderSystem.updateChunk === 'function') {",
    'affectedChunks = deps.terrainRenderSystem.updateChunk(effect.cx, effect.cz, effect.updates) || [];',
    "} else if (typeof deps.terrainRenderSystem.updateTiles === 'function') {",
    'deps.terrainRenderSystem.updateTiles(effect.updates);',
    'affectedChunks = [`${effect.cx},${effect.cz}`];',
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
