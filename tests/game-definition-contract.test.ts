import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { BuildingType } from '../types.ts';
import { AUREUS_GAME_DEFINITION } from '../game-definitions/aureus.ts';
import { ACTIVE_GAME_DEFINITION, ACTIVE_GAME_DEFINITION_SUMMARY, GAME_DEFINITION_REGISTRY } from '../game-definitions/activeGameDefinition.ts';
import { createGameDefinitionRegistry } from '../engine/game-definition/GameDefinitionRegistry.ts';
import { collectGameDefinitionIssues, findActionForCommandType, findMissingPayloadFields, summarizeGameDefinition, validateGameCommandType, validateGameDefinition } from '../engine/game-definition/index.ts';
import { INITIAL_RESOURCES } from '../engine/data/VoxelConstants.ts';
import { RAW_AGENT_ROLE_SCHEMA } from '../engine/data/agentRoles.ts';
import { COMBAT_WEAPONS } from '../engine/data/combatWeapons.ts';

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

test('game definition schema exposes a generic engine contract', () => {
    const types = source('engine/game-definition/types.ts');
    const validator = source('engine/game-definition/validateGameDefinition.ts');
    const commandValidator = source('engine/game-definition/GameCommandValidator.ts');
    const registry = source('engine/game-definition/GameDefinitionRegistry.ts');
    const index = source('engine/game-definition/index.ts');

    assert.match(types, /export interface GameDefinition/);
    assert.match(types, /resources: GameResourceDefinition\[\]/);
    assert.match(types, /entityArchetypes: EntityArchetypeDefinition\[\]/);
    assert.match(types, /actions: GameActionDefinition\[\]/);
    assert.match(types, /systems: GameSystemBindingDefinition\[\]/);
    assert.match(validator, /function requireUniqueIds/);
    assert.match(validator, /export function defineGameDefinition/);
    assert.match(commandValidator, /export function validateGameCommandType/);
    assert.match(commandValidator, /findMissingPayloadFields/);
    assert.match(commandValidator, /findActionForCommandType/);
    assert.match(registry, /export class GameDefinitionRegistry/);
    assert.match(registry, /getActiveSummary/);
    assert.match(registry, /getEntityArchetype/);
    assert.match(index, /export \{[\s\S]*validateGameDefinition/);
    assert.match(index, /export \{[\s\S]*validateGameCommandType/);
});

test('Aureus definition validates and summarizes as a game pack', () => {
    assert.doesNotThrow(() => validateGameDefinition(AUREUS_GAME_DEFINITION));
    assert.deepEqual(collectGameDefinitionIssues(AUREUS_GAME_DEFINITION), []);

    const summary = summarizeGameDefinition(AUREUS_GAME_DEFINITION);
    assert.equal(summary.id, 'aureus.eco-dominion');
    assert.equal(summary.title, 'Aureus: Eco Dominion');
    assert.equal(summary.resourceCount >= 10, true);
    assert.equal(summary.entityCount > Object.values(BuildingType).length, true);
    assert.equal(summary.actionCount >= 30, true);
    assert.equal(summary.systemCount >= 5, true);
    assert.equal(summary.genreTags.includes('colony-sim'), true);
});

test('game definition registry validates active packs and exposes lookups', () => {
    const registry = createGameDefinitionRegistry([AUREUS_GAME_DEFINITION]);

    assert.equal(registry.has('aureus.eco-dominion'), true);
    assert.equal(registry.getActive()?.id, 'aureus.eco-dominion');
    assert.equal(registry.getActiveSummary()?.resourceCount, AUREUS_GAME_DEFINITION.resources.length);
    assert.equal(registry.getResource('agt')?.label, 'AGT');
    assert.equal(registry.getEntityArchetype(`building.${BuildingType.SECURITY_POST}`)?.category, 'building');
    assert.equal(registry.getAction('action.attackTarget')?.commandType, 'COMBAT_ATTACK_TARGET');
    assert.equal(registry.getSystem('system.combat')?.module, 'engine/sim/systems/CombatSystem');
    assert.throws(() => registry.setActive('missing.definition'), /Unknown game definition/);
});

test('game definition command validator maps command types to active pack actions', () => {
    assert.equal(findActionForCommandType(AUREUS_GAME_DEFINITION, 'PLACE_BUILDING')?.id, 'action.placeBuilding');
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'COMBAT_ATTACK_TARGET').ok, true);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'NOT_A_PACK_ACTION').ok, false);

    const commandTypes = new Set(AUREUS_GAME_DEFINITION.actions.map((action) => action.commandType));
    for (const commandType of [
        'PLACE_BUILDING',
        'BUY_BUILDING',
        'BULLDOZE',
        'SPEED_UP',
        'REHABILITATE',
        'UPGRADE_BUILDING',
        'EXPLODE_TILE',
        'DIG_VOXEL',
        'CLEAR_RUBBLE',
        'DESIGNATE_RUBBLE_DUMP',
        'FILL_VOXEL',
        'COMMAND_AGENT',
        'COMMAND_AGENTS',
        'MANUAL_MOVE_AGENT',
        'COMBAT_ATTACK_TARGET',
        'COMBAT_HOLD_POSITION',
        'COMBAT_CLEAR_ORDERS',
        'SELL_RESOURCE',
        'BUY_RESOURCE',
        'SET_AUTO_SELL',
        'MARK_HARVEST',
        'RESEARCH_TECH',
        'ACCEPT_CONTRACT',
        'DELIVER_CONTRACT',
        'ABANDON_CONTRACT',
        'ADVANCE_TUTORIAL',
        'START_DEMO',
        'DISMISS_POPUP',
        'SUBMIT_PERMIT',
        'TALK_TO_NPC',
        'CHOOSE_DIALOGUE',
        'CLOSE_DIALOGUE',
    ]) {
        assert.equal(commandTypes.has(commandType), true, `${commandType} should be declared as a game-pack action`);
    }
});

