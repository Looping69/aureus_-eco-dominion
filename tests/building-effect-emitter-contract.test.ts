import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const helperPath = path.join(process.cwd(), 'game', 'render', 'systems', 'BuildingEffectEmitter.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

test('Building effect emitter helpers are split into a dedicated module', () => {
  assert.equal(existsSync(helperPath), true, 'BuildingEffectEmitter.ts is missing');

  const source = readFileSync(helperPath, 'utf8');

  for (const snippet of [
    "import * as THREE from 'three';",
    'export interface BuildingEffectParticle {',
    'mesh: THREE.Mesh;',
    'velocity: THREE.Vector3;',
    'life: number;',
    'decay: number;',
    'export function emitParticle(',
    'buildingMeshes: Map<number, THREE.Object3D>,',
    'particles: BuildingEffectParticle[],',
    'particleMats: Record<string, THREE.MeshBasicMaterial>,',
    'const p = new THREE.Mesh(particleGeo, mat);',
    'p.position.copy(mesh.position);',
    'particles.push({',
    'velocity: new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.05 + Math.random() * 0.08, (Math.random() - 0.5) * 0.1),',
    'export function triggerEffect(',
    "if (type === 'DUST') {",
    "emitParticle(scene, buildingMeshes, particles, particleGeo, particleMats, tileId, 'DIRT');",
    "emitParticle(scene, buildingMeshes, particles, particleGeo, particleMats, tileId, 'SMOKE');",
    "emitParticle(scene, buildingMeshes, particles, particleGeo, particleMats, tileId, 'ECO');",
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
