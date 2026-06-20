import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const narrativePanelPath = path.join(root, 'components', 'NarrativePanel.tsx');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('radio dispatch names utility-starved structures and connection pieces', () => {
  const text = source(narrativePanelPath);

  for (const snippet of [
    "import { BUILDINGS } from '../engine/data/VoxelConstants';",
    'type UtilityAlert = {',
    'function getUtilityAlerts(state: GameState): UtilityAlert[]',
    "reason: 'power'",
    "connector: 'Power Line'",
    "reason: 'water'",
    "connector: 'Pipe'",
    'const utilityAlerts = getUtilityAlerts(state);',
    'const firstAlert = utilityAlerts[0];',
    '`${firstAlert.buildingName} at X${firstAlert.x}, Z${firstAlert.z} needs ${firstAlert.connector}`',
    'utilityAlerts.length > 1',
    'sites need attention.',
    'Connect the missing utility from Supply Command',
  ]) {
    assertSnippet(text, snippet);
  }
});
