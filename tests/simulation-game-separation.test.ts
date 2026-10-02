import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { Simulation } from '../engine/sim/Simulation';
import { CommandErrorCode } from '../engine/kernel/Types';
import { StateManager } from '../game/state/StateManager';
import { CommandDispatcher } from '../game/sim/systems/CommandDispatcher';
import { ResearchSystem } from '../game/sim/systems/ResearchSystem';
import { TECHNOLOGIES } from '../game/data/tech';

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.[jt]sx?$/.test(entry.name) ? [file] : [];
  });
}

test('Aureus simulation rules and technology data cannot return to the engine', () => {
  for (const folder of ['systems', 'logic', 'construction', 'utility']) {
    assert.deepEqual(sourceFiles(`engine/sim/${folder}`), [], `${folder} belongs to the game`);
  }
  assert.equal(existsSync('engine/data/tech.ts'), false);
  assert.doesNotMatch(readFileSync('engine/data/VoxelConstants.ts', 'utf8'), /export.*tech/);
  assert.match(readFileSync('game/AureusWorld.ts', 'utf8'), /from '.\/sim\/systems'/);
  assert.ok(existsSync('engine/sim/Simulation.ts'));
  assert.ok(existsSync('engine/sim/resourceGrid/ResourceGridSolver.ts'));
  assert.ok(existsSync('engine/sim/algorithms/Pathfinding.ts'));
});

function fixture() {
  const manager = new StateManager({ seed: 42 });
  const state = manager.getMutableState();
  state.resources.agt = 20000;
  state.research.unlocked = [];
  state.newsFeed = [];
  state.pendingEffects = [];
  const dispatcher = new CommandDispatcher();
  const research = new ResearchSystem();
  dispatcher.setSystems([research]);
  const simulation = new Simulation();
  simulation.addSystem(research);
  simulation.addSystem(dispatcher);
  simulation.init();
  const tick = () => simulation.tick({
    fixedDt: 1 / 30, stepIndex: 0, time: 1,
    getNextId: prefix => `${prefix}-${state.research.unlocked.length}`,
  }, state);
  const queue = (techId: string) => manager.pushCommand('RESEARCH_TECH', { techId });
  return { manager, state, simulation, tick, queue };
}

test('research commands preserve ordered prerequisites, costs, notifications and saved unlocks', () => {
  const { manager, state, simulation, tick, queue } = fixture();
  queue('MARKET_ANALYTICS'); // Must fail before its prerequisite is processed.
  queue('ADVANCED_DRILLING');
  queue('MARKET_ANALYTICS');
  tick();
  assert.deepEqual(state.research.unlocked, ['ADVANCED_DRILLING', 'MARKET_ANALYTICS']);
  assert.equal(state.resources.agt, 20000 - TECHNOLOGIES.ADVANCED_DRILLING.cost - TECHNOLOGIES.MARKET_ANALYTICS.cost);
  assert.deepEqual(state.debug.commandTrace.map(entry => entry.result.ok), [false, true, true]);
  // Successful research uses notifications; existing failure feedback remains visible.
  assert.equal(state.ui.lastCommandResult?.code, CommandErrorCode.FORBIDDEN);
  assert.equal(state.commandQueue.length, 0);
  assert.equal(state.newsFeed.length, 2);
  assert.equal(state.pendingEffects.length, 2);
  const restored = new StateManager(JSON.parse(manager.serializeState()));
  assert.deepEqual(restored.getState().research, state.research);
  assert.equal(restored.getState().resources.agt, state.resources.agt);
  simulation.dispose();
});

test('invalid, unaffordable, and duplicate research commands cannot spend or reward twice', () => {
  const { state, simulation, tick, queue } = fixture();
  queue('UNKNOWN_TECH');
  tick();
  assert.equal(state.ui.lastCommandResult?.code, CommandErrorCode.INVALID_TARGET);
  state.resources.agt = TECHNOLOGIES.ADVANCED_DRILLING.cost - 1;
  queue('ADVANCED_DRILLING');
  tick();
  assert.equal(state.ui.lastCommandResult?.code, CommandErrorCode.INSUFFICIENT_RESOURCES);
  assert.equal(state.resources.agt, TECHNOLOGIES.ADVANCED_DRILLING.cost - 1);
  assert.deepEqual(state.research.unlocked, []);
  assert.equal(state.newsFeed.length, 0);
  assert.equal(state.pendingEffects.length, 0);
  state.resources.agt = TECHNOLOGIES.ADVANCED_DRILLING.cost;
  queue('ADVANCED_DRILLING');
  queue('ADVANCED_DRILLING');
  tick();
  assert.equal(state.ui.lastCommandResult?.code, CommandErrorCode.INVALID_STATE);
  assert.equal(state.resources.agt, 0);
  assert.deepEqual(state.research.unlocked, ['ADVANCED_DRILLING']);
  assert.equal(state.newsFeed.length, 1);
  assert.equal(state.pendingEffects.length, 1);
  simulation.dispose();
});
