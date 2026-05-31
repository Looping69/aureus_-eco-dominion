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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Phase 3 packet types expose explicit belt, rail, and drone transport modes plus steerable sector policy metadata', () => {
  assert.equal(existsSync(gameTypesPath), true, 'engine/types/game.ts is missing');

  const source = readFileSync(gameTypesPath, 'utf8');

  for (const snippet of [
    "export type FactoryPacketTransportMode = 'BELT' | 'RAIL' | 'DRONE';",
    "export type FactorySectorDirective = 'BALANCED' | 'EXPORT' | 'IMPORT';",
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
    'private buildSectorProfile(name: string, stationCount: number, throughput: number, previous?: FactorySectorState): FactorySectorState {',
    "const directive = previous?.directive || 'BALANCED';",
    "const priorityResource = previous?.priorityResource || (directive === 'IMPORT' ? importFocus : exportFocus);",
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

test('Train packets distinguish long-haul inter-sector rail movement from pressure-limited, depot-boosted drone dispatch, and route scoring now listens to sector policy', () => {
  assert.equal(existsSync(logisticsPath), true, 'LogisticsSystem.ts is missing');

  const source = readFileSync(logisticsPath, 'utf8');

  for (const snippet of [
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
    'const destinationSector = destinationSectorName ? this.getSectorProfile(factory, destinationSectorName) : undefined;',
    "if (destinationSector?.directive === 'IMPORT') score += 5;",
    "if (originSector?.directive === 'EXPORT') score += 4;",
    "if (destinationSector?.priorityResource === resource) score += destinationSector.directive === 'IMPORT' ? 12 : 6;",
    "if (originSector?.priorityResource === resource) score += originSector.directive === 'EXPORT' ? 10 : 5;",
    'private getSectorProfile(factory: FactoryState, name: string): FactorySectorState | undefined {',
    'private getDroneTransferBudget(factory: FactoryState, station: FactoryNodeState | null): number {',
    'private countActiveDroneTrips(factory: FactoryState, station: FactoryNodeState | null): number {',
    'private getDronePressure(factory: FactoryState, station: FactoryNodeState | null): number {',
    'private countRechargePads(factory: FactoryState): number {',
    'private getDroneCharge(rechargePads: number, droneTrips: number): number {',
    'private getDroneUpkeep(droneTrips: number, rechargePads: number): number {',
    "if (this.isDroneHub(origin.buildingType) && destination.mode !== 'TRANSPORT') return 'DRONE';",
    "if (this.isDroneHub(destination.buildingType) && origin.mode !== 'TRANSPORT') return 'DRONE';",
    "if (origin.buildingType === BuildingType.TRAIN_STATION || destination.buildingType === BuildingType.TRAIN_STATION) return 'RAIL';",
    'if (station.buildingType === BuildingType.DRONE_DEPOT) return 10;',
    'reduce((sum, node) => sum + this.getDroneRechargePadCapacity(node), 0);',
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

test('Trade terminal includes a dedicated sector market planning view with steerable dispatch controls', () => {
  assert.equal(existsSync(tradeTerminalPath), true, 'components/TradeTerminal.tsx is missing');

  const source = readFileSync(tradeTerminalPath, 'utf8');

  for (const snippet of [
    'const sectors = [...(state.factory?.sectors || [])].sort',
    'const SECTOR_DIRECTIVES: FactorySectorDirective[] = [\'BALANCED\', \'EXPORT\', \'IMPORT\'];',
    'const PRIORITY_RESOURCE_ORDER: FactoryResourceType[] = [',
    'const getNextDirective = (directive?: FactorySectorDirective): FactorySectorDirective => {',
    'const getNextPriorityResource = (resource?: FactoryResourceType): FactoryResourceType => {',
    'Sector Market',
    'Regional export and import bias',
    'Build train stations to open regional trade lanes.',
    'Dispatch',
    'Priority',
    "type: 'UPDATE_SECTOR_POLICY'",
    'directive: getNextDirective(directive),',
    'priorityResource: getNextPriorityResource(priorityResource),',
    'SECTOR_RESOURCE_LABELS[priorityResource]',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Engine dispatch bridge persists sector policy updates back into engine-owned state', () => {
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
    'world.loadGame(JSON.stringify(updatedState));',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
