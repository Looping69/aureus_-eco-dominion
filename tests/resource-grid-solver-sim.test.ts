import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { solveResourceGridNetwork } from '../engine/sim/resourceGrid/ResourceGridSolver.ts';
import type { ResourceGridParticipant } from '../engine/sim/resourceGrid/ResourceGridSolver.ts';

function node(partial: ResourceGridParticipant): ResourceGridParticipant {
    return partial;
}

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

test('resource grid solver connects producers through carriers and serves radius consumers', () => {
    const participants: ResourceGridParticipant[] = [
        node({ id: 'reservoir', networkType: 'water', x: 0, z: 0, roles: ['PRODUCER', 'CARRIER'], production: 10, serviceRadius: 3, serviceMetric: 'CHEBYSHEV' }),
        node({ id: 'pipe-1', networkType: 'water', x: 1, z: 0, roles: ['CARRIER'], serviceRadius: 3, serviceMetric: 'CHEBYSHEV' }),
        node({ id: 'pipe-2', networkType: 'water', x: 2, z: 0, roles: ['CARRIER'], serviceRadius: 3, serviceMetric: 'CHEBYSHEV' }),
        node({ id: 'garden', networkType: 'water', x: 2, z: 3, roles: ['CONSUMER'], demand: 6, priority: 90 }),
        node({ id: 'remote-foundry', networkType: 'water', x: 8, z: 0, roles: ['CONSUMER'], demand: 4, priority: 50 }),
    ];

    const result = solveResourceGridNetwork('water', participants);

    assert.equal(result.totalProduced, 10);
    assert.equal(result.connectedDemand, 6);
    assert.equal(result.strandedDemand, 4);
    assert.equal(result.totalConsumed, 6);
    assert.equal(result.deficit, 0);
    assert.deepEqual(result.connectedNodeIds, ['pipe-1', 'pipe-2', 'reservoir']);
    assert.deepEqual(result.consumers, [
        { id: 'garden', status: 'SUPPLIED', requested: 6, allocated: 6 },
        { id: 'remote-foundry', status: 'DISCONNECTED', requested: 4, allocated: 0 },
    ]);
});

test('resource grid solver allocates connected shortages by priority then deterministic id', () => {
    const participants: ResourceGridParticipant[] = [
        node({ id: 'solar', networkType: 'power', x: 0, z: 0, roles: ['PRODUCER', 'CARRIER'], production: 8, serviceRadius: 1, serviceMetric: 'MANHATTAN' }),
        node({ id: 'line-1', networkType: 'power', x: 1, z: 0, roles: ['CARRIER'], serviceRadius: 1, serviceMetric: 'MANHATTAN' }),
        node({ id: 'line-2', networkType: 'power', x: 2, z: 0, roles: ['CARRIER'], serviceRadius: 1, serviceMetric: 'MANHATTAN' }),
        node({ id: 'clinic', networkType: 'power', x: 2, z: 1, roles: ['CONSUMER'], demand: 6, priority: 100 }),
        node({ id: 'workshop', networkType: 'power', x: 3, z: 0, roles: ['CONSUMER'], demand: 6, priority: 40 }),
    ];

    const result = solveResourceGridNetwork('power', participants);

    assert.equal(result.totalProduced, 8);
    assert.equal(result.connectedDemand, 12);
    assert.equal(result.totalConsumed, 6);
    assert.equal(result.deficit, 4);
    assert.deepEqual(result.consumers, [
        { id: 'clinic', status: 'SUPPLIED', requested: 6, allocated: 6 },
        { id: 'workshop', status: 'SHORTAGE', requested: 6, allocated: 0 },
    ]);
    assert.deepEqual(result.components, [
        {
            id: 0,
            producerIds: ['solar'],
            carrierIds: ['line-1', 'line-2', 'solar'],
            consumerIds: ['clinic', 'workshop'],
            produced: 8,
            connectedDemand: 12,
            consumed: 6,
            deficit: 4,
        },
    ]);
});

test('resource grid solver ignores unrelated network types', () => {
    const participants: ResourceGridParticipant[] = [
        node({ id: 'water-source', networkType: 'water', x: 0, z: 0, roles: ['PRODUCER', 'CARRIER'], production: 20, serviceRadius: 2 }),
        node({ id: 'water-consumer', networkType: 'water', x: 1, z: 0, roles: ['CONSUMER'], demand: 5 }),
        node({ id: 'power-source', networkType: 'power', x: 0, z: 0, roles: ['PRODUCER', 'CARRIER'], production: 9, serviceRadius: 1 }),
        node({ id: 'power-consumer', networkType: 'power', x: 1, z: 0, roles: ['CONSUMER'], demand: 9 }),
    ];

    const result = solveResourceGridNetwork('power', participants);

    assert.equal(result.networkType, 'power');
    assert.equal(result.totalProduced, 9);
    assert.equal(result.connectedDemand, 9);
    assert.equal(result.totalConsumed, 9);
    assert.deepEqual(result.consumers, [
        { id: 'power-consumer', status: 'SUPPLIED', requested: 9, allocated: 9 },
    ]);
});

