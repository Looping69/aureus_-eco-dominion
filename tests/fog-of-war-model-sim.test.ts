import assert from 'node:assert/strict';
import test from 'node:test';

import { BuildingType } from '../types';
import { ChunkStore } from '../engine/space/ChunkStore';
import {
  FOG_AGENT_REVEAL_RADIUS,
  FOG_SPAWN_REVEAL_RADIUS,
  getFogOfWarRevealSources,
  revealFogOfWarAroundSources,
} from '../engine/sim/fogOfWar/FogOfWarModel';

function makeState() {
  const chunk = ChunkStore.createChunk(0, 0, 0);
  return {
    spawnX: 4,
    spawnZ: 4,
    chunks: { '0,0': chunk },
    agents: [],
  } as any;
}

test('new chunks start unexplored so fog can hide unrevealed terrain', () => {
  const chunk = ChunkStore.createChunk(0, 0, 0);
  assert.equal(chunk.tiles.every(tile => tile.explored === false), true);
});

test('fog reveal marks spawn and surface agent areas explored permanently', () => {
  const state = makeState();
  const originTile = ChunkStore.getTile(state.chunks, 4, 4);
  const farTile = ChunkStore.getTile(state.chunks, 15, 15);
  assert.equal(originTile?.explored, false);
  assert.equal(farTile?.explored, false);

  const changedFromSpawn = revealFogOfWarAroundSources(state);
  assert.equal(changedFromSpawn, true);
  assert.equal(originTile?.explored, true);
  assert.equal(farTile?.explored, true);

  state.agents.push({ id: 'agent_1', x: 15, z: 0, visualX: 15, visualZ: 0, layer: 0 });
  const sources = getFogOfWarRevealSources(state);
  assert.equal(sources.some(source => source.radius === FOG_SPAWN_REVEAL_RADIUS), true);
  assert.equal(sources.some(source => source.x === 15 && source.z === 0 && source.radius === FOG_AGENT_REVEAL_RADIUS), true);
});

test('completed surface buildings become reveal sources', () => {
  const state = makeState();
  const tile = ChunkStore.getTile(state.chunks, 12, 12);
  assert.ok(tile);
  tile.buildingType = BuildingType.STAFF_QUARTERS;
  tile.isUnderConstruction = false;

  const sources = getFogOfWarRevealSources(state);
  assert.equal(sources.some(source => source.x === 12 && source.z === 12), true);
});
