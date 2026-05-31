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

test('Phase 3 packet types expose explicit belt, rail, and drone transport modes plus regional packet metadata', () => {
  assert.equal(existsSync(gameTypesPath), true, 'engine/types/game.ts is missing');

  const source = readFileSync(gameTypesPath, 'utf8');

  for (const snippet of [
    "export type FactoryPacketTransportMode = 'BELT' | 'RAIL' | 'DRONE';",
    'transportMode?: FactoryPacketTransportMode;',
    'sectorName?: string;',
    'sectorFrom?: string;',
    'sectorTo?: string;',
    'regionalThroughput?: number;',
    'dronePressure?: number;',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Train stations act as regional sector anchors and can extend to drone-served last-mile nodes', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
    "[BuildingType.RAIL_LINE, BuildingType.DISTRIBUTION_HUB, BuildingType.TRAIN_STATION].includes(type)",
    "if ([BuildingType.STORAGE_DEPOT, BuildingType.STOCKPILE].includes(type)) return 'SINK';",
    "sectorName: tile.buildingType === BuildingType.TRAIN_STATION ? this.getRegionalSectorName(tile.x, tile.z) : undefined,",
    'private getRegionalSectorName(x: number, z: number): string {',
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

test('Train packets distinguish long-haul inter-sector rail movement from pressure-limited drone dispatch', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
    'const transportMode = this.getPacketTransportMode(node, route.node);',
    'const sectorFrom = this.getPacketSector(factory, node, route.node, transportMode);',
    'const sectorTo = this.getPacketSector(factory, route.node, node, transportMode);',
    'factory.regionalThroughput = regionalThroughput / this.FACTORY_INTERVAL;',
    'factory.dronePressure = droneTrips > 0 ? dronePressureTotal / droneTrips : 0;',
    'private getDroneTransferBudget(factory: FactoryState, station: FactoryNodeState | null): number {',
    'private countActiveDroneTrips(factory: FactoryState, station: FactoryNodeState | null): number {',
    'private getDronePressure(factory: FactoryState, station: FactoryNodeState | null): number {',
    "if (origin.buildingType === BuildingType.TRAIN_STATION && destination.mode !== 'TRANSPORT') return 'DRONE';",
    "if (destination.buildingType === BuildingType.TRAIN_STATION && origin.mode !== 'TRANSPORT') return 'DRONE';",
    "if (origin.buildingType === BuildingType.TRAIN_STATION || destination.buildingType === BuildingType.TRAIN_STATION) return 'RAIL';",
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
