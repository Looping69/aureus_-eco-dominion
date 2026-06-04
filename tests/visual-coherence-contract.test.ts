import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workerPath = path.join(process.cwd(), 'engine', 'jobs', 'engine.worker.ts');
const materialsPath = path.join(process.cwd(), 'engine', 'render', 'materials', 'VoxelMaterials.ts');
const renderAdapterPath = path.join(process.cwd(), 'engine', 'render', 'ThreeRenderAdapter.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('World terrain palette uses muted biome colors instead of neon source colors', () => {
  assert.equal(existsSync(workerPath), true, 'engine.worker.ts is missing');

  const source = readFileSync(workerPath, 'utf8');

  for (const snippet of [
    "'grass': [0.42, 0.60, 0.27]",
    "'grassLight': [0.56, 0.68, 0.31]",
    "'sand': [0.78, 0.68, 0.48]",
    "'stone': [0.44, 0.47, 0.48]",
    "'water': [0.16, 0.52, 0.62]",
    "'pine': [0.12, 0.28, 0.16]",
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  for (const neonSnippet of [
    "'grassLight': [0.52, 0.80, 0.09]",
    "'sand': [0.92, 0.70, 0.03]",
    "'water': [0.02, 0.71, 0.83]",
  ]) {
    assert.doesNotMatch(source, new RegExp(escapeRegExp(neonSnippet)));
  }
});

test('Shared materials remove artificial terrain striping, calm water, and keep foliage readable', () => {
  assert.equal(existsSync(materialsPath), true, 'VoxelMaterials.ts is missing');

  const source = readFileSync(materialsPath, 'utf8');

  for (const snippet of [
    'float broadNoise = terrainNoise(terrainUv * 0.08);',
    'float fineNoise = terrainNoise(terrainUv * 0.42);',
    'albedo = mix(albedo, vBaseColor, 0.18);',
    'emissive: 0x142414',
    'emissiveIntensity: 0.08',
    'export const waterFlowMaterial = createWaterMaterial(0x2f8fa3, 0xb9dde2);',
    'opacity: 0.74',
    'metalness: 0.08',
    'float pattern = sin((vWorldPos.x + vWorldPos.z) * 3.0 - time * 1.3) * 0.5 + 0.5;',
    'float foam = smoothstep(0.92, 1.0, pattern) * wavePeak * 0.65;',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(source, /float stripe = abs\(/);
  assert.doesNotMatch(source, /step\(0\.56, stripe\)/);
  assert.doesNotMatch(source, /0x06b6d4/);
  assert.doesNotMatch(source, /0x00ffff/);
});

test('Scene lighting is balanced around warm sun, softer ambient, and natural hemisphere fill', () => {
  assert.equal(existsSync(renderAdapterPath), true, 'ThreeRenderAdapter.ts is missing');

  const source = readFileSync(renderAdapterPath, 'utf8');

  for (const snippet of [
    'this.renderer.toneMappingExposure = 0.96;',
    'new THREE.AmbientLight(0xf3f0df, 0.82)',
    'new THREE.DirectionalLight(0xffedcf, 1.18)',
    'this.directionalLight.position.set(55, 90, 38);',
    'new THREE.HemisphereLight(0xd7e5df, 0x4a3a28, 0.62)',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(source, /new THREE\.AmbientLight\(0xffffff, 1\.2\)/);
  assert.doesNotMatch(source, /new THREE\.HemisphereLight\(0x87CEEB, 0x3d2817, 0\.4\)/);
});
