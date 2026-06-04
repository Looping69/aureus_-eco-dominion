import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const terrainPath = path.join(process.cwd(), 'game', 'render', 'systems', 'TerrainRenderSystem.ts');
const foliagePath = path.join(process.cwd(), 'game', 'render', 'systems', 'FoliageRenderSystem.ts');
const packetLayerPath = path.join(process.cwd(), 'game', 'render', 'systems', 'PacketInstancedLayer.ts');
const engineWorkerPath = path.join(process.cwd(), 'engine', 'jobs', 'engine.worker.ts');

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

test('PacketInstancedLayer now supports pooled bucketed instancing with render-order, rotation, and non-uniform scale control', () => {
  assert.equal(existsSync(packetLayerPath), true, 'PacketInstancedLayer.ts is missing');

  const source = readFileSync(packetLayerPath, 'utf8');

  for (const snippet of [
    'export interface PacketInstanceSpec {',
    'bucketKey: string;',
    'geometry: THREE.BufferGeometry;',
    'material: THREE.Material;',
    'position: THREE.Vector3;',
    'scale: number;',
    'scaleX?: number;',
    'scaleY?: number;',
    'scaleZ?: number;',
    'rotationX?: number;',
    'rotationY?: number;',
    'rotationZ?: number;',
    'export class PacketInstancedLayer {',
    'private root = new THREE.Group();',
    'private buckets = new Map<string, PacketInstanceBucket>();',
    'private pool = new Map<string, THREE.InstancedMesh[]>();',
    'constructor(scene: THREE.Scene, renderOrder: number = 9) {',
    'public sync(instances: PacketInstanceSpec[]): void {',
    'const grouped = new Map<string, PacketInstanceSpec[]>();',
    'mesh.renderOrder = this.root.renderOrder;',
    'this.dummy.rotation.set(spec.rotationX || 0, spec.rotationY || 0, spec.rotationZ || 0);',
    'spec.scaleX ?? spec.scale,',
    'spec.scaleY ?? spec.scale,',
    'spec.scaleZ ?? spec.scale,',
    'const bucket = this.ensureBucket(bucketKey, first.geometry, first.material, specs.length);',
    'mesh.setMatrixAt(i, this.dummy.matrix);',
    'private ensureBucket(bucketKey: string, geometry: THREE.BufferGeometry, material: THREE.Material, count: number): PacketInstanceBucket {',
    'private acquireMesh(bucketKey: string, geometry: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh {',
    'private releaseBucket(bucketKey: string, bucket: PacketInstanceBucket): void {',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Engine worker renders terrain with restored voxel block tops and axis-aligned step faces', () => {
  assert.equal(existsSync(engineWorkerPath), true, 'engine.worker.ts is missing');

  const source = readFileSync(engineWorkerPath, 'utf8');

  for (const snippet of [
    'const VOXEL_SIDE_EPSILON = 0.01;',
    'const BLOCK_TOP_NORMAL: [number, number, number] = [0, 1, 0];',
    'const macroStep = getTerrainMacroStep(lod);',
    'const surfaceStep = 1;',
    'const foliageStep = Math.max(1, macroStep);',
    'const addBlockTop = (',
    'pushVertex(dest, nw, BLOCK_TOP_NORMAL, color, [0, 0]);',
    'pushVertex(dest, ne, BLOCK_TOP_NORMAL, color, [1, 0]);',
    'pushVertex(dest, se, BLOCK_TOP_NORMAL, color, [1, 1]);',
    'pushVertex(dest, sw, BLOCK_TOP_NORMAL, color, [0, 1]);',
    'const getBlockSideColor = (color: number[]) => color.map',
    'const addBlockSide = (',
    'if (topY - bottomY <= VOXEL_SIDE_EPSILON) {',
    'const getTopSurfaceY = (data: { h: number; bt: string; in: boolean }) => {',
    'for (let z = 0; z < CHUNK_SIZE; z += surfaceStep) {',
    'for (let x = 0; x < CHUNK_SIZE; x += surfaceStep) {',
    'const topY = getTopSurfaceY(data);',
    'addBlockTop(',
    'const neighborTopY = getTopSurfaceY(getData(worldX + dx, worldZ + dz));',
    'addBlockSide(',
    'const path = findPath(job.startX, job.startZ, job.endX, job.endZ, localChunks);',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(source, /const CLIFF_FACE_THRESHOLD/);
  assert.doesNotMatch(source, /const TERRAIN_SURFACE_NORMAL/);
  assert.doesNotMatch(source, /const getCornerHeights/);
  assert.doesNotMatch(source, /const addTopSurface/);
  assert.doesNotMatch(source, /const addCliffBand/);
  assert.doesNotMatch(source, /addQuad\(dest, nw, ne, se, sw, color\);/);
  assert.doesNotMatch(source, /for \(let z = 0; z < CHUNK_SIZE; z \+= macroStep\)/);
  assert.doesNotMatch(source, /for \(let x = 0; x < CHUNK_SIZE; x \+= macroStep\)/);
  assert.doesNotMatch(source, /const path = findPath\(job\.startX, job\.startZ, localChunks\);/);
});