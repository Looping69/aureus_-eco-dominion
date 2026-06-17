import test from 'node:test';
import assert from 'node:assert/strict';

import { StateManager } from '../engine/state/StateManager.ts';
import { CommandDispatcher } from '../engine/sim/systems/CommandDispatcher.ts';
import type { Contract, GameCommand } from '../types.ts';

function tickDispatcher(stateManager: StateManager, dispatcher: CommandDispatcher, time = 1): void {
    const state = stateManager.getMutableState();
    dispatcher.tick({
        fixedDt: 1,
        stepIndex: 0,
        time,
        getNextId: (prefix: string) => stateManager.getNextId(prefix),
    }, state);
}

function queue(stateManager: StateManager, type: GameCommand['type'], payload: any): void {
    stateManager.getMutableState().commandQueue.push({
        id: `test_${String(type).toLowerCase()}`,
        type,
        payload,
        issuedAtTick: 0,
    } as GameCommand);
}

test('contract commands accept, deliver, reward, and report through command results', () => {
    const stateManager = new StateManager({
        resources: {
            agt: 1000,
            minerals: 100,
            gems: 0,
            wood: 0,
            stone: 0,
            eco: 75,
            trust: 10,
            income: 0,
            maintenance: 0,
            maxCapacity: 1000,
        },
        contracts: [{
            id: 'contract-1',
            description: 'Deliver minerals for the district works crew.',
            resource: 'MINERALS',
            amount: 80,
            reward: 2000,
            penalty: 400,
            timeLeft: 180,
            status: 'AVAILABLE',
            deliveredAmount: 0,
            trustReward: 2,
            trustPenalty: 3,
        } as Contract],
    });
    const dispatcher = new CommandDispatcher();

    queue(stateManager, 'ACCEPT_CONTRACT', { contractId: 'contract-1' });
    tickDispatcher(stateManager, dispatcher, 1);

    let state = stateManager.getMutableState();
    assert.equal(state.contracts[0].status, 'ACCEPTED');
    assert.equal(state.contracts[0].timeLeft, 300);
    assert.equal(state.ui.lastCommandResult?.ok, true);
    assert.equal(state.ui.lastCommandResult?.type, 'ACCEPT_CONTRACT');

    queue(stateManager, 'DELIVER_CONTRACT', { contractId: 'contract-1' });
    tickDispatcher(stateManager, dispatcher, 2);

    state = stateManager.getMutableState();
    assert.equal(state.contracts[0].status, 'COMPLETED');
    assert.equal(state.contracts[0].deliveredAmount, 80);
    assert.equal(state.resources.minerals, 20);
    assert.equal(state.resources.agt, 3000);
    assert.equal(state.resources.trust, 12);
    assert.equal(state.ui.lastCommandResult?.ok, true);
    assert.equal(state.ui.lastCommandResult?.type, 'DELIVER_CONTRACT');
});

test('contract delivery rejects missing stock without mutating resources', () => {
    const stateManager = new StateManager({
        resources: {
            agt: 1000,
            minerals: 10,
            gems: 0,
            wood: 0,
            stone: 0,
            eco: 75,
            trust: 10,
            income: 0,
            maintenance: 0,
            maxCapacity: 1000,
        },
        contracts: [{
            id: 'contract-2',
            description: 'Deliver minerals for the district works crew.',
            resource: 'MINERALS',
            amount: 80,
            reward: 2000,
            penalty: 400,
            timeLeft: 300,
            status: 'ACCEPTED',
            deliveredAmount: 0,
            trustReward: 2,
            trustPenalty: 3,
        } as Contract],
    });
    const dispatcher = new CommandDispatcher();

    queue(stateManager, 'DELIVER_CONTRACT', { contractId: 'contract-2' });
    tickDispatcher(stateManager, dispatcher, 1);

    const state = stateManager.getMutableState();
    assert.equal(state.contracts[0].status, 'ACCEPTED');
    assert.equal(state.resources.minerals, 10);
    assert.equal(state.resources.agt, 1000);
    assert.equal(state.resources.trust, 10);
    assert.equal(state.ui.lastCommandResult?.ok, false);
    assert.equal(state.ui.lastCommandResult?.type, 'DELIVER_CONTRACT');
    assert.match(state.ui.lastCommandResult?.reason || '', /Need 70 more Minerals/);
});
