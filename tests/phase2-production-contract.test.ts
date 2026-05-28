import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const gameTypesPath = path.join(process.cwd(), 'engine', 'types', 'game.ts');
const productionPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'ProductionSystem.ts');
const logisticsPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'LogisticsSystem.ts');
const hudPath = path.join(process.cwd(), 'components', 'HUD.tsx');
const persistencePath = path.join(process.cwd(), 'engine', 'sim', 'PersistenceManager.ts');
const economyPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'EconomySystem.ts');
const supplySidebarPath = path.join(process.cwd(), 'components', 'SupplySidebar.tsx');
const industrialCostsPath = path.join(process.cwd(), 'engine', 'data', 'industrialCosts.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Phase 2 state types expose industrial stocks and keep industry backward-compatible', () => {
  assert.equal(existsSync(gameTypesPath), true, 'engine/types/game.ts is missing');

  const source = readFileSync(gameTypesPath, 'utf8');

  for (const snippet of [
    "'REFINED_MATERIALS'",
    "'ALLOYS'",
    "'MACHINE_PARTS'",
    'export interface IndustryState',
    'refinedMaterials: number;',
    'alloys: number;',
    'machineParts: number;',
    'industry?: IndustryState;',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Phase 2 production turns foundry throughput into refined materials and alloys, then workshop throughput into parts', () => {
  assert.equal(existsSync(productionPath), true, 'ProductionSystem.ts is missing');

  const source = readFileSync(productionPath, 'utf8');

  for (const snippet of [
    'tile.buildingType === BuildingType.ORE_FOUNDRY',
    "this.pushOutput(node, 'REFINED_MATERIALS'",
    "this.pushOutput(node, 'ALLOYS'",
    'tile.buildingType === BuildingType.WORKSHOP',
    "this.pullInput(node, 'REFINED_MATERIALS'",
    "this.pullInput(node, 'ALLOYS'",
    "this.pushOutput(node, 'MACHINE_PARTS'",
    'const industry = this.getIndustryState(state);',
    'industry.automatedChains = automatedChains;',
    'industry.gridLoad = state.powerGrid?.totalConsumed || 0;',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Phase 2 logistics routes workshop inputs and deposits industrial stock into the shared ledger', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
    'BuildingType.WORKSHOP',
    "resource === 'REFINED_MATERIALS' || resource === 'WOOD' || resource === 'ALLOYS'",
    "'REFINED_MATERIALS', 'ALLOYS', 'MACHINE_PARTS'",
    "if (resource === 'REFINED_MATERIALS') state.industry.refinedMaterials += amount;",
    "if (resource === 'ALLOYS') state.industry.alloys += amount;",
    "if (resource === 'MACHINE_PARTS') state.industry.machineParts += amount;",
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('HUD surfaces Phase 2 industrial stocks for live monitoring even before save migration runs', () => {
  assert.equal(existsSync(hudPath), true, 'HUD.tsx is missing');

  const source = readFileSync(hudPath, 'utf8');

  for (const snippet of [
    'state.industry?.refinedMaterials || 0',
    'label="Refined"',
    'state.industry?.alloys || 0',
    'label="Alloys"',
    'state.industry?.machineParts || 0',
    'label="Parts"',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Persistence backfills industrial stock when older saves are loaded or revived', () => {
  assert.equal(existsSync(persistencePath), true, 'PersistenceManager.ts is missing');

  const source = readFileSync(persistencePath, 'utf8');

  for (const snippet of [
    'private ensureIndustryState(state: GameState): void {',
    'if (!state.industry) {',
    'state.industry.refinedMaterials ??= 0;',
    'state.industry.alloys ??= 0;',
    'state.industry.machineParts ??= 0;',
    'this.ensureIndustryState(state);',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Advanced buildings spend industrial stock instead of treating machine parts as passive inventory', () => {
  assert.equal(existsSync(industrialCostsPath), true, 'industrialCosts.ts is missing');
  assert.equal(existsSync(economyPath), true, 'EconomySystem.ts is missing');
  assert.equal(existsSync(supplySidebarPath), true, 'SupplySidebar.tsx is missing');

  const costsSource = readFileSync(industrialCostsPath, 'utf8');
  const economySource = readFileSync(economyPath, 'utf8');
  const sidebarSource = readFileSync(supplySidebarPath, 'utf8');

  for (const snippet of [
    'BuildingType.DISTRIBUTION_HUB',
    'BuildingType.TRAIN_STATION',
    'BuildingType.GEOTHERMAL_PLANT',
    'BuildingType.GREEN_TECH_LAB',
    'BuildingType.SPACEPORT',
    'machineParts',
    'alloys',
    'refinedMaterials',
  ]) {
    assert.match(costsSource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'getIndustrialBuildingCosts(buildingType)',
    'getMissingIndustrialCosts(state.industry, industrialCosts)',
    'state.industry![key] -= amount as number;',
  ]) {
    assert.match(economySource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'const industrialCosts = getIndustrialBuildingCosts(selectedItem);',
    'const missingIndustrial = state.cheatsEnabled ? [] : getMissingIndustrialCosts(state.industry, industrialCosts);',
    'formatIndustrialCosts(industrialCosts)',
    'Needs {missingIndustrial[0]}',
  ]) {
    assert.match(sidebarSource, new RegExp(escapeRegExp(snippet)));
  }
});
