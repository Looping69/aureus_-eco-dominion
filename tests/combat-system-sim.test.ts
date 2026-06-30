import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatSystem, areHostile, chebyshevDistance, ensureAgentCombatState } from '../engine/sim/systems/CombatSystem.ts';
import type { Agent, GameState } from '../types.ts';

function agent(id: string, name: string, type: Agent['type'], x: number, z: number): Agent {
    return {
        id,
        name,
        type,
        x,
        z,
        targetX: null,
        targetZ: null,
        path: null,
        state: 'IDLE',
        energy: 100,
        hunger: 100,
        mood: 75,
        skills: { mining: 1, construction: 1, plants: 1, intelligence: 1 },
        currentJobId: null,
        inventory: { type: null, amount: 0, capacity: 25 },
        layer: 0,
    };
}

function combatState(agents: Agent[], ambientNpcs: Agent[] = []): GameState {
    return {
        agents,
        ambientNpcs,
        newsFeed: [],
        pendingEffects: [],
        tickCount: 1,
    } as unknown as GameState;
}

function tick(system: CombatSystem, state: GameState, count: number): void {
    for (let i = 0; i < count; i += 1) {
        state.tickCount += 1;
        system.tick({ fixedDt: 1, stepIndex: 0, time: i + 1, getNextId: (prefix) => `${prefix}_${i}` } as any, state);
    }
}

test('combat helpers classify hostile factions and tile-range distance', () => {
    assert.equal(areHostile('COLONY', 'HOSTILE'), true);
    assert.equal(areHostile('COLONY', 'COLONY'), false);
    assert.equal(areHostile('NEUTRAL', 'HOSTILE'), false);
    assert.equal(chebyshevDistance({ x: 0, z: 0 }, { x: 2, z: 5 }), 5);
});

test('security agents engage nearby illegal miners and report defeat', () => {
    const guard = agent('guard-1', 'Kaya', 'SECURITY', 0, 0);
    const intruder = agent('raider-1', 'Claim Jumper', 'ILLEGAL_MINER', 1, 0);
    const state = combatState([guard], [intruder]);
    const system = new CombatSystem();

    tick(system, state, 7);

    assert.equal(ensureAgentCombatState(guard).targetAgentId, 'raider-1');
    assert.equal(ensureAgentCombatState(intruder).defeated, true);
    assert.equal(intruder.state, 'OFF_DUTY');
    assert.equal(intruder.currentJobId, null);
    assert.match(intruder.statusReason || '', /Neutralized/);
    assert.equal(state.newsFeed.some(item => item.headline.includes('neutralized Claim Jumper')), true);
    assert.equal(state.pendingEffects.some(effect => effect.type === 'AUDIO'), true);
});

test('neutral citizens are not pulled into combat', () => {
    const guard = agent('guard-1', 'Kaya', 'SECURITY', 0, 0);
    const citizen = agent('citizen-1', 'Visitor', 'CITIZEN', 1, 0);
    const state = combatState([guard, citizen]);
    const system = new CombatSystem();

    tick(system, state, 3);

    assert.equal(ensureAgentCombatState(guard).targetAgentId, null);
    assert.equal(ensureAgentCombatState(citizen).currentHealth, ensureAgentCombatState(citizen).maxHealth);
    assert.equal(state.newsFeed.length, 0);
});

test('combat ignores agents below the surface for now', () => {
    const guard = agent('guard-1', 'Kaya', 'SECURITY', 0, 0);
    const intruder = agent('raider-1', 'Tunnel Raider', 'ILLEGAL_MINER', 1, 0);
    intruder.layer = 1;
    const state = combatState([guard], [intruder]);
    const system = new CombatSystem();

    tick(system, state, 3);

    assert.equal(ensureAgentCombatState(guard).targetAgentId, null);
    assert.equal(ensureAgentCombatState(intruder).currentHealth, ensureAgentCombatState(intruder).maxHealth);
});
