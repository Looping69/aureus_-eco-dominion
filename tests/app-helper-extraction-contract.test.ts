import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { BuildingType } from '../types.ts';
import { canTileAtPositionOpenModal, canTileOpenModal, findTileInChunks, isLinePlacementType } from '../game/ui/tileSelection.ts';

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

function assertContains(text: string, snippet: string): void {
    assert.equal(text.includes(snippet), true, `Expected source to include: ${snippet}`);
}

test('App delegates tile selection and FPS HUD helpers to small modules', () => {
    const app = source('App.tsx');
    const tileSelection = source('game/ui/tileSelection.ts');

    assert.match(app, /from '\.\/game\/ui\/tileSelection'/);
    assert.match(app, /from '\.\/components\/FPSAbilityHUD'/);
    assertContains(app, 'canTileAtPositionOpenModal(state.chunks, selectedTilePos.x, selectedTilePos.z)');
    assertContains(tileSelection, 'export const findTileInChunks');
    assertContains(tileSelection, 'export const canTileAtPositionOpenModal');
    assert.equal(app.includes('const LINE_PLACEMENT_TYPES'), false);
    assert.equal(app.includes('const FPSAbilityHUD'), false);
    assert.equal(app.includes('const canTileOpenModal'), false);
    assert.equal(app.includes('Object.values(state.chunks)'), false);
});

test('App delegates FPS ability behavior to fpsAbilityLogic helpers', () => {
    const app = source('App.tsx');
    const helper = source('game/ui/fpsAbilityLogic.ts');

    for (const snippet of [
        'FPS_ABILITY_BY_KEY,',
        'canFPSHarvestTarget,',
        'createFPSAimTarget,',
        'describeFPSScanTarget,',
        'enqueueFPSQueuedCommand,',
        'getFPSDigLayer,',
        "from './game/ui/fpsAbilityLogic'",
        'const aim = createFPSAimTarget(hit, stateRef.current?.chunks)',
        'return enqueueFPSQueuedCommand(currentState.commandQueue, type, payload, currentState.tickCount)',
        'showFPSAbilityMessage(describeFPSScanTarget(aim))',
        'if (!canFPSHarvestTarget(aim))',
        'const activeY = getFPSDigLayer(currentState.layeredWorld)',
        'const ability = FPS_ABILITY_BY_KEY[e.code]',
    ]) {
        assertContains(app, snippet);
    }

    for (const staleInlineSnippet of [
        'const abilityByKey: Partial<Record<string, FPSAbility>>',
        'const subject = aim.tile.buildingType',
        'id: `fps_${type.toLowerCase()}_${Date.now()}`',
        'currentState.commandQueue.push(',
        'const findTileAt = useCallback',
        'chunk?.tiles?.find((candidate: any) => candidate.x === x && candidate.z === z)',
        'const x = Math.round(hit.x)',
        'const z = Math.round(hit.z)',
        'const layeredWorld = currentState.layeredWorld',
        'layeredWorld.activeY < layeredWorld.surfaceY',
        "!aim.tile.foliage || aim.tile.foliage === 'NONE'",
    ]) {
        assert.equal(app.includes(staleInlineSnippet), false, `App should not keep inline FPS helper logic: ${staleInlineSnippet}`);
    }

    for (const helperSnippet of [
        'export const FPS_ABILITY_BY_KEY',
        'export function findFPSAimTile',
        'export function createFPSAimTarget',
        'export function describeFPSScanTarget',
        'export function canFPSHarvestTarget',
        'export function getFPSDigLayer',
        'export function createFPSQueuedCommand',
        'export function enqueueFPSQueuedCommand',
    ]) {
        assertContains(helper, helperSnippet);
    }
});

test('DebugMenu exposes a schema-driven command form for active game pack actions', () => {
    const debugMenu = source('components/DebugMenu.tsx');
    const form = source('components/CommandSchemaForm.tsx');

    for (const snippet of [
        "import { CommandSchemaForm } from './CommandSchemaForm';",
        '<CommandSchemaForm dispatch={dispatch} />',
    ]) {
        assertContains(debugMenu, snippet);
    }

    for (const snippet of [
        'GameCommandValidationContext,',
        'function getRuntimeValidationContext(state: RuntimeStateSnapshot): GameCommandValidationContext',
        "'runtime.agents': runtimeAgentIds",
        "'runtime.selectedAgents': selectedAgentIds",
        'validateGameCommandType(gameDefinition, selectedAction.commandType, payload, runtimeValidationContext)',
        'disabled={!validation.ok}',
        'Use Current Selection',
        'Payload ready for dispatch.',
        'Schema Command',
    ]) {
        assertContains(form, snippet);
    }

    assert.equal(form.includes("field === 'buildingType'"), false);
    assert.equal(form.includes("field === 'resource'"), false);
});

test('HomePage presents an animated drop into the live world', () => {
    const home = source('components/HomePage.tsx');

    for (const snippet of [
        'aureus-scan',
        'aureus-drop',
        'aureus-cloud',
        'aureus-agent',
        'descentFrames',
        'setDescentFrame',
        'Drop sequence armed',
        'Drop into a living colony sim where every tile, worker, weapon, and perimeter line is part of the machine.',
        'Drop In',
        'landing vector locked',
        'drop camera active',
        'colonyNodes.map',
        'systemReadouts.map',
        'missionPillars.map',
        'Engine online',
        'Qwen pilot ready',
        "event.code === 'Space'",
    ]) {
        assertContains(home, snippet);
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
        assertContains(tooltip, snippet);
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
    const chunks = {
        '0,0': {
            tiles: [
                { x: 0, z: 0, buildingType: BuildingType.EMPTY },
                { x: 1, z: 0, buildingType: BuildingType.STAFF_QUARTERS },
                { x: 2, z: 0, foliage: 'MINE_HOLE' },
            ],
        },
    };

    assert.equal(canTileOpenModal(null), false);
    assert.equal(canTileOpenModal({ foliage: 'MINE_HOLE' }), true);
    assert.equal(canTileOpenModal({ isUnderConstruction: true }), true);
    assert.equal(canTileOpenModal({ buildingType: BuildingType.EMPTY }), false);
    assert.equal(canTileOpenModal({ buildingType: BuildingType.POND }), false);
    assert.equal(canTileOpenModal({ buildingType: BuildingType.STAFF_QUARTERS }), true);
    assert.deepEqual(findTileInChunks(chunks, 1, 0), chunks['0,0'].tiles[1]);
    assert.equal(canTileAtPositionOpenModal(chunks, 0, 0), false);
    assert.equal(canTileAtPositionOpenModal(chunks, 1, 0), true);
    assert.equal(canTileAtPositionOpenModal(chunks, 2, 0), true);
    assert.equal(canTileAtPositionOpenModal(chunks, 99, 0), false);
});
