import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const terrainPath = path.join(process.cwd(), 'game', 'render', 'systems', 'TerrainRenderSystem.ts');
const foliagePath = path.join(process.cwd(), 'game', 'render', 'systems', 'FoliageRenderSystem.ts');
const voxelGeneratorsPath = path.join(process.cwd(), 'engine', 'render', 'utils', 'VoxelGenerators.ts');
const voxelMaterialsPath = path.join(process.cwd(), 'engine', 'render', 'materials', 'VoxelMaterials.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('terrain workload scales down for low-end and expands for max visual devices', () => {
  assert.equal(existsSync(terrainPath), true, 'TerrainRenderSystem.ts is missing');
  const source = readFileSync(terrainPath, 'utf8');

  for (const snippet of [
    "import { getRenderDeviceProfile } from '../../../engine/render/ThreeRenderAdapter';",
    'function getTerrainViewRadius(): number {',
    'const device = getRenderDeviceProfile();',
    'if (device.severelyConstrained || device.veryConstrained) return 2;',
    'if (device.constrained) return 3;',
    'if (device.maxVisuals) return 6;',
    "return ('ontouchstart' in window) ? 3 : 5;",
    'private viewRadius = getTerrainViewRadius();',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(source, /private viewRadius = \('ontouchstart' in window\) \? 3 : 5;/);
});

test('foliage workload avoids hidden grass on weak devices and enriches max visual devices', () => {
  assert.equal(existsSync(foliagePath), true, 'FoliageRenderSystem.ts is missing');
  const source = readFileSync(foliagePath, 'utf8');

  for (const snippet of [
    "import { getRenderDeviceProfile } from '../../../engine/render/ThreeRenderAdapter';",
    'type GroundDetailBudget = {',
    'function getGroundDetailBudget(): GroundDetailBudget {',
    'const device = getRenderDeviceProfile();',
    'return { enabled: false, densityModulo: 12, maxBladesPerChunk: 0 };',
    'return { enabled: true, densityModulo: 6, maxBladesPerChunk: 24 };',
    'if (device.maxVisuals) {',
    'return { enabled: true, densityModulo: 2, maxBladesPerChunk: 160 };',
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

test('low-detail static factory groups can be baked until they change or break', () => {
  assert.equal(existsSync(voxelGeneratorsPath), true, 'VoxelGenerators.ts is missing');
  assert.equal(existsSync(voxelMaterialsPath), true, 'VoxelMaterials.ts is missing');
  const source = readFileSync(voxelGeneratorsPath, 'utf8');
  const materials = readFileSync(voxelMaterialsPath, 'utf8');

  for (const snippet of [
    "import { bakedBuildingMaterial, waterFlowMaterial, terrainMats } from '../materials/VoxelMaterials';",
    "import { mergeGroupGeometry } from './VoxelUtils';",
    'const STATIC_BAKE_EXCLUDED_KEYS = new Set([',
    "'ILLEGAL_CAMP',",
    "'WASH_PLANT',",
    "'RECYCLING_PLANT',",
    'function shouldBakeStaticFactoryGroup(key: string, opts: FactoryOptions | undefined, group: THREE.Group): boolean {',
    "if (opts?.detailLevel === undefined || opts.detailLevel === 'HIGH') return false;",
    'if (isUnderConstruction) return false;',
    'return !hasDynamicOrRichMaterial(group);',
    'function bakeStaticFactoryGroup(group: THREE.Group): THREE.Group {',
    'const geometry = mergeGroupGeometry(group);',
    'new THREE.Mesh(geometry, bakedBuildingMaterial);',
    'mesh.userData.isBakedStaticBuilding = true;',
    'baked.userData.isBakedStaticBuilding = true;',
    'Object.entries(rawBuildingFactory).map(([key, factory]) => [key, wrapFactory(key, factory)])',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'userData.isRotor || userData.isSolarPanel || userData.isNugget || userData.isConveyorPulse',
    'material?.transparent ||',
    'material?.isShaderMaterial ||',
    'material?.map ||',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  assert.match(materials, /function createBakedBuildingMaterial\(\): THREE\.MeshStandardMaterial/);
  assert.match(materials, /export const bakedBuildingMaterial = createBakedBuildingMaterial\(\);/);
});
