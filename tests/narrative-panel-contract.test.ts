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
    "import { getWaterDiagnostic } from '../engine/sim/utility/WaterDiagnostics';",
    'type UtilityAlert = {',
    'function getUtilityAlerts(state: GameState): UtilityAlert[]',
    "reason: 'power'",
    "connector: 'Power Line'",
    'const waterDiagnostic = getWaterDiagnostic(tile, def);',
    'if (waterDiagnostic.blocksProduction)',
    "reason: 'water'",
    "waterDiagnostic.code === 'SUPPLY_SHORTAGE' ? 'Water Supply' : 'Pipe'",
    "detail: waterDiagnostic.label || 'water supply interrupted'",
    'const utilityAlerts = getUtilityAlerts(state);',
    'const firstAlert = utilityAlerts[0];',
    '`${firstAlert.buildingName} at X${firstAlert.x}, Z${firstAlert.z}: ${firstAlert.detail}`',
    'utilityAlerts.length > 1',
    'sites need attention.',
    'Connect the missing utility from Supply Command',
  ]) {
    assertSnippet(text, snippet);
  }

  assert.equal(text.includes("def.water?.consumes && tile.waterStatus !== 'CONNECTED'"), false);
});
