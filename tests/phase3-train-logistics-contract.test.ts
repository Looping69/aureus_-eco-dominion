import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const gameTypesPath = path.join(process.cwd(), 'engine', 'types', 'game.ts');
const logisticsPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'LogisticsSystem.ts');
const buildingsPath = path.join(process.cwd(), 'engine', 'data', 'buildings.ts');
const hudPath = path.join(process.cwd(), 'components', 'HUD.tsx');
const tradeTerminalPath = path.join(process.cwd(), 'components', 'TradeTerminal.tsx');
const engineBridgePath = path.join(process.cwd(), 'game', 'useAureusEngine.ts');
const economyPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'EconomySystem.ts');
const buildingRenderPath = path.join(process.cwd(), 'game', 'render', 'systems', 'BuildingRenderSystem.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Phase 3 packet types expose explicit belt, rail, and drone transport modes plus steerable sector policy metadata', () => {
  assert.equal(existsSync(gameTypesPath), true, 'engine/types/game.ts is missing');

  const source = readFileSync(gameTypesPath, 'utf8');

  for (const snippet of [
    "export type FactoryPacketTransportMode = 'BELT' | 'RAIL' | 'DRONE';",
    "export type FactorySectorDirective = 'BALANCED' | 'EXPORT' | 'IMPORT';",
    "export type FactorySectorFlowMode = 'STABLE' | 'SURGE';",
    "export type FactorySectorCongestionMode = 'SAFE' | 'BALANCED' | 'AGGRESSIVE';",
    'transportMode?: FactoryPacketTransportMode;',
    'sectorName?: string;',
    'sectorFrom?: string;',
    'sectorTo?: string;',
    'regionalThroughput?: number;',
    'dronePressure?: number;',
    'export interface FactorySectorState',
    'exportBonus: number;',
    'importDiscount: number;',
    'demandBonus: number;',
    'directive?: FactorySectorDirective;',
    'priorityResource?: FactoryResourceType;',
    'flowMode?: FactorySectorFlowMode;',
    'congestionPolicy?: FactorySectorCongestionMode;',
    'congestionLevel?: number;',
    'contractResource?: FactoryResourceType;',
    'contractTarget?: number;',
    'contractProgress?: number;',
    'contractReward?: number;',
    'satisfaction?: number;',
    'bonusChain?: number;',
    'missedQuotaTicks?: number;',
    'droneCharge?: number;',
    'droneUpkeep?: number;',
    'rechargePads?: number;',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Train stations act as regional sector anchors, drone depots extend local service, and both feed deterministic sector-aware logistics', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
    'private isDroneHub(type: BuildingType): boolean {',
    'BuildingType.DRONE_DEPOT',
    "[BuildingType.RAIL_LINE, BuildingType.DISTRIBUTION_HUB, BuildingType.TRAIN_STATION, BuildingType.DRONE_DEPOT].includes(type)",
    "if ([BuildingType.STORAGE_DEPOT, BuildingType.STOCKPILE].includes(type)) return 'SINK';",
    "sectorName: tile.buildingType === BuildingType.TRAIN_STATION ? this.getRegionalSectorName(tile.x, tile.z) : undefined,",
    'private getRegionalSectorName(x: number, z: number): string {',
    'private summarizeSectors(factory: FactoryState): FactorySectorState[] {',
    'const previousByName = new Map((factory.sectors || []).map((sector) => [sector.name, sector]));',
    'const contractProgressBySector = new Map<string, number>();',
    'const dronePressureBySector = new Map<string, number>();',
    'private buildSectorProfile(',
    "const flowMode = previous?.flowMode || 'STABLE';",
    "const congestionPolicy = previous?.congestionPolicy || 'BALANCED';",
    "const contractResource = previous?.contractResource || defaultContractResource;",
    'const contractTarget = previous?.contractTarget || (18 + stationCount * 8 + Math.round(throughput * 0.35));',
    'const completion = contractTarget > 0 ? cappedProgress / contractTarget : 0;',
    'const previousSatisfaction = previous?.satisfaction ?? 0.72;',
    'let satisfaction = previousSatisfaction;',
    'let bonusChain = previousBonusChain;',
    'let missedQuotaTicks = previousMissedTicks;',
    'satisfaction = Math.max(0.05, previousSatisfaction - 0.16);',
    'bonusChain = 0;',
    'missedQuotaTicks = previousMissedTicks + 2;',
    'satisfaction,',
    'bonusChain,',
    'missedQuotaTicks,',
    'private findRailLinkedStations(factory: FactoryState, origin: FactoryNodeState): FactoryNodeState[] {',
    'private findDroneServedNodes(factory: FactoryState, origin: FactoryNodeState): FactoryNodeState[] {',
    'if (node.buildingType === BuildingType.TRAIN_STATION) {',
    'if (this.isDroneHub(node.buildingType)) {',
    'const serviceRadius = this.getDroneServiceRadius(origin);',
    'private getDroneServiceRadius(station: FactoryNodeState | null): number {',
    'return station.buildingType === BuildingType.DRONE_DEPOT ? this.DRONE_DEPOT_RADIUS : this.MAX_DRONE_RADIUS;',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Train packets now score routes with sector flow posture, congestion appetite, and live quota pressure', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
    'const transferBudget = Math.max(0.75, this.getTransferBudget(node) + this.getSectorTransferBias(factory, node, route.node, transportMode));',
    'const transportMode = this.getPacketTransportMode(node, route.node);',
    'const sectorFrom = this.getPacketSector(factory, node, route.node, transportMode);',
    'const sectorTo = this.getPacketSector(factory, route.node, node, transportMode);',
    'factory.sectors = this.summarizeSectors(factory);',
    'factory.regionalThroughput = regionalThroughput / this.FACTORY_INTERVAL;',
    'factory.rechargePads = this.countRechargePads(factory);',
    'factory.droneCharge = this.getDroneCharge(factory.rechargePads || 0, droneTrips);',
    'factory.droneUpkeep = this.getDroneUpkeep(droneTrips, factory.rechargePads || 0);',
    'factory.dronePressure = droneTrips > 0 ? dronePressureTotal / droneTrips : 0;',
    'private scoreRouteCandidate(',
    "if ((destinationSector?.satisfaction || 1) < 0.35) score += 6;",
    "if ((destinationSector?.bonusChain || 0) >= 3 && transportMode === 'RAIL') score += 2;",
    'const congestionPenalty = this.getCongestionPenalty(destinationSector, transportMode) + (originSector?.congestionLevel || 0) * 2;',
    'score += this.getSectorContractPull(destinationSector, resource);',
    'private getCongestionPenalty(sector: FactorySectorState | undefined, mode: FactoryPacketTransportMode): number {',
    'const satisfactionPenalty = Math.max(0, 0.45 - (sector.satisfaction || 0.45)) * 8;',
    'private getSectorContractPull(sector: FactorySectorState | undefined, resource: FactoryResourceType): number {',
    'const missedPressure = Math.min(6, (sector.missedQuotaTicks || 0) * 0.8);',
    'private getSectorTransferBias(',
    "if ((sector.satisfaction || 1) < 0.4) bias += 0.9;",
    "if ((sector.bonusChain || 0) >= 2 && transportMode === 'RAIL') bias += 0.55;",
    'private getSectorProfile(factory: FactoryState, name: string): FactorySectorState | undefined {',
    'private getDroneTransferBudget(factory: FactoryState, station: FactoryNodeState | null): number {',
    'private countActiveDroneTrips(factory: FactoryState, station: FactoryNodeState | null): number {',
    'private getDronePressure(factory: FactoryState, station: FactoryNodeState | null): number {',
    'private countRechargePads(factory: FactoryState): number {',
    'private getDroneCharge(rechargePads: number, droneTrips: number): number {',
    'private getDroneUpkeep(droneTrips: number, rechargePads: number): number {',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Sector quotas now affect market pricing and create bonus-chain or missed-target pressure', () => {
  assert.equal(existsSync(economyPath), true, 'EconomySystem.ts is missing');

  const source = readFileSync(economyPath, 'utf8');

  for (const snippet of [
    'private applySectorQuotaPressure(state: GameState) {',
    'const satisfaction = sector.satisfaction ?? 0.75;',
    'const bonusChain = sector.bonusChain ?? 0;',
    'const missedQuotaTicks = sector.missedQuotaTicks ?? 0;',
    'state.resources.agt += reward;',
    'state.resources.trust = Math.min(100, state.resources.trust + (0.05 * bonusChain));',
    'state.resources.agt = Math.max(0, state.resources.agt - agtPenalty);',
    'state.resources.trust = Math.max(0, state.resources.trust - (0.08 + (missedQuotaTicks * 0.015)));',
    'private getSectorExportBonus(state: GameState, resource: FactoryResourceType): number {',
    'private getSectorImportDiscount(state: GameState, resource: FactoryResourceType): number {',
    'private getSectorExportContractBonus(sector: FactorySectorState, resource: FactoryResourceType): number {',
    'const chainBonus = Math.min(0.08, (sector.bonusChain || 0) * 0.015);',
    'private getSectorImportContractDiscount(sector: FactorySectorState, resource: FactoryResourceType): number {',
    'const missedPressure = Math.min(0.08, (sector.missedQuotaTicks || 0) * 0.01);',
    'private getSectorContractCompletion(sector: FactorySectorState): number {',
    'sector.exportBonus + this.getSectorExportContractBonus(sector, resource)',
    'sector.importDiscount + this.getSectorImportContractDiscount(sector, resource)',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Renderer exposes in-world sector heatmaps and quota pressure overlays', () => {
  assert.equal(existsSync(buildingRenderPath), true, 'BuildingRenderSystem.ts is missing');

  const source = readFileSync(buildingRenderPath, 'utf8');

  for (const snippet of [
    'FactorySectorState,',
    'sectorBonus: new THREE.MeshBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 0.38 }),',
    'sectorStrain: new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.42 }),',
    'const sectorProfiles = new Map((factory.sectors || []).map((sector) => [sector.name, sector]));',
    'const routeLoadBySector = new Map<string, number>();',
    "if (overlayMode === 'FLOW') {",
    'const heatTrail = new THREE.Mesh(',
    "if (overlayMode === 'CONGESTION') {",
    'const pressure = Math.max(this.getSectorPressure(fromSector), this.getSectorPressure(toSector));',
    'const flowPlate = new THREE.Mesh(',
    'const sectorPlate = new THREE.Mesh(',
    'const quotaStress = new THREE.Mesh(',
    'if ((sector.missedQuotaTicks || 0) >= 3 || (sector.satisfaction || 1) < 0.35) {',
    'private getSectorPressure(sector: FactorySectorState | undefined): number {',
    'private getSectorPressureColor(pressure: number): number {',
    'private getSectorFlowColor(sector: FactorySectorState): number {',
    'private getSectorSatisfactionColor(sector: FactorySectorState): number {',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Building definitions and HUD now describe visible regional personalities plus dedicated drone support infrastructure', () => {
  assert.equal(existsSync(buildingsPath), true, 'engine/data/buildings.ts is missing');
  assert.equal(existsSync(hudPath), true, 'components/HUD.tsx is missing');

  const buildingsSource = readFileSync(buildingsPath, 'utf8');
  const hudSource = readFileSync(hudPath, 'utf8');

  for (const snippet of [
    'Industrial track for regional bulk transport between train hubs.',
    'Regional Rail Throughput',
    'dispatches short-range drones for nearby delivery',
    'Regional Rail + Drone Dispatch, +50 Trust/s',
    'name: \'Drone Depot\'',
    'Drone Range + Charge Capacity',
    'district-scale last-mile drone delivery',
  ]) {
    assert.match(buildingsSource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'const sectors = [...(state.factory?.sectors || [])].sort',
    'Out {SECTOR_RESOURCE_LABELS[sector.exportFocus]} +{toPercent(sector.exportBonus)}',
    'In {SECTOR_RESOURCE_LABELS[sector.importFocus]} -{toPercent(sector.importDiscount)}',
    'Demand +{toPercent(sector.demandBonus)}',
    'Build rail hubs to read regional demand.',
    'Pads {rechargePads} · Rail {railFlow}',
  ]) {
    assert.match(hudSource, new RegExp(escapeRegExp(snippet)));
  }
});

test('Trade terminal includes visible throughput, congestion, and quota controls on each sector card', () => {
  assert.equal(existsSync(tradeTerminalPath), true, 'components/TradeTerminal.tsx is missing');

  const source = readFileSync(tradeTerminalPath, 'utf8');

  for (const snippet of [
    'const sectors = [...(state.factory?.sectors || [])].sort',
    "const SECTOR_DIRECTIVES: FactorySectorDirective[] = ['BALANCED', 'EXPORT', 'IMPORT'];",
    "const FLOW_MODES: FactorySectorFlowMode[] = ['STABLE', 'SURGE'];",
    "const CONGESTION_POLICIES: FactorySectorCongestionMode[] = ['SAFE', 'BALANCED', 'AGGRESSIVE'];",
    'const CONTRACT_TARGETS = [16, 24, 32, 48, 64, 96];',
    'const getNextFlowMode = (mode?: FactorySectorFlowMode): FactorySectorFlowMode => {',
    'const getNextCongestionPolicy = (policy?: FactorySectorCongestionMode): FactorySectorCongestionMode => {',
    'const getNextContractTarget = (target?: number): number => {',
    'Sector Market',
    'Regional export, congestion, and quota control',
    'Build train stations to open regional trade lanes.',
    'Demand contract',
    'Throughput',
    'Congestion',
    'Contract',
    'Quota',
    "type: 'UPDATE_SECTOR_POLICY'",
    'flowMode: getNextFlowMode(flowMode)',
    'congestionPolicy: getNextCongestionPolicy(congestionPolicy)',
    'contractResource: getNextPriorityResource(contractResource)',
    'contractTarget: getNextContractTarget(contractTarget)',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Engine dispatch bridge persists expanded sector policy updates back into engine-owned state', () => {
  assert.equal(existsSync(engineBridgePath), true, 'game/useAureusEngine.ts is missing');

  const source = readFileSync(engineBridgePath, 'utf8');

  for (const snippet of [
    "if (action?.type === 'UPDATE_SECTOR_POLICY') {",
    'const state = world.getState();',
    'if (!state.factory?.sectors) return;',
    'factory: {',
    'sectors: state.factory.sectors.map((sector) =>',
    "directive: action.payload.directive ?? sector.directive ?? 'BALANCED'",
    'priorityResource: action.payload.priorityResource ?? sector.priorityResource ?? sector.exportFocus,',
    "flowMode: action.payload.flowMode ?? sector.flowMode ?? 'STABLE'",
    "congestionPolicy: action.payload.congestionPolicy ?? sector.congestionPolicy ?? 'BALANCED'",
    'contractResource: action.payload.contractResource ?? sector.contractResource ?? sector.importFocus,',
    'contractTarget: action.payload.contractTarget ?? sector.contractTarget ?? 24,',
    'world.loadGame(JSON.stringify(updatedState));',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
