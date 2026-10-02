import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { voxel, buildVoxelGroup } from '../engine/render/utils/VoxelBuilder';
import { getLineCoordinates, pseudoRandom } from '../engine/utils/proceduralMath';
import { BUILDINGS } from '../game/data/buildings';
import { BuildingType } from '../types';

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.[jt]sx?$/.test(entry.name) ? [file] : [];
  });
}

test('authored definitions, voxel factories and material palette stay game-owned', () => {
  assert.deepEqual(sourceFiles('engine/data'), []);
  for (const file of ['engine/utils/GameUtils.ts', 'engine/render/utils/VoxelGenerators.ts', 'engine/render/materials/VoxelMaterials.ts']) {
    assert.equal(existsSync(file), false, file);
  }
  const builder = readFileSync('engine/render/utils/VoxelBuilder.ts', 'utf8');
  assert.doesNotMatch(builder, /from ['"].*(?:game\/|VoxelMaterials|\.\.\/\.\.\/\.\.\/types)/);
  assert.deepEqual(Object.keys(BUILDINGS).sort(), Object.values(BuildingType).sort());
});

test('shared voxel geometry builds an unrelated model in Node without game materials or a DOM', () => {
  assert.equal(typeof document, 'undefined');
  const material = new THREE.MeshBasicMaterial({ color: '#123456' });
  const first = voxel(1, 2, 3, material, -4, 5, 6);
  const second = voxel(1, 2, 3, material);
  assert.equal(first.material, material);
  assert.equal(first.geometry, second.geometry, 'primitive geometry cache is reused');
  assert.deepEqual(first.position.toArray(), [-4, 6, 6]);
  const model = buildVoxelGroup([{ x: 0, y: 0, z: 0, c: '#123456' }], { '#123456': material });
  assert.ok(model.children.length > 0);
  const bounds = new THREE.Box3().setFromObject(model);
  assert.equal(bounds.isEmpty(), false);
  assert.ok(Number.isFinite(bounds.max.x));
  material.dispose();
});

test('reusable line and procedural random math preserves negative coordinates and repeatable sequences', () => {
  assert.deepEqual(getLineCoordinates(-2, 1, 1, 1), [
    { x: -2, z: 1 }, { x: -1, z: 1 }, { x: 0, z: 1 }, { x: 1, z: 1 },
  ]);
  assert.deepEqual(getLineCoordinates(1, 1, -2, -2), [
    { x: 1, z: 1 }, { x: 0, z: 0 }, { x: -1, z: -1 }, { x: -2, z: -2 },
  ]);
  assert.deepEqual(getLineCoordinates(-1, -1, -1, -1), [{ x: -1, z: -1 }]);
  const first = pseudoRandom(42);
  const second = pseudoRandom(42);
  const sequence = Array.from({ length: 20 }, () => first());
  assert.deepEqual(sequence, Array.from({ length: 20 }, () => second()));
  assert.ok(sequence.every(value => value >= 0 && value < 1));
  assert.notEqual(sequence[0], pseudoRandom(43)());
});
