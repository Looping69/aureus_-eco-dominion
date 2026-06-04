import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const helperPath = path.join(process.cwd(), 'game', 'render', 'systems', 'BuildingPreviewController.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

test('Building preview controller helpers are split into a dedicated module', () => {
  assert.equal(existsSync(helperPath), true, 'BuildingPreviewController.ts is missing');

  const source = readFileSync(helperPath, 'utf8');

  for (const snippet of [
    "import * as THREE from 'three';",
    "import { BuildingType } from '../../../types';",
    "import { BUILDINGS } from '../../../engine/data/VoxelConstants';",
    "import { BuildingFactory } from '../../../engine/render/utils/VoxelGenerators';",
    'export class BuildingPreviewController {',
    'private selectionCursor: THREE.Mesh;',
    'private ghostBuilding: THREE.Group | null = null;',
    'private ghostType: BuildingType | null = null;',
    'private pinnedGhostPos: { x: number; z: number } | null = null;',
    'public setPinnedGhost(pos: { x: number; z: number } | null, y: number = 0) {',
    'public setGhostBuilding(type: BuildingType | null) {',
    "const group = BuildingFactory[type]({ level: 1 });",
    'transparent: true,',
    'opacity: 0.5,',
    'emissive: 0x444444,',
    "public setCursorMode(mode: 'BUILD' | 'BULLDOZE' | 'INSPECT') {",
    "mat.color.setHex(0xf43f5e);",
    "mat.color.setHex(0x3b82f6);",
    "mat.color.setHex(0x22c55e);",
    'public updateCursor(pos: THREE.Vector3 | null, fallbackCenter: THREE.Vector3 | null = null) {',
    'this.selectionCursor.position.set(cx, pos.y + 0.1, cz);',
    'this.ghostBuilding.position.set(cx + dx, ghostPos.y, cz + dz);',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
