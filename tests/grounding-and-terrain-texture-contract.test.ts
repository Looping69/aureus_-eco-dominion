import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const groundingPath = path.join(process.cwd(), 'engine', 'physics', 'RapierGroundingProbe.ts');
const agentRenderPath = path.join(process.cwd(), 'game', 'render', 'systems', 'AgentRenderSystem.ts');
const voxelMaterialsPath = path.join(process.cwd(), 'engine', 'render', 'materials', 'VoxelMaterials.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('agent rendering warms Rapier grounding and snaps agents to terrain height', () => {
  assert.equal(existsSync(groundingPath), true, 'RapierGroundingProbe.ts is missing');
  assert.equal(existsSync(agentRenderPath), true, 'AgentRenderSystem.ts is missing');

  const grounding = readFileSync(groundingPath, 'utf8');
  const agentRender = readFileSync(agentRenderPath, 'utf8');

  for (const snippet of [
    "import RAPIER from '@dimforge/rapier3d-compat';",
    'export function warmRapierGroundingProbe(): void {',
    'void RAPIER.init()',
    'export function isRapierGroundingReady(): boolean {',
    'export function computeGroundedHeight(',
    'const maxStep = Math.max(0.02, maxSnapSpeed * frameDt);',
    'if (Math.abs(delta) <= maxStep) return terrainY;',
    'return currentY + Math.sign(delta) * maxStep;',
  ]) {
    assert.match(grounding, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    "import { computeGroundedHeight, warmRapierGroundingProbe } from '../../../engine/physics/RapierGroundingProbe';",
    'warmRapierGroundingProbe();',
    'const terrainHeight = this.getHeightAt(meshGroup.position.x, meshGroup.position.z);',
    'meshGroup.position.y = computeGroundedHeight(meshGroup.position.y, terrainHeight, dt);',
  ]) {
    assert.match(agentRender, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(agentRender, /meshGroup\.position\.y = THREE\.MathUtils\.lerp\(meshGroup\.position\.y, terrainHeight, 0\.15\);/);
});

test('terrain material uses designed biome texture patterns instead of generic tint noise', () => {
  assert.equal(existsSync(voxelMaterialsPath), true, 'VoxelMaterials.ts is missing');

  const source = readFileSync(voxelMaterialsPath, 'utf8');

  for (const snippet of [
    "mat.customProgramCacheKey = () => 'aureus-designed-terrain-textures-v2';",
    'varying vec3 vTerrainNormal;',
    'float terrainRidge(vec2 p) {',
    'float terrainFleck(vec2 p, float threshold) {',
    'float topFace = smoothstep(0.38, 0.72, vTerrainNormal.y);',
    'float grassBlade = smoothstep(0.56, 0.86, terrainRidge',
    'float grassThatch = smoothstep(0.46, 0.78, terrainNoise',
    'float dune = sin((terrainUv.x * 0.64)',
    'float sandGrain = smoothstep(0.62, 0.96, pebbleNoise) * topFace;',
    'float stoneCrack = smoothstep(0.80, 0.94, terrainRidge',
    'float mineralFleck = terrainFleck(terrainUv * 5.0',
    'float dirtClump = smoothstep(0.42, 0.78, terrainNoise',
    'float rootFiber = smoothstep(0.63, 0.90, terrainRidge',
    'diffuseColor.rgb = clamp(albedo, vec3(0.0), vec3(1.0));',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(source, /vec3 grassTint = vec3\(0\.96, 1\.02, 0\.94\);/);
  assert.doesNotMatch(source, /albedo = mix\(albedo, vBaseColor, 0\.18\);/);
});
