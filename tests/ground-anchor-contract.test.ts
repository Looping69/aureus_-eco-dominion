import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const anchorsPath = path.join(process.cwd(), 'engine', 'render', 'utils', 'GroundAnchors.ts');
const workerPath = path.join(process.cwd(), 'engine', 'jobs', 'engine.worker.ts');
const linePreviewPath = path.join(process.cwd(), 'game', 'render', 'LinePlacementPreview.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('shared ground anchor constants define terrain, water, building, and preview heights', () => {
  assert.equal(existsSync(anchorsPath), true, 'GroundAnchors.ts is missing');

  const source = readFileSync(anchorsPath, 'utf8');

  for (const snippet of [
    'export const TERRAIN_HEIGHT_SCALE = 0.5;',
    'export const WATER_BASIN_DEPTH = 0.65;',
    'export const WATER_SURFACE_CLEARANCE = 0.82;',
    'export const AGENT_WATER_SUBMERGE_DEPTH = 0.28;',
    'export const BUILDING_BASE_CLEARANCE = 0;',
    'export const INFRASTRUCTURE_PREVIEW_CLEARANCE = 0.04;',
    'export const INFRASTRUCTURE_ANCHOR_CLEARANCE = 0.09;',
    'export function getTerrainSurfaceY(height: number): number {',
    'export function getCarvedWaterbedY(height: number): number {',
    'export function getWaterSurfaceY(height: number): number {',
    'export function getAgentWaterWadeY(height: number): number {',
    'return getWaterSurfaceY(height) - AGENT_WATER_SUBMERGE_DEPTH;',
    'export function getBuildingAnchorY(height: number): number {',
    'export function getInfrastructurePreviewY(terrainY: number): number {',
    'export function getInfrastructureAnchorY(terrainY: number): number {',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('water mesh generation anchors surfaces to carved voxel basins instead of floating cuboids', () => {
  assert.equal(existsSync(workerPath), true, 'engine.worker.ts is missing');

  const source = readFileSync(workerPath, 'utf8');

  for (const snippet of [
    "import { getCarvedWaterbedY, getTerrainSurfaceY, getWaterSurfaceY } from '../render/utils/GroundAnchors';",
    "if (data.bt === 'POND' || data.bt === 'RESERVOIR') return getCarvedWaterbedY(data.h);",
    'if (!data.in && data.h === 0) return getCarvedWaterbedY(data.h);',
    'return getTerrainSurfaceY(data.h);',
    'y: getTerrainSurfaceY(data.h),',
    'addBlockTop(',
    'getWaterSurfaceY(data.h),',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(source, /const waterY = data\.h === 0 \? -0\.5 : \(data\.h \* 0\.5\) - 0\.5;/);
  assert.doesNotMatch(source, /addFace\(\n\s*water,\n\s*macro\.localCenterX,\n\s*waterY,/);
});

test('line placement preview uses shared anchor offsets instead of hard-coded floating values', () => {
  assert.equal(existsSync(linePreviewPath), true, 'LinePlacementPreview.ts is missing');

  const source = readFileSync(linePreviewPath, 'utf8');

  for (const snippet of [
    "import { getInfrastructureAnchorY, getInfrastructurePreviewY } from '../../engine/render/utils/GroundAnchors';",
    'const y = getInfrastructurePreviewY(this.getTerrainHeight(x, z));',
    'const anchorY = getInfrastructureAnchorY(this.getTerrainHeight(startX, startZ));',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(source, /this\.getTerrainHeight\(x, z\) \+ 0\.09/);
  assert.doesNotMatch(source, /this\.getTerrainHeight\(startX, startZ\) \+ 0\.18/);
});