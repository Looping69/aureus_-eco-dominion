import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { BuildingType } from '../types.ts';
import {
    AGENT_ROLE_DEFS,
    RAW_AGENT_ROLE_SCHEMA,
    getAgentRoleDef,
    getAgentRoleForWorkplace,
    getProfessionalWorkplaceTypes,
} from '../engine/data/agentRoles.ts';
import { getDefaultCombatProfile } from '../engine/sim/systems/CombatSystem.ts';

const root = process.cwd();

function source(relativePath: string): string {
    const filePath = path.join(root, relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} is missing`);
    return readFileSync(filePath, 'utf8');
}

test('agent role schema exposes every current role as raw data', () => {
    for (const role of [
        'WORKER',
        'MINER',
        'BOTANIST',
        'ENGINEER',
        'SECURITY',
        'ILLEGAL_MINER',
        'LUMBERJACK',
        'QUARRYMAN',
        'UNEMPLOYED',
        'CITIZEN',
    ] as const) {
        assert.equal(RAW_AGENT_ROLE_SCHEMA[role].id, role);
        assert.equal(AGENT_ROLE_DEFS[role].id, role);
        assert.equal(typeof AGENT_ROLE_DEFS[role].label, 'string');
        assert.equal(typeof AGENT_ROLE_DEFS[role].combat.attack, 'number');
    }
});

test('agent role schema owns workplace to role mapping', () => {
    assert.equal(getAgentRoleForWorkplace(BuildingType.SAWMILL), 'LUMBERJACK');
    assert.equal(getAgentRoleForWorkplace(BuildingType.STONE_QUARRY), 'QUARRYMAN');
    assert.equal(getAgentRoleForWorkplace(BuildingType.WASH_PLANT), 'MINER');
    assert.equal(getAgentRoleForWorkplace(BuildingType.MINING_HEADFRAME), 'MINER');
    assert.equal(getAgentRoleForWorkplace(BuildingType.ORE_FOUNDRY), 'MINER');
    assert.equal(getAgentRoleForWorkplace(BuildingType.WORKSHOP), 'ENGINEER');
    assert.equal(getAgentRoleForWorkplace(BuildingType.SECURITY_POST), 'SECURITY');

    const workplaces = getProfessionalWorkplaceTypes();
    assert.equal(workplaces.includes(BuildingType.SAWMILL), true);
    assert.equal(workplaces.includes(BuildingType.WORKSHOP), true);
    assert.equal(workplaces.includes(BuildingType.STAFF_QUARTERS), false);
});

test('combat defaults are read from agent role schema', () => {
    const securityRole = getAgentRoleDef('SECURITY');
    const securityCombat = getDefaultCombatProfile('SECURITY');
    assert.equal(securityCombat.faction, securityRole.combat.faction);
    assert.equal(securityCombat.attack, securityRole.combat.attack);
    assert.equal(securityCombat.maxHealth, securityRole.combat.maxHealth);

    const citizenCombat = getDefaultCombatProfile('CITIZEN');
    assert.equal(citizenCombat.faction, 'NEUTRAL');
});

test('employment and combat systems delegate role metadata to the schema', () => {
    const employment = source('engine/sim/systems/EmploymentSystem.ts');
    const combat = source('engine/sim/systems/CombatSystem.ts');

    assert.match(employment, /getAgentRoleForWorkplace/);
    assert.match(employment, /getProfessionalWorkplaceTypes/);
    assert.equal(employment.includes('case BuildingType.SAWMILL'), false);
    assert.equal(employment.includes('case BuildingType.WORKSHOP'), false);
    assert.equal(employment.includes('role = \'MINER\''), false);

    assert.match(combat, /getAgentRoleDef/);
    assert.equal(combat.includes('ROLE_COMBAT_PROFILES'), false);
    assert.equal(combat.includes('DEFAULT_COLONIST_PROFILE'), false);
    assert.equal(combat.includes('DEFAULT_NEUTRAL_PROFILE'), false);
});
