import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const appPath = path.join(process.cwd(), 'App.tsx');
const undergroundHudPath = path.join(process.cwd(), 'components', 'UndergroundHUD.tsx');

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
