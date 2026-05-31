import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const logisticsPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'LogisticsSystem.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Train stations act as transport nodes instead of dead-end sinks', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
    "[BuildingType.RAIL_LINE, BuildingType.DISTRIBUTION_HUB, BuildingType.TRAIN_STATION].includes(type)",
    "if ([BuildingType.STORAGE_DEPOT, BuildingType.STOCKPILE].includes(type)) return 'SINK';",
    'private findRailLinkedStations(factory: FactoryState, origin: FactoryNodeState): FactoryNodeState[] {',
    'BuildingType.RAIL_LINE, BuildingType.TRAIN_STATION',
    'if (node.buildingType === BuildingType.TRAIN_STATION) {',
    'neighbors.push(...this.findRailLinkedStations(factory, node));',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Train stations get higher transfer budgets and larger rail buffer capacity', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
    'if (node.buildingType === BuildingType.TRAIN_STATION) return 12;',
    'if (node.buildingType === BuildingType.RAIL_LINE) return 4;',
    'const cap = node.buildingType === BuildingType.TRAIN_STATION ? 36',
    'speed: route.node.buildingType === BuildingType.TRAIN_STATION ? this.PACKET_TRAVEL_SPEED * 1.5 : this.PACKET_TRAVEL_SPEED,',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
