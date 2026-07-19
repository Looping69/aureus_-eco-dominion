import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { BuildingType } from '../types.ts';
import { canTileOpenModal, isLinePlacementType } from '../game/ui/tileSelection.ts';

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

test('App delegates tile selection and FPS HUD helpers to small modules', () => {
    const app = source('App.tsx');

    assert.match(app, /from '\.\/game\/ui\/tileSelection'/);
    assert.match(app, /from '\.\/components\/FPSAbilityHUD'/);
    assert.equal(app.includes('const LINE_PLACEMENT_TYPES'), false);
    assert.equal(app.includes('const FPSAbilityHUD'), false);
    assert.equal(app.includes('const canTileOpenModal'), false);
});

test('DebugMenu exposes a schema-driven command form for active game pack actions', () => {
    const debugMenu = source('components/DebugMenu.tsx');
    const form = source('components/CommandSchemaForm.tsx');

    for (const snippet of [
        "import { CommandSchemaForm } from './CommandSchemaForm';",
        '<CommandSchemaForm dispatch={dispatch} />',
    ]) {
        assert.match(debugMenu, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    for (const snippet of [
        'GameActionDefinition,',
        'GameActionPayloadFieldDefinition,',
        'GameActionPayloadOptionSource,',
        'GameCommandValidationContext,',
        'GameDefinition,',
        "import { validateGameCommandType } from '../engine/game-definition';",
        "import { getActiveGameDefinition } from '../game-definitions/activeGameDefinition';",
        'function getRuntimeStateSnapshot(): RuntimeStateSnapshot',
        'function getSchemaActions(definition: GameDefinition): GameActionDefinition[]',
        'action.payloadSchema && action.payloadFields.length > 0',
        'function getRuntimeAgentOptions(state: RuntimeStateSnapshot)',
        'function getRuntimeSelectedAgentIds(state: RuntimeStateSnapshot): string[]',
        'function getRuntimeValidationContext(state: RuntimeStateSnapshot): GameCommandValidationContext',
        "'runtime.agents': runtimeAgentIds",
        "'runtime.selectedAgents': selectedAgentIds",
        'function getDefaultFromOptionSource(',
        'source: GameActionPayloadOptionSource | undefined',
        "case 'runtime.agents':",
        "case 'runtime.selectedAgents':",
        "case 'runtime.selectedTile':",
        "case 'runtime.activeLayer':",
        "case 'resources.tradeable':",
        "case 'entities.buildings':",
        "case 'techs':",
        'function getSmartFieldDefault(',
        'function getDefaultFieldValue(schema: GameActionPayloadFieldDefinition): string',
        "case 'number':",
        "case 'boolean':",
        "case 'string[]':",
        "case 'number[]':",
        "case 'object':",
        'function parseFieldValue(schema: GameActionPayloadFieldDefinition, rawValue: string): unknown',
        'function buildPayload(action: GameActionDefinition, values: FormValues): Record<string, unknown>',
        'function getBuildingTypeOptions(definition: GameDefinition)',
        'function getChoiceOptions(',
        'schema.options?.length',
        'switch (schema.optionSource)',
        'const runtimeValidationContext = getRuntimeValidationContext(runtimeState);',
        'validateGameCommandType(gameDefinition, selectedAction.commandType, payload, runtimeValidationContext)',
        'disabled={!validation.ok}',
        'Use Current Selection',
        'Payload ready for dispatch.',
        'dispatch({ type: selectedAction.commandType, payload });',
        'Schema Command',
        'Dispatch {selectedAction.commandType}',
    ]) {
        assert.match(form, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    assert.equal(form.includes("field === 'buildingType'"), false);
    assert.equal(form.includes("field === 'resource'"), false);
});

test('HomePage presents an animated live command scene', () => {
    const home = source('components/HomePage.tsx');

    for (const snippet of [
        'aureus-scan',
        'aureus-drift',
        'aureus-runner',
        'colonyNodes.map',
        'systemReadouts.map',
        'missionPillars.map',
        'Build the colony. Arm the perimeter. Bend the wild planet without breaking it.',
        'Engine online',
        'Qwen pilot ready',
        "event.code === 'Space'",
    ]) {
        assert.match(home, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    assert.equal(home.includes('tracking-tighter'), false);
});

test('useAureusEngine activates command validation from the active game definition registry', () => {
    const hook = source('game/useAureusEngine.ts');

    assert.match(hook, /from '\.\.\/game-definitions\/activeGameDefinition'/);
    assert.match(hook, /GAME_DEFINITION_REGISTRY/);
    assert.match(hook, /setActiveGameDefinitionProvider\?\.\(GAME_DEFINITION_REGISTRY\)/);
});

test('App wires the world hover tooltip to tile hover and cursor position', () => {
    const app = source('App.tsx');

    assert.match(app, /from '\.\/components\/WorldHoverTooltip'/);
    assert.match(app, /const \[hoverTilePos, setHoverTilePos\]/);
    assert.match(app, /const \[hoverCursor, setHoverCursor\]/);
    assert.match(app, /setHoverTilePos\(x === null \|\| z === null \? null : \{ x, z \}\)/);
    assert.match(app, /window\.addEventListener\('pointermove', handlePointerMove\)/);
    assert.match(app, /<WorldHoverTooltip state=\{state\} tilePos=\{hoverTilePos\} cursor=\{hoverCursor\} hidden=\{hoverTooltipHidden\} \/>/);
    assert.match(app, /state\?\.isFPS \|\| linePlacementStart \|\| sidebarOpen !== 'NONE'/);
});

test('WorldHoverTooltip covers inspectable world entities and skips bare grass', () => {
    const tooltip = source('components/WorldHoverTooltip.tsx');

    for (const snippet of [
        "import { BuildingType, GameState, GridTile, Agent } from '../types';",
        "import { BUILDINGS } from '../engine/data/VoxelConstants';",
        'function findAgentsAt(state: GameState, pos: HoverTile): Agent[] {',
        'const allAgents = [...(state.agents || []), ...(state.ambientNpcs || [])];',
        'return getAgentDetail(agent, Boolean((state.ambientNpcs || []).some((npc) => npc.id === agent.id)));',
        'if (tile.biome === \'GRASS\') return null;',
        "kind: tile.foliage?.startsWith('TREE') ? 'Tree'",
        "tile.foliage?.startsWith('ROCK') ? 'Rock'",
        "tile.foliage?.includes('CACTUS') ? 'Cactus'",
        "rows.push(['Weapon', combat.weaponName || 'Unarmed']);",
        "rows.push(['Combat', `${label(combat.stance || 'AUTO')} / ${Math.ceil(combat.currentHealth)}/${combat.maxHealth} HP`]);",
        'const def = BUILDINGS[tile.buildingType];',
        "['Power', label(tile.powerStatus)]",
        "['Water', label(tile.waterStatus)]",
    ]) {
        assert.match(tooltip, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});

test('BuildingInspectorModal delegates utility failure labels to UtilityReadability', () => {
    const modals = source('components/Modals.tsx');

    assert.match(modals, /getUtilityReadability/);
    assert.match(modals, /from '\.\.\/engine\/sim\/utility\/UtilityReadability'/);
    assert.equal(modals.includes("if (needsPower) {\n        if (tile.powerStatus !== 'CONNECTED')"), false);
    assert.equal(modals.includes("if (needsWater) {\n        if (tile.waterStatus !== 'CONNECTED')"), false);
});

test('BuildingInspectorModal shows specific water diagnostic copy', () => {
    const modals = source('components/Modals.tsx');

    assert.match(modals, /reason === 'No pipe connection'/);
    assert.match(modals, /reason === 'Water shortage: add supply'/);
    assert.match(modals, /no pipe connection/);
    assert.match(modals, /total water demand is higher than supply/);
    assert.equal(modals.includes('Water-starved'), false);
    assert.equal(modals.includes('water-starved'), false);
});

test('BuildingStatusLabelLayer delegates water labels to WaterDiagnostics', () => {
    const labels = source('game/render/systems/BuildingStatusLabelLayer.ts');

    assert.match(labels, /getWaterDiagnostic/);
    assert.match(labels, /from '\.\.\/\.\.\/\.\.\/engine\/sim\/utility\/WaterDiagnostics'/);
    assert.match(labels, /waterDiagnostic\.blocksProduction/);
    assert.equal(labels.includes("tile.waterStatus === 'DISCONNECTED'"), false);
});

test('tile selection helper identifies line placement infrastructure', () => {
    assert.equal(isLinePlacementType(BuildingType.ROAD), true);
    assert.equal(isLinePlacementType(BuildingType.PIPE), true);
    assert.equal(isLinePlacementType(BuildingType.POWER_LINE), true);
    assert.equal(isLinePlacementType(BuildingType.FENCE), true);
    assert.equal(isLinePlacementType(BuildingType.STAFF_QUARTERS), false);
});

test('tile selection helper opens modals only for inspectable tiles', () => {
    assert.equal(canTileOpenModal(null), false);
    assert.equal(canTileOpenModal({ foliage: 'MINE_HOLE' }), true);
    assert.equal(canTileOpenModal({ isUnderConstruction: true }), true);
    assert.equal(canTileOpenModal({ buildingType: BuildingType.EMPTY }), false);
    assert.equal(canTileOpenModal({ buildingType: BuildingType.POND }), false);
    assert.equal(canTileOpenModal({ buildingType: BuildingType.STAFF_QUARTERS }), true);
});
