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
const productionPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'ProductionSystem.ts');

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
    "export type FactoryPressureReason = 'ROUTE_DEBT' | 'UNDERFED' | 'CONGESTION';",
    'export interface FactoryPressurePoint {',
    'reason: FactoryPressureReason;',
    'detail: string;',
    'export interface FactoryPlannerRecommendation {',
    'suggestedBuilding?: BuildingType;',
    'export interface FactoryPressureState {',
    'routeDebt: number;',
    'underfedProcessors: number;',
    'hotspots: number;',
    'bottlenecks: FactoryPressurePoint[];',
    'pinnedKeys: string[];',
    'emergencyReliefSectors: string[];',
    'recommendations: FactoryPlannerRecommendation[];',
    'efficiencyPenalty: number;',
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
    'pressure?: FactoryPressureState;',
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

test('Train packets now score routes with sector flow posture, planner relief, pins, live bottleneck diagnostics, and scoped upgrade guidance', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
    'let routeDebt = 0;',
    'const bottlenecks: FactoryPressurePoint[] = [];',
    'routeDebt += rawAmount;',
    "reason: 'ROUTE_DEBT',",
    'detail: `${resource} backed up with no route`,',
    'if (destinationSectorName && this.getEmergencyReliefSectors(factory).includes(destinationSectorName)) {',
    "if (this.getPinnedKeys(factory).includes(candidate.key) && target === 'input') {",
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
    'factory.pressure = this.buildFactoryPressure(factory, routeDebt, stalledNodes, bottlenecks);',
    'private scoreRouteCandidate(',
    "if ((destinationSector?.satisfaction || 1) < 0.35) score += 6;",
    'private getSectorTransferBias(',
    'if (this.getEmergencyReliefSectors(factory).includes(sector.name)) bias += 0.75;',
    'private buildFactoryPressure(',
    'const pinnedKeys = this.getPinnedKeys(factory);',
    'const emergencyReliefSectors = this.getEmergencyReliefSectors(factory);',
    'const recommendations = this.buildPlannerRecommendations(bottlenecks, pinnedKeys, emergencyReliefSectors, {',
    'routeDebt,',
    'underfedProcessors,',
    'hotspots: Math.max(hotspots, stalledNodes),',
    'const efficiencyPenalty = Math.min(',
    'pinnedKeys,',
    'emergencyReliefSectors,',
    'recommendations,',
    'efficiencyPenalty:',
    'private pushPressurePoint(factory: FactoryState, bottlenecks: FactoryPressurePoint[], point: FactoryPressurePoint): void {',
    'severity: point.severity + (pinned ? 4 : 0) + (relief ? 2 : 0),',
    'private buildPlannerRecommendations(',
    'private buildScopedRecommendation(',
    'Reinforce rail corridor',
    'Stabilize processor cluster',
    'Expand depot relief',
    'Chronic route debt',
    'Processors are idling on',
    'Buffers are pooling faster than the hub can clear them',
    'private getSuggestedBuilding(point: FactoryPressurePoint): BuildingType {',
    'private getPinnedKeys(factory: FactoryState): string[] {',
    'private getEmergencyReliefSectors(factory: FactoryState): string[] {',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Megafactory optimization loop turns chronic pressure into industrial efficiency penalties', () => {
  assert.equal(existsSync(productionPath), true, 'ProductionSystem.ts is missing');

  const source = readFileSync(productionPath, 'utf8');

  for (const snippet of [
    'const factoryPenalty = 1 - (state.factory?.pressure?.efficiencyPenalty || 0);',
    'const plannerEfficiency = this.isFactoryPenaltyTarget(tile.buildingType) ? factoryPenalty : 1;',
    'const effectiveFactoryEfficiency = utilityEfficiency * plannerEfficiency;',
    'Math.max(0.5, (currentDef.production || 0) * 0.03 * effectiveFactoryEfficiency)',
    'Math.max(0.5, (currentDef.production || 0) * 0.025 * effectiveFactoryEfficiency)',
    'Math.max(0.35, ((currentDef.production || 18) * 0.02) * effectiveFactoryEfficiency)',
    'Math.max(0.2, ((currentDef.production || 18) * 0.015) * effectiveFactoryEfficiency)',
    'private isFactoryPenaltyTarget(type: BuildingType): boolean {',
    'BuildingType.GREEN_TECH_LAB',
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

test('Renderer exposes in-world sector heatmaps and planner markers for relief, pins, and build goals', () => {
  assert.equal(existsSync(buildingRenderPath), true, 'BuildingRenderSystem.ts is missing');

  const source = readFileSync(buildingRenderPath, 'utf8');

  for (const snippet of [
    'FactorySectorState,',
    'sectorBonus: new THREE.MeshBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 0.38 }),',
    'sectorStrain: new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.42 }),',
    'const sectorProfiles = new Map((factory.sectors || []).map((sector) => [sector.name, sector]));',
    'const routeLoadBySector = new Map<string, number>();',
    'const pinnedKeys = new Set(factory.pressure?.pinnedKeys || []);',
    'const reliefSectors = new Set(factory.pressure?.emergencyReliefSectors || []);',
    'const recommendationByKey = new Map((factory.pressure?.recommendations || [])',
    'RELIEF ${this.getSectorCode(node.sectorName)}',
    'PIN ${this.getSuggestedBuildingCode(recommendation.suggestedBuilding)}',
    'UP ${this.getSuggestedBuildingCode(recommendation?.suggestedBuilding)}',
    "if (overlayMode === 'FLOW') {",
    'const heatTrail = new THREE.Mesh(',
    "if (overlayMode === 'CONGESTION') {",
    'const pressure = Math.max(this.getSectorPressure(fromSector), this.getSectorPressure(toSector));',
    'const flowPlate = new THREE.Mesh(',
    'const sectorPlate = new THREE.Mesh(',
    'const quotaStress = new THREE.Mesh(',
    'const plannerRing = new THREE.Mesh(',
    'const plannerBadge = new THREE.Sprite(this.getSectorLabelMaterial(',
    'const goalBadge = new THREE.Sprite(this.getSectorLabelMaterial(',
    'private getPlannerColor(reason?: string): number {',
    'private getSuggestedBuildingCode(type?: BuildingType): string {',
    'private getSectorGoalLabel(sector: FactorySectorState): string {',
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
    'const routeDebt = Math.round(state.factory?.pressure?.routeDebt || 0);',
    'const underfed = state.factory?.pressure?.underfedProcessors || 0;',
    'const hotspots = state.factory?.pressure?.hotspots || 0;',
    'Out {SECTOR_RESOURCE_LABELS[sector.exportFocus]} +{toPercent(sector.exportBonus)}',
    'In {SECTOR_RESOURCE_LABELS[sector.importFocus]} -{toPercent(sector.importDiscount)}',
    'Demand +{toPercent(sector.demandBonus)}',
    'Sat {toPercent(satisfaction)}',
    'Chain x{bonusChain}',
    'Build rail hubs to read regional demand.',
    'Pads {rechargePads} · Rail {railFlow} · Debt {routeDebt} · Feed {underfed} · Hot {hotspots}',
  ]) {
    assert.match(hudSource, new RegExp(escapeRegExp(snippet)));
  }
});

test('Trade terminal includes planner pins, emergency relief controls, and actionable build and goal guidance', () => {
  assert.equal(existsSync(tradeTerminalPath), true, 'components/TradeTerminal.tsx is missing');

  const source = readFileSync(tradeTerminalPath, 'utf8');

  for (const snippet of [
    'const pressure = state.factory?.pressure;',
    'const pinnedKeys = new Set(pressure?.pinnedKeys || []);',
    'const reliefSectors = new Set(pressure?.emergencyReliefSectors || []);',
    'const recommendations = pressure?.recommendations || [];',
    "const updatePlanner = (plannerAction: 'TOGGLE_PIN' | 'TOGGLE_RELIEF' | 'FOCUS_RECOMMENDATION', payload: Record<string, unknown>) => {",
    "type: 'UPDATE_FACTORY_PLANNER'",
    'const formatSuggestedBuilding = (value?: string) => value ? value.replace(/_/g, \' \\') : \'Support Upgrade\';',
    'const getRecommendationScope = (rec: { reason?: string; sectorName?: string }) => {',
    'const getRecommendationHint = (rec: { reason?: string; sectorName?: string; suggestedBuilding?: string }) => {',
    'const getRecommendationGoal = (rec: { reason?: string; sectorName?: string; resource?: FactoryResourceType }) => {',
    'const getSectorPerformanceGoal = (sector: {',
    'Regional export, congestion, quota control, and planner relief',
    'Penalty',
    'Megafactory Planning',
    'Pin bottlenecks, mark relief sectors, and follow the first upgrade loop',
    'Recommendations',
    'No upgrade recommendations yet.',
    'Pinned',
    'Emergency Relief',
    'Clear Relief',
    'Relief',
    'ACTIVE',
    'Build hint',
    'Sector goal',
    'World tag',
    'Performance goal',
    'Suggest {formatSuggestedBuilding(rec.suggestedBuilding)}',
    'Upgrade lane {getRecommendationScope(rec)}',
    "updatePlanner('FOCUS_RECOMMENDATION', {",
    'Frame & Preview',
    'getSectorPerformanceGoal({ name: sector.name, satisfaction, contractTarget, contractProgress, contractResource, bonusChain })',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Engine dispatch bridge persists sector policy and factory planner action updates back into engine-owned state and can frame recommendations on the map', () => {
  assert.equal(existsSync(engineBridgePath), true, 'game/useAureusEngine.ts is missing');

  const source = readFileSync(engineBridgePath, 'utf8');

  for (const snippet of [
    'function findPlannerTargetNode(state: GameState, payload: Record<string, any>) {',
    'function findPlannerPreviewPosition(state: GameState, x: number, z: number, buildingType?: BuildingType) {',
    "if (action?.type === 'UPDATE_SECTOR_POLICY') {",
    "if (action?.type === 'UPDATE_FACTORY_PLANNER') {",
    "if (action.payload?.plannerAction === 'FOCUS_RECOMMENDATION') {",
    'const targetNode = findPlannerTargetNode(state, action.payload);',
    'world.selectBuilding(action.payload.suggestedBuilding);',
    'const preview = findPlannerPreviewPosition(state, targetNode.x, targetNode.z, action.payload.suggestedBuilding);',
    'world.pinBuildingForConfirmation(preview.x, preview.z);',
    'const tile = ChunkStore.getTile(state.chunks, targetNode.x, targetNode.z);',
    '(world as any).cameraSystem?.setTargetHeight?.(focusY);',
    '(world as any).cameraSystem?.zoomToPosition?.(targetNode.x, targetNode.z, 2);',
    'const currentPressure = state.factory.pressure || {',
    'pinnedKeys: [],',
    'emergencyReliefSectors: [],',
    'recommendations: [],',
    'efficiencyPenalty: 0,',
    "if (action.payload?.plannerAction === 'TOGGLE_PIN' && action.payload?.targetKey) {",
    "if (action.payload?.plannerAction === 'TOGGLE_RELIEF' && action.payload?.sectorName) {",
    'pinnedKeys: Array.from(pinnedKeys),',
    'emergencyReliefSectors: Array.from(emergencyReliefSectors),',
    'world.loadGame(JSON.stringify(updatedState));',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
