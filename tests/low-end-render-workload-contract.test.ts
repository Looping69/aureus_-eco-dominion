import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const terrainPath = path.join(process.cwd(), 'game', 'render', 'systems', 'TerrainRenderSystem.ts');
const foliagePath = path.join(process.cwd(), 'game', 'render', 'systems', 'FoliageRenderSystem.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('low-end terrain workload is capped by render device profile', () => {
  assert.equal(existsSync(terrainPath), true, 'TerrainRenderSystem.ts is missing');
  const source = readFileSync(terrainPath, 'utf8');

  for (const snippet of [
    "import { getRenderDeviceProfile } from '../../../engine/render/ThreeRenderAdapter';",
    'function getTerrainViewRadius(): number {',
    'const device = getRenderDeviceProfile();',
    'if (device.severelyConstrained || device.veryConstrained) return 2;',
    'if (device.constrained) return 3;',
    "return ('ontouchstart' in window) ? 3 : 5;",
    'private viewRadius = getTerrainViewRadius();',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(source, /private viewRadius = \('ontouchstart' in window\) \? 3 : 5;/);
});

test('low-end foliage workload avoids hidden grass detail generation', () => {
  assert.equal(existsSync(foliagePath), true, 'FoliageRenderSystem.ts is missing');
  const source = readFileSync(foliagePath, 'utf8');

  for (const snippet of [
    "import { getRenderDeviceProfile } from '../../../engine/render/ThreeRenderAdapter';",
    'type GroundDetailBudget = {',
    'function getGroundDetailBudget(): GroundDetailBudget {',
    'const device = getRenderDeviceProfile();',
    'return { enabled: false, densityModulo: 12, maxBladesPerChunk: 0 };',
    'return { enabled: true, densityModulo: 6, maxBladesPerChunk: 24 };',
    'return { enabled: true, densityModulo: 3, maxBladesPerChunk: 96 };',
    'private readonly groundDetailBudget = getGroundDetailBudget();',
    'if (!this.groundDetailBudget.enabled) {',
    'this.removeGroundDetailChunk(key);',
    'if (blades.length >= this.groundDetailBudget.maxBladesPerChunk) break;',
    'blades.length < this.groundDetailBudget.maxBladesPerChunk',
    'this.groundDetailBudget.densityModulo',
    'if (this.groundDetailBudget.maxBladesPerChunk <= 24) return 1;',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(source, /return this\.seed\(x, z, 3\) % 3 === 0;/);
});
