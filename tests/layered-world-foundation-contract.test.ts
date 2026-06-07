import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const layeredTypesPath = path.join(process.cwd(), 'engine', 'types', 'layeredWorld.ts');
const gameTypesPath = path.join(process.cwd(), 'engine', 'types', 'game.ts');
const typesBarrelPath = path.join(process.cwd(), 'types.ts');
const generatorPath = path.join(process.cwd(), 'engine', 'worldgen', 'LayeredWorldGenerator.ts');
const stateManagerPath = path.join(process.cwd(), 'engine', 'state', 'StateManager.ts');
const persistencePath = path.join(process.cwd(), 'engine', 'sim', 'PersistenceManager.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('layered world state defines destructible vertical voxel cells', () => {
  assert.equal(existsSync(layeredTypesPath), true, 'layered world types file is missing');
  const source = readFileSync(layeredTypesPath, 'utf8');

  for (const snippet of [
    "export type WorldVoxelMaterial =",
    "| 'AIR'",
    "| 'WATER'",
    "| 'ORE'",
    "| 'GEMS'",
    "| 'AUREUS_VEIN'",
    "| 'BEDROCK'",
    'export interface WorldVoxelCell {',
    'y: number;',
    'destructible: boolean;',
    'walkable: boolean;',
    'mineable: boolean;',
    'stability: number;',
    'moisture: number;',
    'export interface LayeredWorldState {',
    'activeY: number;',
    'accessPoints: Record<string, { x: number; y: number; z: number;',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('surface chunks can be migrated into downward layers without replacing surface gameplay', () => {
  assert.equal(existsSync(generatorPath), true, 'LayeredWorldGenerator.ts is missing');
  const source = readFileSync(generatorPath, 'utf8');

  for (const snippet of [
    'export const LAYERED_WORLD_MIGRATION_VERSION = 1;',
    'export const DEFAULT_LAYER_MIN_Y = -8;',
    'export const DEFAULT_LAYER_MAX_Y = 4;',
    'export const DEFAULT_SURFACE_LAYER_Y = 0;',
    'function terrainMaterialForSurface(tile: GridTile): WorldVoxelMaterial {',
    "return 'WATER';",
    "return 'BEDROCK';",
    "if (oreSeed % 97 === 0) return 'GEMS';",
    "if (oreSeed % SOLID_RESOURCE_INTERVAL === 0) return 'ORE';",
    'export function createLayeredChunkFromSurfaceChunk(',
    'export function createLayeredWorldFromSurfaceChunks(',
    'export function normalizeLayeredWorldState(',
    'generatedFromSurfaceVersion: chunk.version ?? 0,',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('game state and public type exports expose layered world state', () => {
  const gameTypes = readFileSync(gameTypesPath, 'utf8');
  const barrel = readFileSync(typesBarrelPath, 'utf8');

  for (const snippet of [
    "import type { LayeredWorldState } from './layeredWorld';",
    'layeredWorld: LayeredWorldState;',
  ]) {
    assert.match(gameTypes, new RegExp(escapeRegExp(snippet)));
  }

  assert.match(barrel, /export \* from '\.\/engine\/types\/layeredWorld';/);
});

test('initial state and persistence backfill layered world from current chunks', () => {
  const stateManager = readFileSync(stateManagerPath, 'utf8');
  const persistence = readFileSync(persistencePath, 'utf8');

  for (const snippet of [
    "import { normalizeLayeredWorldState } from '../worldgen/LayeredWorldGenerator';",
    'const initialChunks = this.createInitialChunks(seed, overrides?.chunks);',
    'layeredWorld: normalizeLayeredWorldState(initialChunks, overrides?.layeredWorld),',
    'const chunks = this.createInitialChunks(seed, overrides?.chunks);',
    'layeredWorld: normalizeLayeredWorldState(chunks, overrides?.layeredWorld),',
  ]) {
    assert.match(stateManager, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    "import { normalizeLayeredWorldState } from '../worldgen/LayeredWorldGenerator';",
    "if (key === 'layeredWorld' && value && typeof value === 'object') {",
    'chunks: {},',
    'private ensureLayeredWorldState(state: GameState): void {',
    'state.layeredWorld = normalizeLayeredWorldState(state.chunks || {}, state.layeredWorld);',
    'this.ensureLayeredWorldState(state);',
  ]) {
    assert.match(persistence, new RegExp(escapeRegExp(snippet)));
  }
});
