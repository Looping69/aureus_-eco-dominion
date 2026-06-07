import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const terrainPath = path.join(process.cwd(), 'game', 'render', 'systems', 'TerrainRenderSystem.ts');
const terrainPickPath = path.join(process.cwd(), 'game', 'render', 'systems', 'TerrainPickAccelerator.ts');
const inputPath = path.join(process.cwd(), 'engine', 'input', 'InputSystem.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('terrain chunks use three-mesh-bvh for accelerated precise picking', () => {
  assert.equal(existsSync(terrainPath), true, 'TerrainRenderSystem.ts is missing');
  assert.equal(existsSync(terrainPickPath), true, 'TerrainPickAccelerator.ts is missing');
  assert.equal(existsSync(inputPath), true, 'InputSystem.ts is missing');

  const terrain = readFileSync(terrainPath, 'utf8');
  const terrainPick = readFileSync(terrainPickPath, 'utf8');
  const input = readFileSync(inputPath, 'utf8');

  for (const snippet of [
    "import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';",
    'export function installTerrainBvhRaycast(): void {',
    'geometryPrototype.computeBoundsTree = computeBoundsTree as unknown as () => void;',
    'geometryPrototype.disposeBoundsTree = disposeBoundsTree as unknown as () => void;',
    "raycast = acceleratedRaycast as THREE.Mesh['raycast'];",
    'export function buildTerrainBoundsTree(geometry: THREE.BufferGeometry): void {',
    'export function disposeTerrainBoundsTree(geometry: THREE.BufferGeometry | null | undefined): void {',
    'export function pickClosestTerrainHit(',
    'raycaster.intersectObject(mesh, false);',
  ]) {
    assert.match(terrainPick, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    "} from './TerrainPickAccelerator';",
    'private readonly terrainPickHandler: TerrainPickHandler = (raycaster) => this.intersectTerrain(raycaster);',
    'installTerrainBvhRaycast();',
    'this.scene.userData.intersectTerrain = this.terrainPickHandler;',
    'this.terrainMeshPool, true',
    'public intersectTerrain(raycaster: THREE.Raycaster): THREE.Intersection | null {',
    'return pickClosestTerrainHit(raycaster, this.getActiveTerrainMeshes());',
    'private *getActiveTerrainMeshes(): Iterable<THREE.Mesh> {',
    'buildTerrainBoundsTree(geo);',
    'mesh.userData.isBvhTerrainPickTarget = true;',
    'disposeTerrainBoundsTree(mesh.geometry);',
    'delete this.scene.userData.intersectTerrain;',
  ]) {
    assert.match(terrain, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'type TerrainPickSceneData',
    'intersectTerrain?: (raycaster: THREE.Raycaster) => THREE.Intersection | null;',
    'const preciseHit = this.getPreciseTerrainHit();',
    'if (preciseHit) {',
    'return { x: Math.round(point.x), z: Math.round(point.z), point };',
    'private getPreciseTerrainHit(): THREE.Intersection | null {',
    'const sceneData = this.renderAdapter.getScene().userData as TerrainPickSceneData;',
    'return sceneData.intersectTerrain?.(this.raycaster) ?? null;',
    'const target = new THREE.Vector3();',
  ]) {
    assert.match(input, new RegExp(escapeRegExp(snippet)));
  }
});
