import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const buildingsDataPath = path.join(root, 'engine', 'data', 'buildings.ts');
const subsurfaceModelPath = path.join(root, 'engine', 'subsurface', 'SubsurfaceModel.ts');
const commandDispatcherPath = path.join(root, 'engine', 'sim', 'systems', 'CommandDispatcher.ts');
const undergroundSurveySystemPath = path.join(root, 'engine', 'sim', 'systems', 'UndergroundSurveySystem.ts');
const undergroundTypesPath = path.join(root, 'engine', 'types', 'underground.ts');
const undergroundHudPath = path.join(root, 'components', 'UndergroundHUD.tsx');
const interactionPath = path.join(root, 'game', 'world', 'interaction.ts');
const renderFramePath = path.join(root, 'game', 'world', 'renderFrame.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('stockpile is the first-era rubble area', () => {
  const dataText = source(buildingsDataPath);

  for (const snippet of [
    '[BuildingType.STOCKPILE]',
    "name: 'Rubble & Resource Stockpile'",
    "stats: '+2000 Storage, +48 Rubble Capacity'",
    'costs: { agt: 350, stone: 50, wood: 50 }',
    'era: Era.SETTLEMENT',
  ]) {
    assertSnippet(dataText, snippet);
  }
});

test('completed stockpiles provide rubble capacity from the start of excavation play', () => {
  const text = source(subsurfaceModelPath);

  for (const snippet of [
    'export const SUBSURFACE_SURFACE_RUBBLE_DUMP_CAPACITY = 48;',
    'function getSurfaceRubbleDumpCapacity',
    'tile.buildingType === BuildingType.STOCKPILE',
    'capacity += SUBSURFACE_SURFACE_RUBBLE_DUMP_CAPACITY;',
    'function getTotalRubbleCapacity',
    'return subsurfaceCapacity + getSurfaceRubbleDumpCapacity(state);',
    'function hasRubbleDropCapacity(state: GameState',
    'return (state.layeredWorld.rubbleStockpile || 0) + amount <= getTotalRubbleCapacity(state);',
    'Build a Stockpile or designate a rubble dump with free space before clearing this pile.',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('open-pit excavation remains capped and cannot dig through rubble', () => {
  const text = source(subsurfaceModelPath);

  for (const snippet of [
    'export const SUBSURFACE_MAX_OPEN_PIT_DEPTH = 2;',
    'Open-pit cuts are limited to 2 levels. Build a shaft for deeper mining.',
    'This open pit is already at the 2-level safety limit.',
    "if (cell.material === 'RUBBLE') return { ok: false",
    'Clear rubble before digging deeper.',
    'targetDepth = Math.min(SUBSURFACE_MAX_OPEN_PIT_DEPTH, targetDepth);',
    'tile.openPitDepth = targetDepth;',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('rubble clearing is a separate command path from digging and remains agent-executable', () => {
  const modelText = source(subsurfaceModelPath);
  const commandText = source(commandDispatcherPath);
  const interactionText = source(interactionPath);

  for (const snippet of [
    "export const SUBSURFACE_DIG_JOB_PREFIX = 'dig_sub';",
    "export const SUBSURFACE_CLEAR_RUBBLE_JOB_PREFIX = 'dig_sub_clear';",
    'export function queueSubsurfaceExcavationJob',
    'export function queueSubsurfaceRubbleClearJob',
    'return clearRubbleCell(state, cell);',
  ]) {
    assertSnippet(modelText, snippet);
  }

  for (const snippet of [
    "commandType === 'CLEAR_RUBBLE'",
    'return queueSubsurfaceRubbleClearJob(state, target.x, target.y, target.z);',
    "'CLEAR_RUBBLE'",
  ]) {
    assertSnippet(commandText, snippet);
  }

  for (const snippet of [
    "const command = cell?.material === 'RUBBLE' ? 'CLEAR_RUBBLE' : 'DIG_VOXEL';",
    'deps.stateManager.pushCommand(command, { x, y: activeY, z });',
  ]) {
    assertSnippet(interactionText, snippet);
  }
});

test('open pit telemetry is mirrored into the underground HUD state', () => {
  const typeText = source(undergroundTypesPath);
  const systemText = source(undergroundSurveySystemPath);
  const hudText = source(undergroundHudPath);

  for (const snippet of [
    'export interface OpenPitTelemetry',
    'rubbleStored: number;',
    'rubbleCapacity: number;',
    'queuedClearJobs: number;',
    'capacityBlocked: boolean;',
    'nextAction: string;',
    'openPit?: OpenPitTelemetry;',
  ]) {
    assertSnippet(typeText, snippet);
  }

  for (const snippet of [
    'syncOpenPitTelemetry(state);',
    'const rubbleStored = Math.max(0, Math.round(layeredWorld.rubbleStockpile || 0));',
    'const stockpileCapacity = getSurfaceStockpileCapacity(state);',
    'const undergroundDumpCapacity = getUndergroundDumpCapacity(state);',
    'const capacityBlocked = rubbleCapacity <= 0 || rubbleStored >= rubbleCapacity;',
    'state.underground.openPit = {',
    'Build a Rubble & Resource Stockpile or clear dump space.',
  ]) {
    assertSnippet(systemText, snippet);
  }

  for (const snippet of [
    'const openPit = underground.openPit;',
    'Open Pit',
    'Pit Tiles',
    'Clear Jobs',
    'Stockpile {openPit.stockpileCapacity} / Underground dump {openPit.undergroundDumpCapacity}',
    '{openPit.nextAction}',
  ]) {
    assertSnippet(hudText, snippet);
  }
});

test('surface layer overlay still highlights hovered cells and rubble piles', () => {
  const text = source(renderFramePath);

  for (const snippet of [
    'type HoverCell = { x: number; z: number } | null;',
    "if (hoverCell && cell.x === hoverCell.x && cell.z === hoverCell.z) return this.color.set('#f8fafc');",
    "if (cell.material === 'RUBBLE' || cell.contents === 'RUBBLE_PILE') return this.color.set('#9a6b3d');",
    'getLayeredWorldOverlay(deps).update(state, deps.getTerrainHeight, hoverCell);',
  ]) {
    assertSnippet(text, snippet);
  }
});