import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const terrainPath = path.join(process.cwd(), 'game', 'render', 'systems', 'TerrainRenderSystem.ts');
const foliagePath = path.join(process.cwd(), 'game', 'render', 'systems', 'FoliageRenderSystem.ts');
const packetLayerPath = path.join(process.cwd(), 'game', 'render', 'systems', 'PacketInstancedLayer.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('TerrainRenderSystem tracks chunk ownership revisions, border-aware dirty regions, and pooled chunk mesh shells', () => {
  assert.equal(existsSync(terrainPath), true, 'TerrainRenderSystem.ts is missing');

  const source = readFileSync(terrainPath, 'utf8');

  for (const snippet of [
    'revision: number;',
    'loadingRevision: number;',
    'private terrainMeshPool: THREE.Mesh[] = [];',
    'private waterMeshPool: THREE.Mesh[] = [];',
    'private ghostMeshPool: THREE.Mesh[] = [];',
    'private readonly maxPoolSizePerType = 12;',
    'import { CHUNK_SIZE, worldToChunk, worldToLocal, toChunkKey }',
    'public updateTiles(updates: GridTile[]): Set<string> {',
    'public updateChunk(cx: number, cz: number, updates: GridTile[]): Set<string> {',
    'public getAffectedChunkKeys(cx: number, cz: number, updates: GridTile[]): Set<string> {',
    'private collectAffectedChunkKeys(affected: Set<string>, x: number, z: number): void {',
    'if (lx === 0) affected.add(toChunkKey(cx - 1, cz));',
    'if (lx === CHUNK_SIZE - 1) affected.add(toChunkKey(cx + 1, cz));',
    'if (lz === 0) affected.add(toChunkKey(cx, cz - 1));',
    'if (lz === CHUNK_SIZE - 1) affected.add(toChunkKey(cx, cz + 1));',
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

test('PacketInstancedLayer provides reusable bucketed instancing for future logistics packet migration', () => {
  assert.equal(existsSync(packetLayerPath), true, 'PacketInstancedLayer.ts is missing');

  const source = readFileSync(packetLayerPath, 'utf8');

  for (const snippet of [
    'export interface PacketInstanceSpec {',
    'bucketKey: string;',
    'geometry: THREE.BufferGeometry;',
    'material: THREE.Material;',
    'position: THREE.Vector3;',
    'scale: number;',
    'export class PacketInstancedLayer {',
    'private root = new THREE.Group();',
    'private buckets = new Map<string, PacketInstanceBucket>();',
    'private pool = new Map<string, THREE.InstancedMesh[]>();',
    'public sync(instances: PacketInstanceSpec[]): void {',
    'const grouped = new Map<string, PacketInstanceSpec[]>();',
    'const bucket = this.ensureBucket(bucketKey, first.geometry, first.material, specs.length);',
    'mesh.setMatrixAt(i, this.dummy.matrix);',
    'private ensureBucket(bucketKey: string, geometry: THREE.BufferGeometry, material: THREE.Material, count: number): PacketInstanceBucket {',
    'private acquireMesh(bucketKey: string, geometry: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh {',
    'private releaseBucket(bucketKey: string, bucket: PacketInstanceBucket): void {',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
