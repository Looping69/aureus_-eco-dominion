import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function source(relativePath: string): string {
    const filePath = path.join(root, relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} is missing`);
    return readFileSync(filePath, 'utf8');
}

test('combat exposes aggression as a persistent stance', () => {
    const agentTypes = source('engine/types/agents.ts');
    const combatSystem = source('engine/sim/systems/CombatSystem.ts');

    assert.match(agentTypes, /CombatOrderStance = 'AUTO' \| 'ATTACK' \| 'HOLD' \| 'AGGRESSIVE'/);
    assert.match(combatSystem, /handleToggleAggression/);
    assert.match(combatSystem, /combat\.stance = shouldEnable \? 'AGGRESSIVE' : 'AUTO'/);
    assert.match(combatSystem, /combat\.stance !== 'AGGRESSIVE' && agent\.type !== 'SECURITY'/);
    assert.match(combatSystem, /prepareAgentForCombatOrder\(agent\)/);
    assert.equal(combatSystem.includes('handleAttackNearestAgentIds'), false);
});

test('combat HUD labels the targetless attack action as aggression', () => {
    const controls = source('components/Controls.tsx');

    assert.match(controls, /Toggle aggression stance/);
    assert.match(controls, /> Aggro/);
    assert.equal(controls.includes('Attack nearest hostile'), false);
});

test('toolbar combat commands use full selected agent groups when available', () => {
    const bridge = source('game/world/dispatchBridge.ts');
    const world = source('game/AureusWorld.ts');

    assert.match(bridge, /getSelectedAgentIds\?: \(\) => string\[\]/);
    assert.match(bridge, /deps\.getSelectedAgentIds\?\.\(\) \?\? \[\]/);
    assert.match(world, /getSelectedAgentIds: \(\) => this\.stateManager\.getState\(\)\.selectedAgentIds \?\? \[\]/);
});
