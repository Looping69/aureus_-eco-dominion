import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { StateManager } from '../engine/state/StateManager.ts';
import { CommandDispatcher } from '../engine/sim/systems/CommandDispatcher.ts';
import { validateGameCommandType } from '../engine/game-definition/GameCommandValidator.ts';
import { AUREUS_GAME_DEFINITION } from '../game-definitions/aureus.ts';
import { enqueueWorldCommand } from '../game/useAureusEngineActions.ts';
import { dispatchWorldAction, type WorldDispatchBridgeDeps } from '../game/world/dispatchBridge.ts';
import type { AureusWorld } from '../game/AureusWorld.ts';
import type { FactorySectorState, GameState, Goal } from '../types.ts';
import { getActionBranch } from './helpers/actionBranch.ts';

function createFixture() {
    const manager = new StateManager();
    const state = manager.getMutableState();
    assert.ok(state.factory, 'the colony fixture must initialize factory state');
    const north: FactorySectorState = {
        name: 'North', exportFocus: 'MINERALS', importFocus: 'WOOD',
        exportBonus: 0, importDiscount: 0, demandBonus: 0, stationCount: 1, throughput: 10,
    };
    state.factory.sectors = [north, { ...north, name: 'South' }];
    state.tickCount = 42;
    state.commandQueue = [];
    state.debug.commandTrace = [];
    state.newsFeed = [];
    state.pendingEffects = [];
    state.activeGoal = null;
    // Only the read interface is needed to exercise the real UI command-enqueue helper.
    const world = { getState: () => state } as unknown as AureusWorld;
    const dispatcher = new CommandDispatcher();
    const tick = () => dispatcher.tick({ fixedDt: 1 / 30, stepIndex: 0, time: 42 / 30 }, state);
    return { state, world, tick };
}

function goal(rewardType: 'AGT' | 'GEMS', completed = true): Goal {
    return {
        id: 'alpha-goal', title: 'First production', description: 'Reach the resource target.',
        type: 'RESOURCE', targetType: 'MINERALS', targetValue: 10,
        currentValue: completed ? 10 : 5, reward: { type: rewardType, amount: 25 }, completed,
    };
}

function gameplayProjection(state: GameState) {
    return structuredClone({
        sectors: state.factory.sectors, resources: state.resources,
        activeGoal: state.activeGoal, newsFeed: state.newsFeed, pendingEffects: state.pendingEffects,
    });
}

test('sector hook queues policy commands and never reloads state in that branch', () => {
    const branch = getActionBranch(readFileSync('game/useAureusEngine.ts', 'utf8'), 'UPDATE_SECTOR_POLICY');
    assert.ok(branch.includes("enqueueWorldCommand(world, 'UPDATE_SECTOR_POLICY', action.payload);"));
    assert.doesNotMatch(branch, /\b(?:reloadWorldState|loadState)\s*\(/);
});

test('world dispatch also forwards goal and sector actions through its command boundary', () => {
    const queued: Array<[string, unknown]> = [];
    const deps = { pushCommand: (type: string, payload?: unknown) => queued.push([type, payload]) } as WorldDispatchBridgeDeps;
    const payload = { sectorName: 'North', directive: 'EXPORT' };
    dispatchWorldAction({ type: 'CLAIM_GOAL' }, deps);
    dispatchWorldAction({ type: 'UPDATE_SECTOR_POLICY', payload }, deps);
    assert.deepEqual(queued, [['CLAIM_GOAL', undefined], ['UPDATE_SECTOR_POLICY', payload]]);
});

test('active game definition declares both migrated commands and validates sector enum fields', () => {
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'CLAIM_GOAL', {}).ok, true);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'UPDATE_SECTOR_POLICY', { sectorName: 'North', directive: 'EXPORT' }).ok, true);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'UPDATE_SECTOR_POLICY', { sectorName: 'North', directive: 'INVALID' }).ok, false);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'UPDATE_SECTOR_POLICY', { directive: 'EXPORT' }).ok, false);
});

