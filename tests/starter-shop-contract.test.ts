import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const supplySidebarPath = path.join(root, 'components', 'SupplySidebar.tsx');
const erasPath = path.join(root, 'engine', 'data', 'eras.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('starter shop includes infrastructure, shelter, storage, mining, water, and power before Growth', () => {
  const text = source(supplySidebarPath);

  for (const snippet of [
    'const STARTER_SHOP_TYPES = new Set<BuildingType>([',
    'BuildingType.ROAD,',
    'BuildingType.PIPE,',
    'BuildingType.POWER_LINE,',
    'BuildingType.STAFF_QUARTERS,',
    'BuildingType.STORAGE_DEPOT,',
    'BuildingType.MINING_HEADFRAME,',
    'BuildingType.SURVEY_DRILL,',
    'BuildingType.GENERATOR,',
    'BuildingType.WATER_WELL,',
    "? 'Starter Assets: Roads, Utilities, Shelter, Storage, Mining'",
    '? all.filter(type => STARTER_SHOP_TYPES.has(type))',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('Growth unlock remains tied to the three-building starter base', () => {
  const text = source(erasPath);

  for (const snippet of [
    '[Era.GROWTH]: {',
    'minBuildings: 3,',
    'requiredBuildings: [BuildingType.STAFF_QUARTERS, BuildingType.STORAGE_DEPOT, BuildingType.MINING_HEADFRAME]',
    "{ id: 'starter_base', name: 'A Roof And A Depot', target: 3 }",
  ]) {
    assertSnippet(text, snippet);
  }

  assert.doesNotMatch(text, /minColonists:\s*5/);
});
