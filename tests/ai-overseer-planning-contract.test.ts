import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const overseerPath = path.join(root, 'engine', 'sim', 'systems', 'AIOverseerPlaySystem.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('overseer does not place surplus owned buildings past the city plan', () => {
  const text = source(overseerPath);

  for (const snippet of [
    'private getOwnedBuildingToPlace(state: GameState): BuildIntent | null',
    'if (this.countPlacedBuildings(state, intent.type) >= (intent.desiredCount || 1)) continue;',
    'if (this.countPlacedBuildings(state, type) >= this.getDesiredCountForType(state, type)) continue;',
    'private getDesiredCountForType(state: GameState, type: BuildingType): number',
    'return Math.max(...matching.map(intent => intent.desiredCount || 1));',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('overseer reserves an open-pit yard and avoids existing pit/rubble tiles', () => {
  const text = source(overseerPath);

  for (const snippet of [
    'const EXCAVATION_RESERVE_OFFSET: Point = { x: 9, z: 9 };',
    'const EXCAVATION_RESERVE_RADIUS = 5;',
    'private getExcavationReserve(state: GameState): Point',
    'private isExcavationReserveTile(state: GameState, x: number, z: number): boolean',
    'if (this.isExcavationReserveTile(state, worldX, worldZ)) return false;',
    "if ((tile as any).openPitDepth > 0 || (tile.foliage as any) === 'ROCK_PEBBLE') return false;",
    'preserving mine space and clear paths',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('overseer uses zone-aware scored placement instead of an expanding building carpet', () => {
  const text = source(overseerPath);

  for (const snippet of [
    "type PlacementZone = 'CORE' | 'RESIDENTIAL' | 'PRODUCTION' | 'UTILITY' | 'ECO' | 'LOGISTICS';",
    'const PLACEMENT_SEARCH_RADIUS = 18;',
    'private getPlacementAnchors(state: GameState, type: BuildingType): Point[]',
    'private getPlacementZone(type: BuildingType): PlacementZone',
    'private scorePlacement(state: GameState, type: BuildingType',
    'const sameTypePenalty = this.countNearbyBuildings(state, type, x, z, width, depth, 3) * 4;',
    'const crowdingPenalty = this.countNearbyBuildings(state, null, x, z, width, depth, 1) * 8;',
    'private countNearbyBuildings(state: GameState, type: BuildingType | null',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('overseer builds a stockpile in era one before planning open-pit work', () => {
  const text = source(overseerPath);

  for (const snippet of [
    "{ type: BuildingType.STOCKPILE, reason: 'reserve a rubble and material yard before open-pit work begins', desiredCount: 1 }",
    "{ type: BuildingType.STOCKPILE, reason: 'expand rubble and storage capacity for bigger contracts', desiredCount: 2, minEra: Era.GROWTH }",
    "BuildingType.STOCKPILE,",
    "BuildingType.STORAGE_DEPOT,",
  ]) {
    assertSnippet(text, snippet);
  }
});
