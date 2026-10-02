import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { EraSystem } from '../game/sim/EraSystem';
import { ERAS } from '../game/data/eras';
import { Simulation } from '../engine/sim/Simulation';
import { BuildingType, Era, GameStep, SfxType } from '../types';
import type { GameState, GridTile } from '../types';

function building(buildingType: BuildingType, x: number, extra: Partial<GridTile> = {}): GridTile {
  return { buildingType, x, z: 0, ...extra } as GridTile;
}

function fixture(): GameState {
  // Only the fields consumed by progression; no renderer, storage, or world boot.
  return {
    currentEra: Era.SETTLEMENT,
    unlockedEras: [Era.SETTLEMENT],
    step: GameStep.PLAYING,
    resources: { agt: 5000, eco: 0, trust: 0 },
    agents: Array.from({ length: 3 }, () => ({ type: 'WORKER' })),
    chunks: { '0,0': { tiles: [
      building(BuildingType.STAFF_QUARTERS, 0),
      building(BuildingType.STORAGE_DEPOT, 1),
      building(BuildingType.MINING_HEADFRAME, 2),
    ] } },
    tickCount: 42,
    newsFeed: [],
    pendingEffects: [],
  } as unknown as GameState;
}

const context = (time: number) => ({
  time, fixedDt: 1 / 30, stepIndex: 0, getNextId: (prefix: string) => `${prefix}-test`,
});

test('era ownership stays in the game with no engine compatibility exports', () => {
  assert.equal(existsSync('engine/sim/systems/EraSystem.ts'), false);
  assert.equal(existsSync('engine/data/eras.ts'), false);
  assert.equal(existsSync('engine/sim/systems/index.ts'), false);
  assert.doesNotMatch(readFileSync('engine/data/VoxelConstants.ts', 'utf8'), /eras/);
  assert.match(readFileSync('game/AureusWorld.ts', 'utf8'), /import \{ EraSystem \} from '.\/sim\/EraSystem'/);
});

test('game-owned progression runs through the engine scheduler and preserves unlock effects', () => {
  const state = fixture();
  const simulation = new Simulation();
  simulation.addSystem(new EraSystem());
  simulation.init();
  simulation.tick(context(0.99), state);
  assert.equal(state.currentEra, Era.SETTLEMENT);
  simulation.tick(context(1), state);
  assert.equal(state.currentEra, Era.GROWTH);
  assert.deepEqual(state.unlockedEras, [Era.SETTLEMENT, Era.GROWTH]);
  assert.equal(state.eraUnlockedPopup, Era.GROWTH);
  assert.deepEqual(state.newsFeed, [{
    id: 'era-test', headline: `NEW ERA UNLOCKED: ${ERAS[Era.GROWTH].name}!`,
    type: 'POSITIVE', timestamp: 42,
  }]);
  assert.deepEqual(state.pendingEffects, [{ type: 'AUDIO', sfx: SfxType.COMPLETE }]);
  simulation.tick(context(2), state);
  assert.equal(state.newsFeed.length, 1);
  simulation.dispose();
});

test('growth still requires eligible colonists, funds, and completed structure heads', () => {
  const cases: Array<(state: GameState) => void> = [
    state => { state.resources.agt = 4999; },
    state => { state.agents[2].type = 'ILLEGAL_MINER'; },
    state => { state.chunks['0,0'].tiles[2].isUnderConstruction = true; },
    state => { state.chunks['0,0'].tiles[2].buildingType = BuildingType.EMPTY; },
    state => { Object.assign(state.chunks['0,0'].tiles[2], { structureHeadX: 0, structureHeadZ: 0 }); },
  ];
  for (const mutate of cases) {
    const state = fixture();
    mutate(state);
    new EraSystem().tick(context(1), state);
    assert.equal(state.currentEra, Era.SETTLEMENT);
    assert.equal(state.newsFeed.length, 0);
    assert.equal(state.pendingEffects.length, 0);
  }
});

test('progression advances at most one chapter per check and stops at prosperity', () => {
  const state = fixture();
  state.resources.agt = 100000;
  state.resources.eco = 100;
  state.resources.trust = 100;
  state.agents = Array.from({ length: 25 }, () => state.agents[0]);
  const system = new EraSystem();
  for (const [index, era] of [Era.GROWTH, Era.INDUSTRY, Era.SUSTAINABILITY, Era.PROSPERITY].entries()) {
    system.tick(context(index + 1), state);
    assert.equal(state.currentEra, era);
    system.tick(context(index + 1.5), state);
    assert.equal(state.currentEra, era);
  }
  system.tick(context(5), state);
  assert.equal(state.currentEra, Era.PROSPERITY);
  assert.equal(state.newsFeed.length, 4);
  assert.equal(new Set(state.unlockedEras).size, 5);
});
