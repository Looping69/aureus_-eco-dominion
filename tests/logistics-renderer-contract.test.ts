import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const worldPath = path.join(process.cwd(), 'game', 'AureusWorld.ts');
const rendererPath = path.join(process.cwd(), 'game', 'render', 'systems', 'BuildingRenderSystem.ts');
const overlayPresentationPath = path.join(process.cwd(), 'game', 'render', 'systems', 'LogisticsOverlayPresentation.ts');
const overlayLabelMaterialFactoryPath = path.join(process.cwd(), 'game', 'render', 'systems', 'OverlayLabelMaterialFactory.ts');
const era4IndexPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'buildings', 'era4', 'index.ts');
const droneDepotFactoryPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'buildings', 'era4', 'DroneDepot.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Building renderer contract accepts logistics factory state and overlay mode', () => {
  assert.equal(existsSync(rendererPath), true, 'BuildingRenderSystem.ts is missing');

  const source = readFileSync(rendererPath, 'utf8');

  for (const snippet of [
    'import { PacketInstancedLayer, PacketInstanceSpec } from \'./PacketInstancedLayer\';',
    'factory?: FactoryState',
    "overlayMode: LogisticsOverlayMode = 'OFF'",
    'affectedChunkKeys?: Set<string>,',
    'private packetInstanceLayer: PacketInstancedLayer;',
    'private overlayInstanceLayer: PacketInstancedLayer;',
    'this.updateLogisticsVisuals(chunks, factory, overlayMode, time);',
    'const visibleChunks = this.getTargetChunks(chunks, detailLevelChanged ? undefined : affectedChunkKeys);',
    "if (tile.buildingType === BuildingType.RAIL_LINE && connections)",
    "if (tile.buildingType === BuildingType.DISTRIBUTION_HUB)",
    "if (tile.buildingType === BuildingType.TRAIN_STATION)",
    "if (tile.buildingType === BuildingType.DRONE_DEPOT)",
    'this.decorateTrainStation(buildingGroup, seed);',
    'this.decorateDroneDepot(buildingGroup, seed);',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Renderer distinguishes rail and drone packet traffic and routes repeated packet bodies through instanced buckets', () => {
  assert.equal(existsSync(rendererPath), true, 'BuildingRenderSystem.ts is missing');

  const source = readFileSync(rendererPath, 'utf8');

  for (const snippet of [
    'FactoryPacketTransportMode',
    'private railPacketGeo = new THREE.BoxGeometry',
    'private dronePacketGeo = new THREE.OctahedronGeometry',
    'const packetInstances: PacketInstanceSpec[] = [];',
    'const overlayInstances: PacketInstanceSpec[] = [];',
    "const mode = (packet.transportMode || 'BELT') as FactoryPacketTransportMode;",
    "if (mode === 'DRONE')",
    "if (mode === 'RAIL')",
    'this.packetInstanceLayer.sync(packetInstances);',
    'this.overlayInstanceLayer.sync(overlayInstances);',
    'this.getPacketInstanceMaterial(packet.resource, mode, packetColor)',
    'private getPacketInstanceMaterial(resource: string, mode: FactoryPacketTransportMode, colorOverride?: number): THREE.MeshBasicMaterial {',
    'private createInstanceSpec(',
    'activeDroneStations',
    'activeRailNodes',
    'private isDroneHubNode(node: FactoryNodeState): boolean {',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Renderer exposes named sector labels, regional bulk-load markers, drone-pressure feedback, and a distinct depot silhouette', () => {
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
    'private decorateDroneDepot(group: THREE.Group, seed: number) {',
    'const launchRing = new THREE.Mesh(',
    'const controlSpire = new THREE.Mesh(',
    'const padOffsets: Array<[number, number]> = [',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Logistics overlay presentation helpers are split into a dedicated module for sector and planner labels', () => {
  assert.equal(existsSync(overlayPresentationPath), true, 'LogisticsOverlayPresentation.ts is missing');

  const source = readFileSync(overlayPresentationPath, 'utf8');

  for (const snippet of [
    "import { BuildingType, FactorySectorState } from '../../../types';",
    'const SECTOR_COLOR_PALETTE = [0x38bdf8, 0xf59e0b, 0x2dd4bf, 0xc084fc, 0xf97316, 0xa3e635];',
    'export function getSectorColor(label: string): number {',
    'export function getSectorPressure(sector: FactorySectorState | undefined): number {',
    'export function getSectorPressureColor(pressure: number): number {',
    'export function getSectorFlowColor(sector: FactorySectorState): number {',
    'export function getSectorSatisfactionColor(sector: FactorySectorState): number {',
    'export function getSectorCode(label: string): string {',
    'export function getPlannerColor(reason?: string): number {',
    'export function getSuggestedBuildingCode(type?: BuildingType): string {',
    'export function getSectorGoalLabel(sector: FactorySectorState): string {',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Overlay label material construction is split into a dedicated canvas helper', () => {
  assert.equal(existsSync(overlayLabelMaterialFactoryPath), true, 'OverlayLabelMaterialFactory.ts is missing');

  const source = readFileSync(overlayLabelMaterialFactoryPath, 'utf8');

  for (const snippet of [
    "import * as THREE from 'three';",
    'export function createOverlayLabelMaterial(text: string, color: number): THREE.SpriteMaterial {',
    "const canvas = document.createElement('canvas');",
    "ctx.fillStyle = 'rgba(8, 15, 25, 0.82)';",
    "ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;",
    "ctx.font = '700 24px sans-serif';",
    "ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);",
    'const texture = new THREE.CanvasTexture(canvas);',
    'return new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Drone depot renderer hook is backed by a registered voxel factory', () => {
  assert.equal(existsSync(era4IndexPath), true, 'engine/data/voxels/buildings/era4/index.ts is missing');
  assert.equal(existsSync(droneDepotFactoryPath), true, 'engine/data/voxels/buildings/era4/DroneDepot.ts is missing');

  const indexSource = readFileSync(era4IndexPath, 'utf8');
  const factorySource = readFileSync(droneDepotFactoryPath, 'utf8');

  for (const snippet of [
    "import { DroneDepotFactory } from './DroneDepot';",
    '[BuildingType.DRONE_DEPOT]: DroneDepotFactory',
  ]) {
    assert.match(indexSource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'export const DroneDepotFactory = (opts?: FactoryOptions) => {',
    'const isPowered = opts?.powerStatus === \'CONNECTED\';',
    'const padOffsets: Array<[number, number]> = [',
    'mats.emissiveCyan',
    'mats.emissiveGreen',
  ]) {
    assert.match(factorySource, new RegExp(escapeRegExp(snippet)));
  }
});

test('AureusWorld forwards factory state, overlay mode, and affected chunk ownership through every building render pass', () => {
  assert.equal(existsSync(worldPath), true, 'AureusWorld.ts is missing');

  const source = readFileSync(worldPath, 'utf8');

  for (const snippet of [
    'const affectedBuildingChunks = new Set<string>();',
    'const affectedChunks = this.terrainRenderSystem.updateChunk(effect.cx, effect.cz, effect.updates);',
    'affectedChunks.forEach((key) => affectedBuildingChunks.add(key));',
    'state.factory,',
    'state.logistics.overlayMode,',
    'affectedBuildingChunks,',
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
