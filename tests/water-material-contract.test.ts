import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const voxelMaterialsPath = path.join(process.cwd(), 'engine', 'render', 'materials', 'VoxelMaterials.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Water material keeps wave animation constrained to shallow upward-facing surface vertices', () => {
  assert.equal(existsSync(voxelMaterialsPath), true, 'VoxelMaterials.ts is missing');

  const source = readFileSync(voxelMaterialsPath, 'utf8');

  for (const snippet of [
    'side: THREE.FrontSide',
    'depthWrite: false',
    'float topFaceWaveMask = step(0.55, normal.y);',
    'float wave1 = sin(myWorldPosition.x * 1.5 + time * 1.2) * 0.045;',
    'float wave2 = cos(myWorldPosition.z * 1.2 + time * 1.5) * 0.045;',
    'float wave3 = sin((myWorldPosition.x * 0.8 + myWorldPosition.z * 0.5) - time) * 0.03;',
    'float height = (wave1 + wave2 + wave3) * topFaceWaveMask;',
    'if (normal.y > 0.55) {',
    'float wavePeak = smoothstep(0.0, 0.1, vWaveHeight);',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(source, /transformed\.y \+= height;\s+\n\s+vWorldPos = myWorldPosition\.xyz \+ vec3\(0\.0, height, 0\.0\);\s+\n\s+vWaveHeight = height;[\s\S]*?float wave1 = sin\(myWorldPosition\.x \* 1\.5 \+ time \* 1\.2\) \* 0\.15;/);
});
