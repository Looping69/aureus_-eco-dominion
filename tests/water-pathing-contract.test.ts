import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const pathfindingPath = path.join(process.cwd(), 'engine', 'sim', 'algorithms', 'Pathfinding.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('pathfinding treats water as a heavy movement penalty before building shortcuts', () => {
  assert.equal(existsSync(pathfindingPath), true, 'Pathfinding.ts is missing');

  const source = readFileSync(pathfindingPath, 'utf8');

  for (const snippet of [
    'WATER: 48.0',
    'const isWaterTile = (tile: GridTile): boolean => {',
    'return tile.terrainHeight === 0 || tile.buildingType === BuildingType.POND || tile.buildingType === BuildingType.RESERVOIR;',
    'if (tile.buildingType === BuildingType.ROAD) return COST.ROAD;',
    'if (isWaterTile(tile)) return COST.WATER;',
    'if (tile.buildingType !== BuildingType.EMPTY && !tile.isUnderConstruction) return 1.0; // Indoors',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
