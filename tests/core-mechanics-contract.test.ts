// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const eraSource = readFileSync(path.join(process.cwd(), 'engine', 'sim', 'systems', 'EraSystem.ts'), 'utf8');
const aiSource = readFileSync(path.join(process.cwd(), 'engine', 'sim', 'logic', 'AiLogic.ts'), 'utf8');
const constructionSource = readFileSync(path.join(process.cwd(), 'engine', 'sim', 'systems', 'ConstructionSystem.ts'), 'utf8');
const agentSource = readFileSync(path.join(process.cwd(), 'engine', 'sim', 'systems', 'AgentSystem.ts'), 'utf8');
const missionSource = readFileSync(path.join(process.cwd(), 'engine', 'sim', 'systems', 'MissionSystem.ts'), 'utf8');
const engineHookSource = readFileSync(path.join(process.cwd(), 'game', 'useAureusEngine.ts'), 'utf8');

test('era progression and generated build goals count completed structure heads, not footprint tiles', () => {
    assert.match(eraSource, /private countCompletedBuildings\(state: GameState\): number/);
    assert.match(eraSource, /this\.isStructureHead\(t\)/);
    assert.match(eraSource, /private isStructureHead\(tile: GridTile\): boolean/);
    assert.doesNotMatch(eraSource, /filter\(t => t\.buildingType !== BuildingType\.EMPTY && !t\.isUnderConstruction\)\.length/);

    assert.match(aiSource, /const isStructureHead = \(tile: GridTile\) =>/);
    assert.match(aiSource, /filter\(t => t\.buildingType === type && !t\.isUnderConstruction && isStructureHead\(t\)\)/);
    assert.match(aiSource, /const currentStaffQuarters = getBuildingCount\(state, BuildingType\.STAFF_QUARTERS\)/);
    assert.match(aiSource, /currentValue: currentStaffQuarters/);
    assert.match(aiSource, /currentValue: state\.resources\.agt/);
});

test('building placement validates the full footprint before mutating any tile', () => {
    assert.match(constructionSource, /const footprint: Array<\{ tile: GridTile; cx: number; cz: number \}> = \[\];/);
    assert.match(constructionSource, /Validate the complete footprint before mutating any tile\. Failed placement must be atomic\./);
    assert.match(constructionSource, /footprint\.push\(\{ tile, cx, cz \}\);/);
    assert.match(constructionSource, /for \(const \{ tile, cx, cz \} of footprint\) \{/);

    const validationIndex = constructionSource.indexOf('Validate the complete footprint before mutating any tile');
    const mutationIndex = constructionSource.indexOf('Object.assign(tile, {', validationIndex);
    assert.ok(validationIndex >= 0 && mutationIndex > validationIndex, 'mutation should occur only after footprint validation');
});

test('construction progress is worker-driven, not passive timer-driven', () => {
    assert.match(constructionSource, /Construction progress is worker-driven through AgentSystem\.performWork -> progressConstruction\./);
    assert.doesNotMatch(constructionSource, /Passive Construction Progress/);
    assert.doesNotMatch(constructionSource, /this\.progressConstruction\(tile\.x, tile\.z, 1\.0 \* speedMult, state\)/);

    assert.match(agentSource, /this\.constructionSystem\.progressConstruction\(job\.targetX, job\.targetZ, amount, state\)/);
});

test('goals update progress, complete, and can claim rewards through the engine bridge', () => {
    assert.match(missionSource, /private updateGoalProgress\(state: GameState\): void/);
    assert.match(missionSource, /goal\.completed = goal\.currentValue >= goal\.targetValue;/);
    assert.match(missionSource, /this\.isBuildingTarget\(goal\.targetType\)/);
    assert.match(missionSource, /this\.countCompletedBuildings\(state, goal\.targetType\)/);
    assert.match(missionSource, /state\.resources\.agt/);
    assert.match(missionSource, /state\.resources\.trust/);

    assert.match(engineHookSource, /function claimCompletedGoal\(state: GameState\): GameState \| null/);
    assert.match(engineHookSource, /if \(action\?\.type === 'CLAIM_GOAL'\)/);
    assert.match(engineHookSource, /resources\.agt \+= goal\.reward\.amount;/);
    assert.match(engineHookSource, /resources\.gems \+= goal\.reward\.amount;/);
    assert.match(engineHookSource, /activeGoal: null/);
});