import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const resourcesPath = path.join(root, 'engine', 'data', 'resources.ts');
const constructionPath = path.join(root, 'engine', 'sim', 'systems', 'ConstructionSystem.ts');
const placementCorePath = path.join(root, 'engine', 'sim', 'construction', 'PlacementCore.ts');
const utilityReadabilityPath = path.join(root, 'engine', 'sim', 'utility', 'UtilityReadability.ts');
const agentSystemPath = path.join(root, 'engine', 'sim', 'systems', 'AgentSystem.ts');
const productionPath = path.join(root, 'engine', 'sim', 'systems', 'ProductionSystem.ts');
const missionPath = path.join(root, 'engine', 'sim', 'systems', 'MissionSystem.ts');
const commandDispatcherPath = path.join(root, 'engine', 'sim', 'systems', 'CommandDispatcher.ts');
const eraPath = path.join(root, 'engine', 'sim', 'systems', 'EraSystem.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
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
  const placementCoreText = source(placementCorePath);
  const agentText = source(agentSystemPath);

  for (const snippet of [
    'Construction progress is worker-driven through AgentSystem.performWork -> progressConstruction.',
    'return progressConstructionCore(x, z, amount, state,',
    'const result = placeBuildingCore(x, z, buildingType, state, isInstant, level);',
    'if (result.ok) updateWaterConnectivity(state.chunks);',
  ]) {
    assertSnippet(constructionText, snippet);
  }

  for (const snippet of [
    'const footprint: Array<{ tile: GridTile; cx: number; cz: number }> = [];',
    'return { ok: false, code: CommandErrorCode.TILE_OCCUPIED',
    'for (const { tile, cx, cz } of footprint)',
    'state.inventory[buildingType] = remaining;',
    'export function progressConstructionCore',
    'completeConstruction(hx, hz, state);',
  ]) {
    assertSnippet(placementCoreText, snippet);
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

test('utility failures have readable local reasons', () => {
  const utilityText = source(utilityReadabilityPath);

  for (const snippet of [
    'export function getPowerReadability',
    "return 'Offline: no power';",
    'export function getWaterReadability',
    "return 'Water-starved';",
    'export function getProducerReadability',
    "return 'Reservoir underpowered: 25% output';",
    'export function getUtilityReadability',
  ]) {
    assertSnippet(utilityText, snippet);
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
