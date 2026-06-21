import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const chunkStorePath = path.join(root, 'engine', 'space', 'ChunkStore.ts');
const fogModelPath = path.join(root, 'engine', 'sim', 'fogOfWar', 'FogOfWarModel.ts');
const renderFramePath = path.join(root, 'game', 'world', 'renderFrame.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('fog of war model keeps unrevealed terrain hidden and reveal sources shared', () => {
  const chunkStore = source(chunkStorePath);
  const fogModel = source(fogModelPath);
  const renderFrame = source(renderFramePath);

  for (const snippet of [
    'explored: false,',
  ]) {
    assertSnippet(chunkStore, snippet);
  }

  for (const snippet of [
    'export const FOG_SPAWN_REVEAL_RADIUS = 18;',
    'export const FOG_AGENT_REVEAL_RADIUS = 10;',
    'export const FOG_BUILDING_REVEAL_RADIUS = 7;',
    'export function getFogOfWarRevealSources(state: GameState): FogRevealSource[]',
    'export function getFogRevealDistance(x: number, z: number, sources: FogRevealSource[]): number',
    'export function revealFogOfWarAroundSources(state: GameState',
    'tile.explored = true;',
    'chunk.version += 1;',
  ]) {
    assertSnippet(fogModel, snippet);
  }

  for (const snippet of [
    'const revealSources = getFogOfWarRevealSources(state);',
    'if (tile.explored) continue;',
    'const revealDistance = getFogRevealDistance(tile.x, tile.z, revealSources);',
  ]) {
    assertSnippet(renderFrame, snippet);
  }
});
