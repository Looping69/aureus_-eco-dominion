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
    assert.match(combatSystem, /combat\.stance === 'AGGRESSIVE'/);
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

test('combat weapon loadouts are data-driven and applied by the combat system', () => {
    const agentTypes = source('engine/types/agents.ts');
    const weapons = source('engine/data/combatWeapons.ts');
    const combatSystem = source('engine/sim/systems/CombatSystem.ts');

    assert.match(agentTypes, /weaponId\?: string/);
    assert.match(agentTypes, /weaponName\?: string/);
    assert.match(weapons, /COMBAT_WEAPONS/);
    assert.match(weapons, /SHOCK_BATON/);
    assert.match(weapons, /BOLT_PISTOL/);
    assert.match(weapons, /ROLE_WEAPON_LOADOUTS/);
    assert.match(weapons, /SECURITY: 'SHOCK_BATON'/);
    assert.match(combatSystem, /getCombatWeaponForRole/);
    assert.match(combatSystem, /weapon\.attackBonus/);
    assert.match(combatSystem, /weapon\.rangeBonus/);
    assert.match(combatSystem, /weapon\.cooldownMultiplier/);
});

test('aggressive colony agents target outsiders while preserving base agents', () => {
    const combatSystem = source('engine/sim/systems/CombatSystem.ts');

    assert.match(combatSystem, /findNearestAggressionTarget/);
    assert.match(combatSystem, /getBaseAgentIds/);
    assert.match(combatSystem, /agent\.type !== 'ILLEGAL_MINER'/);
    assert.match(combatSystem, /effectiveStats\.faction === 'COLONY' && !this\.getBaseAgentIds\(state\)\.has\(candidate\.id\)/);
    assert.match(combatSystem, /Array\.isArray\(state\.ambientNpcs\)/);
    assert.equal(combatSystem.includes('ensureAgentCombatState(agent).faction !== \'NEUTRAL\''), false);
});

test('agent UI exposes weapon, stance, and combat health readouts', () => {
    const opsDrawer = source('components/OpsDrawer.tsx');
    const debugOverlay = source('components/AgentDebugOverlay.tsx');

    assert.match(opsDrawer, /getWeaponLabel/);
    assert.match(opsDrawer, /getCombatStanceLabel/);
    assert.match(opsDrawer, /getCombatHealthLabel/);
    assert.match(opsDrawer, /Weapon: \$\{getWeaponLabel\(agent\)\}/);
    assert.match(opsDrawer, /HP \{getCombatHealthLabel\(agent\)\}/);

    assert.match(debugOverlay, /getWeaponLabel/);
    assert.match(debugOverlay, /Weapon \{getWeaponLabel\(agent\)\}/);
    assert.match(debugOverlay, /HP \{getCombatHealthLabel\(agent\)\}/);
});
