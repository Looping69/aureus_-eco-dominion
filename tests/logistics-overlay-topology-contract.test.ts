import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const helperPath = path.join(process.cwd(), 'game', 'render', 'systems', 'LogisticsOverlayTopology.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Logistics overlay topology helpers are split into a dedicated module', () => {
  assert.equal(existsSync(helperPath), true, 'LogisticsOverlayTopology.ts is missing');

  const source = readFileSync(helperPath, 'utf8');

  for (const snippet of [
    "import * as THREE from 'three';",
    "import { BuildingType, Chunk, FactoryNodeState, FactoryState } from '../../../types';",
    "import { ChunkStore } from '../../../engine/space/ChunkStore';",
    'export function resourceTotal(bucket: Partial<Record<string, number>>) {',
    'export function isRecentlyActive(node: FactoryNodeState, lastTick: number) {',
    'export function getFactoryNeighbors(factory: FactoryState, node: FactoryNodeState): FactoryNodeState[] {',
    'export function isJunctionNode(factory: FactoryState, node: FactoryNodeState): boolean {',
    'export function isDroneHubNode(node: FactoryNodeState): boolean {',
    'export function getNodeWorldPosition(node: FactoryNodeState, chunks: Record<string, Chunk>) {',
    'export function getTargetChunks(chunks: Record<string, Chunk>, affectedChunkKeys?: Set<string>): Chunk[] {',
    'node.buildingType === BuildingType.TRAIN_STATION || node.buildingType === BuildingType.DRONE_DEPOT',
    'return [...affectedChunkKeys]',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