test('game definition command validator checks required payload fields when payload is supplied', () => {
    const placeBuilding = findActionForCommandType(AUREUS_GAME_DEFINITION, 'PLACE_BUILDING');
    assert.ok(placeBuilding);

    assert.deepEqual(findMissingPayloadFields(placeBuilding, { x: 1, buildingType: 'ROAD' }), ['z']);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'PLACE_BUILDING', { x: 1, z: 2, buildingType: 'ROAD' }).ok, true);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'PLACE_BUILDING', { x: 1, z: Number.NaN, buildingType: 'ROAD' }).ok, false);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'SELL_RESOURCE', { resource: 'wood' }).ok, true);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'ACCEPT_CONTRACT', 'contract-1').ok, true);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'COMBAT_ATTACK_TARGET', { agentIds: ['agent-1'] }).ok, true);
    assert.equal(validateGameCommandType(AUREUS_GAME_DEFINITION, 'MANUAL_MOVE_AGENT', { agentId: 'agent-1', dx: 0.2, dz: -0.1 }).ok, true);
});

test('Aureus is registered as the default active game definition', () => {
    assert.equal(ACTIVE_GAME_DEFINITION.id, 'aureus.eco-dominion');
    assert.equal(ACTIVE_GAME_DEFINITION_SUMMARY?.id, 'aureus.eco-dominion');
    assert.equal(GAME_DEFINITION_REGISTRY.getActive()?.id, 'aureus.eco-dominion');
    assert.equal(GAME_DEFINITION_REGISTRY.getActiveSummary()?.title, 'Aureus: Eco Dominion');
});

test('debug menu surfaces the active game pack summary', () => {
    const debugMenu = source('components/DebugMenu.tsx');

    assert.match(debugMenu, /getActiveGameDefinitionSummary/);
    assert.match(debugMenu, /Active Game Pack/);
    assert.match(debugMenu, /activeGameDefinitionSummary\.resourceCount/);
    assert.match(debugMenu, /activeGameDefinitionSummary\.entityCount/);
    assert.match(debugMenu, /activeGameDefinitionSummary\.actionCount/);
    assert.match(debugMenu, /activeGameDefinitionSummary\.systemCount/);
});

test('Aureus definition maps current resources, buildings, roles, weapons, and actions', () => {
    const resources = new Map(AUREUS_GAME_DEFINITION.resources.map((resource) => [resource.id, resource]));
    assert.equal(resources.get('agt')?.initial, INITIAL_RESOURCES.agt);
    assert.equal(resources.get('minerals')?.capacityResourceId, 'maxCapacity');
    assert.equal(resources.get('eco')?.kind, 'reputation');
    assert.equal(resources.get('trust')?.max, 100);

    const entityIds = new Set(AUREUS_GAME_DEFINITION.entityArchetypes.map((entity) => entity.id));
    assert.equal(entityIds.has(`building.${BuildingType.STAFF_QUARTERS}`), true);
    assert.equal(entityIds.has(`building.${BuildingType.SECURITY_POST}`), true);
    assert.equal(entityIds.has('agent.SECURITY'), true);
    assert.equal(entityIds.has(`item.weapon.${COMBAT_WEAPONS.SHOCK_BATON.id}`), true);

    const security = AUREUS_GAME_DEFINITION.entityArchetypes.find((entity) => entity.id === 'agent.SECURITY');
    assert.equal((security?.components as any).weaponLoadout, 'SHOCK_BATON');
    assert.deepEqual((security?.components as any).workplaces, RAW_AGENT_ROLE_SCHEMA.SECURITY.workplaces);

    const actionIds = new Set(AUREUS_GAME_DEFINITION.actions.map((action) => action.id));
    assert.equal(actionIds.has('action.placeBuilding'), true);
    assert.equal(actionIds.has('action.attackTarget'), true);
    assert.equal(actionIds.has('action.markHarvest'), true);
    assert.equal(actionIds.has('action.buyResource'), true);
    assert.equal(actionIds.has('action.submitPermit'), true);
});

test('Aureus definition is assembled from existing data-driven modules', () => {
    const aureus = source('game-definitions/aureus.ts');

    for (const snippet of [
        "import { BUILDINGS, INITIAL_RESOURCES } from '../engine/data/VoxelConstants';",
        "import { RAW_AGENT_ROLE_SCHEMA } from '../engine/data/agentRoles';",
        "import { COMBAT_WEAPONS, ROLE_WEAPON_LOADOUTS } from '../engine/data/combatWeapons';",
        "import { RESOURCE_GRID_ROLE_SCHEMA } from '../engine/data/resourceGridRoleSchema';",
        'const buildingArchetypes: EntityArchetypeDefinition[] = Object.values(BuildingType).map',
        'const agentArchetypes: EntityArchetypeDefinition[] = Object.values(RAW_AGENT_ROLE_SCHEMA).map',
        'const weaponArchetypes: EntityArchetypeDefinition[] = Object.values(COMBAT_WEAPONS).map',
        "commandType: 'PLACE_BUILDING'",
        "commandType: 'COMBAT_ATTACK_TARGET'",
        "module: 'engine/sim/resourceGrid/ResourceGridSolver'",
    ]) {
        assert.match(aureus, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});
