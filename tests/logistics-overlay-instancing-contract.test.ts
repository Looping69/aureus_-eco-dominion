import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const helperPath = path.join(process.cwd(), 'game', 'render', 'systems', 'LogisticsOverlayInstancing.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

test('Logistics overlay instancing helpers are split into a dedicated module', () => {
  assert.equal(existsSync(helperPath), true, 'LogisticsOverlayInstancing.ts is missing');

  const source = readFileSync(helperPath, 'utf8');

  for (const snippet of [
    "import * as THREE from 'three';",
    "import { FactoryPacketTransportMode } from '../../../types';",
    "import { PacketInstanceSpec } from './PacketInstancedLayer';",
    'export function createInstanceSpec(',
    'bucketKey,',
    'rotationX,',
    'rotationY,',
    'rotationZ,',
    'export function getPacketInstanceMaterial(',
    'packetMats[resource] || packetMats.ORE',
    "material.opacity = mode === 'DRONE' ? 0.92 : 0.96;",
    'packetInstanceMaterialCache.set(key, material);',
    'export function getOverlayInstanceMaterial(',
    'const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });',
    'overlayInstanceMaterialCache.set(key, material);',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
