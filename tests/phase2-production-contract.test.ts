import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const gameTypesPath = path.join(process.cwd(), 'engine', 'types', 'game.ts');
const productionPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'ProductionSystem.ts');
const logisticsPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'LogisticsSystem.ts');
const hudPath = path.join(process.cwd(), 'components', 'HUD.tsx');
const persistencePath = path.join(process.cwd(), 'engine', 'sim', 'PersistenceManager.ts');
const powerGridPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'PowerGridSystem.ts');
const economyPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'EconomySystem.ts');
const supplySidebarPath = path.join(process.cwd(), 'components', 'SupplySidebar.tsx');
const industrialCostsPath = path.join(process.cwd(), 'engine', 'data', 'industrialCosts.ts');
const buildingTypesPath = path.join(process.cwd(), 'engine', 'types', 'buildings.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Phase 2 state types expose industrial stocks, connected-grid demand metrics, and late-game logistics economy metrics', () => {
  assert.equal(existsSync(gameTypesPath), true, 'engine/types/game.ts is missing');

  const source = readFileSync(gameTypesPath, 'utf8');

  for (const snippet of [
    "'REFINED_MATERIALS'",
    "'ALLOYS'",
    "'MACHINE_PARTS'",
    "'AUTOMATION_KITS'",
    'export interface IndustryState',
    'refinedMaterials: number;',
    'alloys: number;',
    'machineParts: number;',
    'automationKits: number;',
    'industry?: IndustryState;',
    'industrialDemand: number;',
    'strandedDemand: number;',
    'export interface FactorySectorState',
    'exportFocus: FactoryResourceType;',
    'importDiscount: number;',
    'droneCharge?: number;',
    'droneUpkeep?: number;',
    'rechargePads?: number;',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Phase 2 production turns foundry throughput into refined materials and alloys, then workshop and lab throughput into higher-tier outputs', () => {
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
    'tile.buildingType === BuildingType.GREEN_TECH_LAB',
    "this.pullInput(node, 'MACHINE_PARTS'",
    "this.pushOutput(node, 'AUTOMATION_KITS'",
    "if (tile.powerStatus !== 'CONNECTED')",
    'const industry = this.getIndustryState(state);',
    'industry.automatedChains = automatedChains;',
    'industry.gridLoad = state.powerGrid?.industrialDemand || 0;',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Phase 2 logistics routes workshop and lab inputs, deposits industrial stock, and tracks sectors plus drone upkeep', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
    'BuildingType.WORKSHOP',
    'BuildingType.GREEN_TECH_LAB',
    "resource === 'REFINED_MATERIALS' || resource === 'WOOD' || resource === 'ALLOYS'",
    "resource === 'REFINED_MATERIALS' || resource === 'ALLOYS' || resource === 'MACHINE_PARTS'",
    "'REFINED_MATERIALS', 'ALLOYS', 'MACHINE_PARTS', 'AUTOMATION_KITS'",
    "if (resource === 'REFINED_MATERIALS') state.industry.refinedMaterials += amount;",
    "if (resource === 'ALLOYS') state.industry.alloys += amount;",
    "if (resource === 'MACHINE_PARTS') state.industry.machineParts += amount;",
    "if (resource === 'AUTOMATION_KITS') state.industry.automationKits += amount;",
    'factory.sectors = this.summarizeSectors(factory);',
    'factory.droneCharge = this.getDroneCharge(factory.rechargePads || 0, droneTrips);',
    'factory.droneUpkeep = this.getDroneUpkeep(droneTrips, factory.rechargePads || 0);',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('HUD surfaces phase 2 industrial stocks, automation kits, automated chains, grid load, rail throughput, drone charge, and sector market personalities', () => {
  assert.equal(existsSync(hudPath), true, 'HUD.tsx is missing');

  const source = readFileSync(hudPath, 'utf8');

  for (const snippet of [
    'state.industry?.refinedMaterials || 0',
    'label="Refined"',
    'state.industry?.alloys || 0',
    'label="Alloys"',
    'state.industry?.machineParts || 0',
    'label="Parts"',
    'state.industry?.automationKits || 0',
    'label="Kits"',
    'state.industry?.automatedChains || 0',
    'label="Chains"',
    'state.industry?.gridLoad || 0',
    'label="Grid"',
    'state.powerGrid?.strandedDemand',
    'state.factory?.regionalThroughput || 0',
    'label="Rail"',
    '(state.factory?.droneCharge || 0) * 100',
    'label="Charge"',
    'state.factory?.droneUpkeep',
    'const sectors = [...(state.factory?.sectors || [])].sort',
    'Out {SECTOR_RESOURCE_LABELS[sector.exportFocus]} +{toPercent(sector.exportBonus)}',
    'In {SECTOR_RESOURCE_LABELS[sector.importFocus]} -{toPercent(sector.importDiscount)}',
    'Pads {rechargePads} · Rail {railFlow}',
    '<MarketBlock state={state}',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Persistence backfills industrial stock and extended power grid metrics when older saves are loaded or revived', () => {
  assert.equal(existsSync(persistencePath), true, 'PersistenceManager.ts is missing');

  const source = readFileSync(persistencePath, 'utf8');

  for (const snippet of [
    'private ensureIndustryState(state: GameState): void {',
    'if (!state.industry) {',
    'state.industry.refinedMaterials ??= 0;',
    'state.industry.alloys ??= 0;',
    'state.industry.machineParts ??= 0;',
    'state.industry.automationKits ??= 0;',
    'private ensurePowerGridState(state: GameState): void {',
    'state.powerGrid ??=',
    'state.powerGrid.industrialDemand ??= 0;',
    'state.powerGrid.strandedDemand ??= 0;',
    'this.ensureIndustryState(state);',
    'this.ensurePowerGridState(state);',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Power grid tracks connected industrial demand separately from stranded demand', () => {
  assert.equal(existsSync(powerGridPath), true, 'PowerGridSystem.ts is missing');

  const source = readFileSync(powerGridPath, 'utf8');

  for (const snippet of [
    'let industrialDemand = 0;',
    'let strandedDemand = 0;',
    "if (tile.powerStatus === 'CONNECTED')",
    'industrialDemand += def.power.consumes;',
    'strandedDemand += def.power.consumes;',
    'private isIndustrialConsumer(type: BuildingType): boolean {',
    'BuildingType.ORE_FOUNDRY',
    'BuildingType.WORKSHOP',
    'BuildingType.GREEN_TECH_LAB',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Advanced buildings spend industrial stock, the market panel exposes regional personalities, and drone depots add dedicated late-game support', () => {
  assert.equal(existsSync(industrialCostsPath), true, 'industrialCosts.ts is missing');
  assert.equal(existsSync(economyPath), true, 'EconomySystem.ts is missing');
  assert.equal(existsSync(supplySidebarPath), true, 'SupplySidebar.tsx is missing');
  assert.equal(existsSync(buildingTypesPath), true, 'engine/types/buildings.ts is missing');

  const costsSource = readFileSync(industrialCostsPath, 'utf8');
  const economySource = readFileSync(economyPath, 'utf8');
  const sidebarSource = readFileSync(supplySidebarPath, 'utf8');
  const buildingTypesSource = readFileSync(buildingTypesPath, 'utf8');

  for (const snippet of [
    'BuildingType.DISTRIBUTION_HUB',
    'BuildingType.TRAIN_STATION',
    'BuildingType.DRONE_DEPOT',
    'BuildingType.GEOTHERMAL_PLANT',
    'BuildingType.GREEN_TECH_LAB',
    'BuildingType.SPACEPORT',
    'machineParts',
    'alloys',
    'refinedMaterials',
    'automationKits',
    'Automation Kits',
  ]) {
    assert.match(costsSource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'getIndustrialBuildingCosts(buildingType)',
    'getMissingIndustrialCosts(state.industry, industrialCosts)',
    "const key = resource as 'refinedMaterials' | 'alloys' | 'machineParts' | 'automationKits';",
    'state.industry![key] -= amount as number;',
    'if ((state.factory?.droneUpkeep || 0) > 0)',
    'private getSectorExportBonus(state: GameState, resource: FactoryResourceType): number {',
    'private getSectorImportDiscount(state: GameState, resource: FactoryResourceType): number {',
    'sector premium',
    'sector discount',
  ]) {
    assert.match(economySource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'case BuildingType.DRONE_DEPOT: return <Package size={18} />;',
    "[BuildingType.DRONE_DEPOT]: 'ADVANCED'",
    'BuildingType.NATURE_RESERVE, BuildingType.HYDROPONICS, BuildingType.GEOTHERMAL_PLANT, BuildingType.DRONE_DEPOT,',
    'const industrialCosts = getIndustrialBuildingCosts(selectedItem);',
    'const missingIndustrial = state.cheatsEnabled ? [] : getMissingIndustrialCosts(state.industry, industrialCosts);',
    'formatIndustrialCosts(industrialCosts)',
    'Needs {missingIndustrial[0]}',
  ]) {
    assert.match(sidebarSource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    "DRONE_DEPOT = 'DRONE_DEPOT'",
  ]) {
    assert.match(buildingTypesSource, new RegExp(escapeRegExp(snippet)));
  }
});
