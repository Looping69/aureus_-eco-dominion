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

test('Phase 3 shared types expose transport, sector policy, planner pressure, and corridor history state', () => {
  assert.equal(existsSync(gameTypesPath), true, 'engine/types/game.ts is missing');

  const source = readFileSync(gameTypesPath, 'utf8');

  for (const snippet of [
    "export type FactoryPacketTransportMode = 'BELT' | 'RAIL' | 'DRONE';",
    "export type FactorySectorDirective = 'BALANCED' | 'EXPORT' | 'IMPORT';",
    "export type FactorySectorFlowMode = 'STABLE' | 'SURGE';",
    "export type FactorySectorCongestionMode = 'SAFE' | 'BALANCED' | 'AGGRESSIVE';",
    "export type FactoryPressureReason = 'ROUTE_DEBT' | 'UNDERFED' | 'CONGESTION';",
    "export type FactoryCorridorTrend = 'UP' | 'DOWN' | 'FLAT';",
    'export interface FactoryCorridorState {',
    'history: number[];',
    'trend: FactoryCorridorTrend;',
    'recommendedBuilding: BuildingType;',
    'followThrough: string;',
    'export interface FactoryPressureState {',
    'pinnedKeys: string[];',
    'emergencyReliefSectors: string[];',
    'recommendations: FactoryPlannerRecommendation[];',
    'efficiencyPenalty: number;',
    'corridors?: FactoryCorridorState[];',
    'transportMode?: FactoryPacketTransportMode;',
    'sectorName?: string;',
    'sectorFrom?: string;',
    'sectorTo?: string;',
    'directive?: FactorySectorDirective;',
    'priorityResource?: FactoryResourceType;',
    'flowMode?: FactorySectorFlowMode;',
    'congestionPolicy?: FactorySectorCongestionMode;',
    'contractResource?: FactoryResourceType;',
    'contractTarget?: number;',
    'satisfaction?: number;',
    'bonusChain?: number;',
    'missedQuotaTicks?: number;',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('LogisticsSystem keeps rail and drone roles, calmer planner thresholds, and scoped corridor follow-through', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
    'private isDroneHub(type: BuildingType): boolean {',
    'BuildingType.DRONE_DEPOT',
    "[BuildingType.RAIL_LINE, BuildingType.DISTRIBUTION_HUB, BuildingType.TRAIN_STATION, BuildingType.DRONE_DEPOT].includes(type)",
    'const transportMode = this.getPacketTransportMode(node, route.node);',
    'const sectorFrom = this.getPacketSector(factory, node, route.node, transportMode);',
    'const sectorTo = this.getPacketSector(factory, route.node, node, transportMode);',
    'factory.sectors = this.summarizeSectors(factory);',
    'factory.regionalThroughput = regionalThroughput / this.FACTORY_INTERVAL;',
    'factory.dronePressure = droneTrips > 0 ? dronePressureTotal / droneTrips : 0;',
    'const totalHotspots = Math.max(hotspots, stalledNodes);',
    'const corridors = this.buildCorridorInsights(factory, bottlenecks);',
    'const recommendations = this.buildPlannerRecommendations(bottlenecks, pinnedKeys, emergencyReliefSectors, {',
    'hotspots: totalHotspots,',
    '.slice(0, 3);',
    "if (!history || history.length < 3) return 'FLAT';",
    'if (delta > 2.5) return \'UP\';',
    'if (delta < -2.5) return \'DOWN\';',
    'if (routeDebtShare >= 8) return BuildingType.RAIL_LINE;',
    'Lay fresh rail in',
    'Add depot relief until',
    'routeDebt >= 10',
    'metrics.underfedProcessors >= 2',
    'metrics.hotspots >= 2',
    'routeDebtCorridor?.recommendedBuilding || this.getSuggestedBuilding(routeDebtPoint)',
    'Reinforce rail corridor',
    'Stabilize processor cluster',
    'Expand depot relief',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Economy, production, and render layers consume planner pressure instead of leaving it as a warning only', () => {
  assert.equal(existsSync(productionPath), true, 'ProductionSystem.ts is missing');
  assert.equal(existsSync(economyPath), true, 'EconomySystem.ts is missing');
  assert.equal(existsSync(buildingRenderPath), true, 'BuildingRenderSystem.ts is missing');

  const productionSource = readFileSync(productionPath, 'utf8');
  const economySource = readFileSync(economyPath, 'utf8');
  const renderSource = readFileSync(buildingRenderPath, 'utf8');

  for (const snippet of [
    'const factoryPenalty = 1 - (state.factory?.pressure?.efficiencyPenalty || 0);',
    'const plannerEfficiency = this.isFactoryPenaltyTarget(tile.buildingType) ? factoryPenalty : 1;',
    'const effectiveFactoryEfficiency = utilityEfficiency * plannerEfficiency;',
    'private isFactoryPenaltyTarget(type: BuildingType): boolean {',
  ]) {
    assert.match(productionSource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'private applySectorQuotaPressure(state: GameState) {',
    'const bonusChain = sector.bonusChain ?? 0;',
    'const missedQuotaTicks = sector.missedQuotaTicks ?? 0;',
    'state.resources.agt += reward;',
    'state.resources.agt = Math.max(0, state.resources.agt - agtPenalty);',
    'private getSectorExportContractBonus(sector: FactorySectorState, resource: FactoryResourceType): number {',
    'private getSectorImportContractDiscount(sector: FactorySectorState, resource: FactoryResourceType): number {',
  ]) {
    assert.match(economySource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'const recommendationByKey = new Map((factory.pressure?.recommendations || [])',
    'RELIEF ${this.getSectorCode(node.sectorName)}',
    'PIN ${this.getSuggestedBuildingCode(recommendation.suggestedBuilding)}',
    'const heatTrail = new THREE.Mesh(',
    'const plannerRing = new THREE.Mesh(',
    'const plannerBadge = new THREE.Sprite(this.getSectorLabelMaterial(',
    'const goalBadge = new THREE.Sprite(this.getSectorLabelMaterial(',
    'private getSectorGoalLabel(sector: FactorySectorState): string {',
  ]) {
    assert.match(renderSource, new RegExp(escapeRegExp(snippet)));
  }
});

test('HUD and building text expose regional personalities and dedicated drone support infrastructure', () => {
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
    'Sat {toPercent(satisfaction)}',
    'Chain x{bonusChain}',
    'Pads {rechargePads} · Rail {railFlow} · Debt {routeDebt} · Feed {underfed} · Hot {hotspots}',
  ]) {
    assert.match(hudSource, new RegExp(escapeRegExp(snippet)));
  }
});

test('Trade terminal reads as a late-game control surface with denser corridor watch and calmer recommendation cards', () => {
  assert.equal(existsSync(tradeTerminalPath), true, 'components/TradeTerminal.tsx is missing');

  const source = readFileSync(tradeTerminalPath, 'utf8');

  for (const snippet of [
    'w-[30rem] max-w-[94vw]',
    'Regional export, congestion, quota control, and planner relief',
    'Late-game network control, not just warnings',
    'bottlenecks.slice(0, 3).map((point) => {',
    'corridors.slice(0, 2).map((corridor) => (',
    'heightClass="h-12"',
    'recommendations.slice(0, 2).map((rec) => {',
    'Upgrade lane {getRecommendationScope(rec)}',
    'Anchor {corridor?.anchorKey || rec.targetKey || \'Network\'} · {formatSuggestedBuilding(rec.suggestedBuilding)}',
    'Follow-through {corridor?.followThrough || \'Stabilize this node before scaling outward.\'}',
    'reason: rec.reason,',
    'Frame, Preview & Overlay',
    'Performance goal',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Engine bridge can frame planner recommendations with building-specific preview offsets, overlay switching, and smarter zoom', () => {
  assert.equal(existsSync(engineBridgePath), true, 'game/useAureusEngine.ts is missing');

  const source = readFileSync(engineBridgePath, 'utf8');

  for (const snippet of [
    "import { BuildingType, GameState, LogisticsOverlayMode, SfxType } from '../types';",
    'function findPlannerTargetNode(state: GameState, payload: Record<string, any>) {',
    'function getPlannerPreviewOffsets(buildingType?: BuildingType): Array<[number, number]> {',
    'function findPlannerPreviewPosition(state: GameState, x: number, z: number, buildingType?: BuildingType) {',
    'function getPlannerOverlayMode(reason?: string, suggestedBuilding?: BuildingType): LogisticsOverlayMode {',
    'function getPlannerZoom(buildingType?: BuildingType): number {',
    "if (action.payload?.plannerAction === 'FOCUS_RECOMMENDATION') {",
    'const overlayMode = getPlannerOverlayMode(action.payload?.reason, action.payload?.suggestedBuilding);',
    'if (state.logistics.overlayMode !== overlayMode) {',
    'world.loadGame(JSON.stringify({',
    'world.selectBuilding(action.payload.suggestedBuilding);',
    'const preview = findPlannerPreviewPosition(state, targetNode.x, targetNode.z, action.payload.suggestedBuilding);',
    'world.pinBuildingForConfirmation(preview.x, preview.z);',
    'const zoomLevel = getPlannerZoom(action.payload?.suggestedBuilding);',
    '(world as any).cameraSystem?.zoomToPosition?.(targetNode.x, targetNode.z, zoomLevel);',
    'corridors: [],',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
