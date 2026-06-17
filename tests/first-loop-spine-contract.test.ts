import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const resourcesPath = path.join(root, 'engine', 'data', 'resources.ts');
const constructionPath = path.join(root, 'engine', 'sim', 'systems', 'ConstructionSystem.ts');
const agentSystemPath = path.join(root, 'engine', 'sim', 'systems', 'AgentSystem.ts');
const productionPath = path.join(root, 'engine', 'sim', 'systems', 'ProductionSystem.ts');
const missionPath = path.join(root, 'engine', 'sim', 'systems', 'MissionSystem.ts');
const commandDispatcherPath = path.join(root, 'engine', 'sim', 'systems', 'CommandDispatcher.ts');
const eraPath = path.join(root, 'engine', 'sim', 'systems', 'EraSystem.ts');
const worldPath = path.join(root, 'game', 'AureusWorld.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

function assertCount(text: string, snippet: string, expected: number) {
  const pattern = new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  assert.equal([...text.matchAll(pattern)].length, expected, `${snippet} should appear ${expected} time(s)`);
}

test('new games start with enough resources for the early economy spine', () => {
  const text = source(resourcesPath);

  for (const snippet of [
    'agt: 100000,',
    'minerals: 2500,',
    'wood: 10000,',
    'stone: 12000,',
    'maxCapacity: 25000',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('building placement is atomic and construction is worker-driven', () => {
  const constructionText = source(constructionPath);
  const agentText = source(agentSystemPath);

  for (const snippet of [
    'Construction progress is worker-driven through AgentSystem.performWork -> progressConstruction.',
    'Validate the complete footprint before mutating any tile.',
    'const footprint: Array<{ tile: GridTile; cx: number; cz: number }> = [];',
    'for (const { tile, cx, cz } of footprint)',
    'state.inventory[buildingType] = remaining;',
    'public progressConstruction',
    'this.completeConstruction(hx, hz, state);',
  ]) {
    assertSnippet(constructionText, snippet);
  }

  for (const snippet of [
    "if (jobId.startsWith('build_')) return 'Building assigned structure.';",
    "if (jobId.startsWith('build_')) return 'Walking to build site.';",
    'this.constructionSystem.progressConstruction',
  ]) {
    assertSnippet(agentText, snippet);
  }
});

test('production and era progression count completed structure heads, not footprint tiles', () => {
  const productionText = source(productionPath);
  const eraText = source(eraPath);

  for (const snippet of [
    'tile.structureHeadX !== undefined && (tile.x !== tile.structureHeadX || tile.z !== tile.structureHeadZ)',
    'tile.powerStatus !== \'CONNECTED\'',
    'tile.waterStatus !== \'CONNECTED\'',
    'effectiveFactoryEfficiency',
    'mineralProd +=',
  ]) {
    assertSnippet(productionText, snippet);
  }

  for (const snippet of [
    'private getCompletedBuildingTypes',
    'private countCompletedBuildings',
    '!t.isUnderConstruction && this.isStructureHead(t)',
    'private isStructureHead(tile: GridTile): boolean',
  ]) {
    assertSnippet(eraText, snippet);
  }
});

test('contracts are an intentional cashflow lifecycle, not passive punishment', () => {
  const missionText = source(missionPath);
  const commandText = source(commandDispatcherPath);

  for (const snippet of [
    'FIRST_MINERAL_CONTRACT_AMOUNT = 80',
    'FIRST_MINERAL_CONTRACT_REWARD = 2000',
    "contract.status = stock >= contract.amount ? 'READY_TO_DELIVER' : 'ACCEPTED';",
    "contract.status === 'AVAILABLE'",
    "contract.status = 'FAILED';",
  ]) {
    assertSnippet(missionText, snippet);
  }

  for (const snippet of [
    "commandType === 'ACCEPT_CONTRACT'",
    "commandType === 'DELIVER_CONTRACT'",
    "commandType === 'ABANDON_CONTRACT'",
    'state.resources[resourceKey] -= contract.amount;',
    'state.resources.agt += contract.reward;',
    'state.resources.trust = Math.min(100, state.resources.trust + trustReward);',
  ]) {
    assertSnippet(commandText, snippet);
  }
});

test('the main world does not accidentally construct duplicate manager bridges', () => {
  const worldText = source(worldPath);
  assertCount(worldText, 'this.researchManager = new ResearchManager(this.stateManager);', 1);
});