test('queued sector edits take effect only at dispatch and preserve unrelated gameplay', () => {
    const { state, world, tick } = createFixture();
    const before = gameplayProjection(state);
    const south = state.factory.sectors[1];
    enqueueWorldCommand(world, 'UPDATE_SECTOR_POLICY', { sectorName: 'North', directive: 'EXPORT' });
    enqueueWorldCommand(world, 'UPDATE_SECTOR_POLICY', { sectorName: 'North', flowMode: 'SURGE', contractTarget: 48 });
    assert.deepEqual(gameplayProjection(state), before);
    tick();
    assert.equal(state.factory.sectors[0].directive, 'EXPORT');
    assert.equal(state.factory.sectors[0].flowMode, 'SURGE');
    assert.equal(state.factory.sectors[0].contractTarget, 48);
    assert.equal(state.factory.sectors[1], south);
    assert.deepEqual(state.resources, before.resources);
    assert.equal(state.commandQueue.length, 0);
    assert.equal(state.ui.lastCommandResult?.type, 'UPDATE_SECTOR_POLICY');
    assert.equal(state.ui.lastCommandResult?.ok, true);
    assert.deepEqual(state.debug.commandTrace.map(entry => [entry.source, entry.sequence, entry.validationResult]), [
        ['ui', 0, 'accepted'], ['ui', 1, 'accepted'],
    ]);
});

test('dispatcher rejects an invalid mixed sector patch without partial gameplay changes', () => {
    const { state, world, tick } = createFixture();
    const before = gameplayProjection(state);
    enqueueWorldCommand(world, 'UPDATE_SECTOR_POLICY', { sectorName: 'North', directive: 'EXPORT', contractTarget: -1 });
    tick();
    assert.deepEqual(gameplayProjection(state), before);
    assert.equal(state.ui.lastCommandResult?.ok, false);
    assert.match(state.ui.lastCommandResult?.reason || '', /positive finite/);
    assert.equal(state.debug.commandTrace[0].validationResult, 'rejected');
});

for (const rewardType of ['AGT', 'GEMS'] as const) {
    test(`queued ${rewardType} goal claims award once and reject duplicate claims in the same tick`, () => {
        const { state, world, tick } = createFixture();
        state.activeGoal = goal(rewardType);
        const before = gameplayProjection(state);
        enqueueWorldCommand(world, 'CLAIM_GOAL');
        enqueueWorldCommand(world, 'CLAIM_GOAL');
        assert.deepEqual(gameplayProjection(state), before);
        tick();
        assert.equal(state.resources.agt, before.resources.agt + (rewardType === 'AGT' ? 25 : 0));
        assert.equal(state.resources.gems, before.resources.gems + (rewardType === 'GEMS' ? 25 : 0));
        assert.equal(state.activeGoal, null);
        assert.equal(state.newsFeed.length, 1);
        assert.equal(state.newsFeed[0].id, 'goal_claim_42_alpha-goal');
        assert.equal(state.pendingEffects.length, 1);
        assert.deepEqual(state.debug.commandTrace.map(entry => entry.validationResult), ['accepted', 'rejected']);
    });
}

for (const completed of [false, null]) {
    test(`goal claims reject ${completed === null ? 'missing' : 'incomplete'} goals without gameplay changes`, () => {
        const { state, world, tick } = createFixture();
        state.activeGoal = completed === null ? null : goal('AGT', false);
        const before = gameplayProjection(state);
        enqueueWorldCommand(world, 'CLAIM_GOAL');
        tick();
        assert.deepEqual(gameplayProjection(state), before);
        assert.equal(state.ui.lastCommandResult?.ok, false);
    });
}

test('identical queued policy inputs produce identical policy state and command audit metadata', () => {
    const run = () => {
        const { state, world, tick } = createFixture();
        enqueueWorldCommand(world, 'UPDATE_SECTOR_POLICY', { sectorName: 'North', directive: 'EXPORT' });
        enqueueWorldCommand(world, 'UPDATE_SECTOR_POLICY', { sectorName: 'North', contractTarget: 48 });
        tick();
        return { sectors: state.factory.sectors, trace: state.debug.commandTrace };
    };
    assert.deepEqual(run(), run());
});
