import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const gameTypesPath = path.join(process.cwd(), 'engine', 'types', 'game.ts');
const logisticsPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'LogisticsSystem.ts');
const buildingsPath = path.join(process.cwd(), 'engine', 'data', 'buildings.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Phase 3 packet types expose explicit belt, rail, and drone transport modes', () => {
  assert.equal(existsSync(gameTypesPath), true, 'engine/types/game.ts is missing');

  const source = readFileSync(gameTypesPath, 'utf8');

  for (const snippet of [
    "export type FactoryPacketTransportMode = 'BELT' | 'RAIL' | 'DRONE';",
    'transportMode?: FactoryPacketTransportMode;',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Train stations act as transport nodes instead of dead-end sinks and can extend to drone-served last-mile nodes', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
    "[BuildingType.RAIL_LINE, BuildingType.DISTRIBUTION_HUB, BuildingType.TRAIN_STATION].includes(type)",
    "if ([BuildingType.STORAGE_DEPOT, BuildingType.STOCKPILE].includes(type)) return 'SINK';",
    'private findRailLinkedStations(factory: FactoryState, origin: FactoryNodeState): FactoryNodeState[] {',
    'private findDroneServedNodes(factory: FactoryState, origin: FactoryNodeState): FactoryNodeState[] {',
    'this.findRailLinkedStations(factory, node).forEach((neighbor) => neighborMap.set(neighbor.key, neighbor));',
    'this.findDroneServedNodes(factory, node).forEach((neighbor) => neighborMap.set(neighbor.key, neighbor));',
    'const manhattanDistance = Math.abs(node.x - origin.x) + Math.abs(node.z - origin.z);',
    'if (manhattanDistance <= this.MAX_DRONE_RADIUS)',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Train packets distinguish long-haul rail movement from short-range drone dispatch', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
    'const transportMode = this.getPacketTransportMode(node, route.node);',
    'transportMode,',
    'private getPacketTransportMode(origin: FactoryNodeState, destination: FactoryNodeState): FactoryPacketTransportMode {',
    "if (origin.buildingType === BuildingType.TRAIN_STATION && destination.mode !== 'TRANSPORT') return 'DRONE';",
    "if (destination.buildingType === BuildingType.TRAIN_STATION && origin.mode !== 'TRANSPORT') return 'DRONE';",
    "if (origin.buildingType === BuildingType.TRAIN_STATION || destination.buildingType === BuildingType.TRAIN_STATION) return 'RAIL';",
    'private getPacketSpeed(mode: FactoryPacketTransportMode): number {',
    "if (mode === 'RAIL') return this.RAIL_TRAVEL_SPEED;",
    "if (mode === 'DRONE') return this.DRONE_TRAVEL_SPEED;",
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Building definitions describe rail lines and train stations as regional logistics infrastructure', () => {
  assert.equal(existsSync(buildingsPath), true, 'engine/data/buildings.ts is missing');

  const source = readFileSync(buildingsPath, 'utf8');

  for (const snippet of [
    'Industrial track for regional bulk transport between train hubs.',
    'Regional Rail Throughput',
    'dispatches short-range drones for nearby delivery',
    'Regional Rail + Drone Dispatch, +50 Trust/s',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