test('water network delegates connectivity and allocation to the resource grid solver', () => {
    const waterSystem = source('engine/sim/systems/WaterNetworkSystem.ts');
    const adapter = source('engine/sim/resourceGrid/AureusWaterGridAdapter.ts');

    assert.match(waterSystem, /solveResourceGridNetwork\(WATER_NETWORK_TYPE, participants\)/);
    assert.match(waterSystem, /collectAureusWaterGridParticipants\(state\)/);
    assert.equal(waterSystem.includes('const openSet'), false);
    assert.equal(waterSystem.includes('markNearbyConsumersConnected'), false);
    assert.match(adapter, /getResourceGridRoleDef\(tile\.buildingType, WATER_NETWORK_TYPE, 'CARRIER'\)/);
    assert.match(adapter, /getResourceGridConsumerPriority\(tile\.buildingType, WATER_NETWORK_TYPE\)/);
    assert.match(adapter, /tile\.buildingType === BuildingType\.PIPE \|\| tile\.undergroundPipe === true/);
});

test('power grid delegates connectivity and allocation to the resource grid solver', () => {
    const powerSystem = source('engine/sim/systems/PowerGridSystem.ts');
    const adapter = source('engine/sim/resourceGrid/AureusPowerGridAdapter.ts');

    assert.match(powerSystem, /solveResourceGridNetwork\(POWER_NETWORK_TYPE, participants\)/);
    assert.match(powerSystem, /collectAureusPowerGridParticipants\(state\)/);
    assert.equal(powerSystem.includes('const openSet'), false);
    assert.equal(powerSystem.includes('allocatePowerBudget'), false);
    assert.match(adapter, /getResourceGridRoleDef\(tile\.buildingType, POWER_NETWORK_TYPE, 'CARRIER'\)/);
    assert.match(adapter, /getResourceGridConsumerPriority\(tile\.buildingType, POWER_NETWORK_TYPE\)/);
    assert.match(adapter, /getSolarEfficiency\(timeOfDay\)/);
    assert.match(adapter, /weatherEffects\.windMult/);
});

test('Aureus adapters share structure and footprint helper logic', () => {
    const utilities = source('engine/sim/resourceGrid/AureusResourceGridAdapterUtils.ts');
    const waterAdapter = source('engine/sim/resourceGrid/AureusWaterGridAdapter.ts');
    const powerAdapter = source('engine/sim/resourceGrid/AureusPowerGridAdapter.ts');
    const waterSystem = source('engine/sim/systems/WaterNetworkSystem.ts');
    const powerSystem = source('engine/sim/systems/PowerGridSystem.ts');

    assert.match(utilities, /export function isStructureHead/);
    assert.match(utilities, /export function getStructureKey/);
    assert.match(utilities, /export function getResourceParticipantId/);
    assert.match(utilities, /export function setStructureUtilityStatus/);
    assert.match(waterAdapter, /AureusResourceGridAdapterUtils/);
    assert.match(powerAdapter, /AureusResourceGridAdapterUtils/);
    assert.match(waterSystem, /setStructureUtilityStatus\(state, headTile, \{ waterStatus: status, waterShortage \}\)/);
    assert.match(powerSystem, /setStructureUtilityStatus\(state, headTile, \{ powerStatus: status \}\)/);
    assert.equal(waterSystem.includes('ChunkStore'), false);
    assert.equal(powerSystem.includes('ChunkStore'), false);
});

test('static resource grid roles live in declarative data', () => {
    const roleData = source('engine/data/resourceGridRoles.ts');
    const waterAdapter = source('engine/sim/resourceGrid/AureusWaterGridAdapter.ts');
    const powerAdapter = source('engine/sim/resourceGrid/AureusPowerGridAdapter.ts');

    assert.match(roleData, /RESOURCE_GRID_BUILDING_ROLES/);
    assert.match(roleData, /BuildingType\.PIPE/);
    assert.match(roleData, /networkType: 'water'/);
    assert.match(roleData, /roles: \['CARRIER'\]/);
    assert.match(roleData, /serviceRadius: 3/);
    assert.match(roleData, /serviceMetric: 'CHEBYSHEV'/);
    assert.match(roleData, /BuildingType\.POWER_LINE/);
    assert.match(roleData, /networkType: 'power'/);
    assert.match(roleData, /serviceRadius: 1/);
    assert.match(roleData, /serviceMetric: 'MANHATTAN'/);
    assert.match(roleData, /export function getResourceGridConsumerPriority/);
    assert.equal(waterAdapter.includes('function getAureusWaterPriority'), false);
    assert.equal(powerAdapter.includes('function getAureusPowerPriority'), false);
});
