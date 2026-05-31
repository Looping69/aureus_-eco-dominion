import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const worldPath = path.join(process.cwd(), 'game', 'AureusWorld.ts');
const rendererPath = path.join(process.cwd(), 'game', 'render', 'systems', 'BuildingRenderSystem.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Building renderer contract accepts logistics factory state and overlay mode', () => {
  assert.equal(existsSync(rendererPath), true, 'BuildingRenderSystem.ts is missing');

  const source = readFileSync(rendererPath, 'utf8');

  for (const snippet of [
    'factory?: FactoryState',
    "overlayMode: LogisticsOverlayMode = 'OFF'",
    'this.updateLogisticsVisuals(chunks, factory, overlayMode, time);',
    "if (tile.buildingType === BuildingType.RAIL_LINE && connections)",
    "if (tile.buildingType === BuildingType.DISTRIBUTION_HUB)",
    "if (tile.buildingType === BuildingType.TRAIN_STATION)",
    'this.decorateTrainStation(buildingGroup, seed);',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Renderer distinguishes rail and drone packet traffic for in-world logistics feedback', () => {
  assert.equal(existsSync(rendererPath), true, 'BuildingRenderSystem.ts is missing');

  const source = readFileSync(rendererPath, 'utf8');

  for (const snippet of [
    'FactoryPacketTransportMode',
    'private railPacketGeo = new THREE.BoxGeometry',
    'private dronePacketGeo = new THREE.OctahedronGeometry',
    "const mode = (packet.transportMode || 'BELT') as FactoryPacketTransportMode;",
    "mode === 'RAIL' ? this.railPacketGeo : mode === 'DRONE' ? this.dronePacketGeo : this.packetGeo",
    "if (mode === 'DRONE')",
    "if (mode === 'RAIL')",
    'activeDroneStations',
    'activeRailNodes',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Renderer exposes named sector labels, regional bulk-load markers, and drone-pressure feedback', () => {
  assert.equal(existsSync(rendererPath), true, 'BuildingRenderSystem.ts is missing');

  const source = readFileSync(rendererPath, 'utf8');

  for (const snippet of [
    'private sectorLabelCache: Map<string, THREE.SpriteMaterial> = new Map();',
    'private getSectorLabelMaterial(text: string, color: number): THREE.SpriteMaterial {',
    'private getSectorColor(label: string): number {',
    'private getSectorCode(label: string): string {',
    'packet.sectorFrom && packet.sectorTo && packet.sectorFrom !== packet.sectorTo',
    'factory.dronePressure || 0',
    'node.sectorName',
    'stationDroneLoad',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('AureusWorld forwards factory state and overlay mode through every building render pass', () => {
  assert.equal(existsSync(worldPath), true, 'AureusWorld.ts is missing');

  const source = readFileSync(worldPath, 'utf8');

  for (const snippet of [
    'state.factory,',
    'state.logistics.overlayMode,',
    "this.buildingRenderSystem.update(",
    "'FIRST_PERSON'",
    "'SURFACE'",
    'this.render.getRuntimeQuality().smoothDetail',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('UPDATE_LOGISTICS persists overlay-mode changes into engine-owned state', () => {
  assert.equal(existsSync(worldPath), true, 'AureusWorld.ts is missing');

  const source = readFileSync(worldPath, 'utf8');

  for (const snippet of [
    "case 'UPDATE_LOGISTICS':",
    'action.payload.overlayMode !== undefined',
    "this.stateManager.mutate('logistics',",
    'overlayMode: action.payload.overlayMode',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
