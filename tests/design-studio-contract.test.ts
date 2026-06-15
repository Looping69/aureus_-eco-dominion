import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const indexPath = path.join(root, 'index.tsx');
const studioPath = path.join(root, 'components', 'DesignStudio.tsx');
const stylePath = path.join(root, 'game', 'design', 'buildingStyle.ts');
const styleRuntimePath = path.join(root, 'game', 'design', 'buildingStyleRuntime.ts');
const controlsPath = path.join(root, 'components', 'Controls.tsx');
const voxelGeneratorsPath = path.join(root, 'engine', 'render', 'utils', 'VoxelGenerators.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('design studio has a browser route entry and game return path', () => {
  const indexText = source(indexPath);
  const studioText = source(studioPath);

  for (const snippet of [
    "import { DesignStudio } from './components/DesignStudio';",
    "import { BrowserRouter, useLocation } from 'react-router-dom';",
    'function RootRoute() {',
    "location.pathname === '/design-studio' ? <DesignStudio /> : <App />",
    '<RootRoute />',
  ]) {
    assertSnippet(indexText, snippet);
  }

  for (const snippet of [
    'Aureus Design Studio',
    'Settlement Identity',
    'to="/"',
    'Game',
  ]) {
    assertSnippet(studioText, snippet);
  }
});

test('design studio stores reusable building style settings', () => {
  const styleText = source(stylePath);
  const studioText = source(studioPath);

  for (const snippet of [
    'export interface BuildingStyleSettings',
    "export const BUILDING_STYLE_STORAGE_KEY = 'aureus.buildingStyle.v1';",
    'export const BUILDING_STYLE_PRESETS',
    "presetId: 'frontier-oxide'",
    "presetId: 'solar-cooperative'",
    "presetId: 'stone-garden'",
    "presetId: 'industrial-charter'",
    'export function normalizeBuildingStyleSettings',
    'export function styleSettingsFromPreset',
  ]) {
    assertSnippet(styleText, snippet);
  }

  for (const snippet of [
    'window.localStorage.getItem(BUILDING_STYLE_STORAGE_KEY)',
    'window.localStorage.setItem(BUILDING_STYLE_STORAGE_KEY',
    'BUILDING_STYLE_PRESETS.map',
    'Overseer Doctrine',
    'JSON.stringify(settings, null, 2)',
  ]) {
    assertSnippet(studioText, snippet);
  }
});

test('game controls expose a compact design studio button', () => {
  const controlsText = source(controlsPath);

  for (const snippet of [
    'Palette } from',
    'href="/design-studio"',
    'title="Design Studio"',
    '<Palette size={20}',
  ]) {
    assertSnippet(controlsText, snippet);
  }
});

test('saved style settings are applied to generated building meshes', () => {
  const runtimeText = source(styleRuntimePath);
  const voxelText = source(voxelGeneratorsPath);

  for (const snippet of [
    'export function readSavedBuildingStyle',
    'export function getBuildingStyleSignature',
    'export function applyBuildingStyleToGroup',
    'INFRASTRUCTURE_STYLE_EXCLUSIONS',
    'mesh.material = Array.isArray(mesh.material)',
    'group.userData.buildingStyleSignature',
  ]) {
    assertSnippet(runtimeText, snippet);
  }

  for (const snippet of [
    "import { applyBuildingStyleToGroup, readSavedBuildingStyle } from '../../../game/design/buildingStyleRuntime';",
    'function withDesignStudioStyle',
    '...withDesignStudioStyle(BuildingsFactory)',
  ]) {
    assertSnippet(voxelText, snippet);
  }
});
