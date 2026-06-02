import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const terrainPath = path.join(process.cwd(), 'game', 'render', 'systems', 'TerrainRenderSystem.ts');
const foliagePath = path.join(process.cwd(), 'game', 'render', 'systems', 'FoliageRenderSystem.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('TerrainRenderSystem tracks chunk ownership revisions and pools chunk mesh shells', () => {
  assert.equal(existsSync(terrainPath), true, 'TerrainRenderSystem.ts is missing');

  const source = readFileSync(terrainPath, 'utf8');

  for (const snippet of [
    'revision: number;',
    'loadingRevision: number;',
    'private terrainMeshPool: THREE.Mesh[] = [];',
    'private waterMeshPool: THREE.Mesh[] = [];',
    'private ghostMeshPool: THREE.Mesh[] = [];',
    'private readonly maxPoolSizePerType = 12;',
    'private markChunkDirty(key: string, chunk = this.chunks.get(key)): void {',
    'chunk.revision += 1;',
    'chunk.loadingRevision = chunk.revision;',
    'if (chunk.loadingRevision !== chunk.revision) {',
    'private upsertChunkMesh(',
    'private acquirePooledMesh(material: THREE.Material, castShadow: boolean, pool: THREE.Mesh[]): THREE.Mesh {',
    'private releaseChunkMesh(mesh: THREE.Mesh, pool: THREE.Mesh[]): void {',
    'private disposeMeshPool(pool: THREE.Mesh[]): void {',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('FoliageRenderSystem reuses instanced chunk meshes through per-type pools', () => {
  assert.equal(existsSync(foliagePath), true, 'FoliageRenderSystem.ts is missing');

  const source = readFileSync(foliagePath, 'utf8');

  for (const snippet of [
    'private meshPools: Map<string, THREE.InstancedMesh[]> = new Map();',
    'private readonly maxPoolSizePerType = 6;',
    'const existingMeshes = this.chunkMeshes.get(key) || new Map();',
    'const nextMeshes = new Map<string, THREE.InstancedMesh>();',
    'const mesh = this.prepareChunkMesh(key, type, geometry, bucket.length, existing);',
    'private prepareChunkMesh(',
    'private acquireMesh(type: string, geometry: THREE.BufferGeometry, count: number): THREE.InstancedMesh {',
    'private releaseMesh(mesh: THREE.InstancedMesh) {',
    'private releaseChunkMeshes(key: string, meshes: Map<string, THREE.InstancedMesh>) {',
    'private getCapacity(count: number): number {',
    'while (capacity < count) {',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
