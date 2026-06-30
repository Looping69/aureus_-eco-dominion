import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { StateManager } from '../engine/state/StateManager.ts';
import { ChunkStore } from '../engine/space/ChunkStore.ts';
import { collectAureusWaterGridParticipants } from '../engine/sim/resourceGrid/AureusWaterGridAdapter.ts';
import { collectAureusPowerGridParticipants } from '../engine/sim/resourceGrid/AureusPowerGridAdapter.ts';
import { solveResourceGridNetwork } from '../engine/sim/resourceGrid/ResourceGridSolver.ts';
import { BuildingType } from '../types.ts';
import type { GameState, GridTile } from '../types.ts';
import type { ResourceGridParticipant } from '../engine/sim/resourceGrid/ResourceGridSolver.ts';

function node(partial: ResourceGridParticipant): ResourceGridParticipant {
    return partial;
}

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

function tile(state: GameState, x: number, z: number): GridTile {
    const found = ChunkStore.getTile(state.chunks, x, z);
    assert.ok(found, `expected tile at ${x},${z}`);
    return found;
}

function clearWorld(state: GameState): void {
    for (const chunk of Object.values(state.chunks)) {
        for (const target of chunk.tiles) {
            Object.assign(target, {
                buildingType: BuildingType.EMPTY,
                level: 1,
                foliage: 'NONE',
                isUnderConstruction: false,
                constructionTimeLeft: 0,
                structureHeadX: undefined,
                structureHeadZ: undefined,
                powerStatus: undefined,
                waterStatus: undefined,
                waterShortage: undefined,
                undergroundPipe: undefined,
            });
        }
    }
}

function place(state: GameState, x: number, z: number, buildingType: BuildingType): GridTile {
    const target = tile(state, x, z);
    Object.assign(target, {
        buildingType,
        level: 1,
        foliage: 'NONE',
        isUnderConstruction: false,
        constructionTimeLeft: 0,
        structureHeadX: undefined,
        structureHeadZ: undefined,
        powerStatus: undefined,
        waterStatus: undefined,
        waterShortage: undefined,
        undergroundPipe: undefined,
    });
    return target;
}

function participantAt(participants: ResourceGridParticipant[], x: number, z: number, role: ResourceGridParticipant['roles'][number]): ResourceGridParticipant {
    const participant = participants.find((entry) => entry.x === x && entry.z === z && entry.roles.includes(role));
    assert.ok(participant, `expected ${role} participant at ${x},${z}`);
    return participant;
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

test('Aureus water adapter collects schema-backed production and demand amounts', () => {
    const state = new StateManager({ cheatsEnabled: true }).getMutableState();
    clearWorld(state);

    place(state, 0, 0, BuildingType.WATER_WELL);
    place(state, 1, 0, BuildingType.PIPE);
    place(state, 2, 0, BuildingType.STAFF_QUARTERS);
    place(state, 3, 0, BuildingType.WASH_PLANT);

    const { participants } = collectAureusWaterGridParticipants(state);
    const well = participantAt(participants, 0, 0, 'PRODUCER');
    const pipe = participantAt(participants, 1, 0, 'CARRIER');
    const housing = participantAt(participants, 2, 0, 'CONSUMER');
    const washPlant = participantAt(participants, 3, 0, 'CONSUMER');

    assert.deepEqual(well.roles, ['CARRIER', 'PRODUCER']);
    assert.equal(well.production, 10);
    assert.equal(well.demand, 0);
    assert.equal(well.serviceRadius, 3);
    assert.equal(well.serviceMetric, 'CHEBYSHEV');
    assert.deepEqual(pipe.roles, ['CARRIER']);
    assert.equal(pipe.production, 0);
    assert.equal(pipe.demand, 0);
    assert.equal(housing.demand, 1);
    assert.equal(housing.priority, 100);
    assert.equal(washPlant.demand, 5);
    assert.equal(washPlant.priority, 65);
});

test('Aureus power adapter collects schema-backed production and demand amounts', () => {
    const state = new StateManager({ cheatsEnabled: true }).getMutableState();
    clearWorld(state);

    place(state, 10, 0, BuildingType.GENERATOR);
    place(state, 11, 0, BuildingType.POWER_LINE);
    place(state, 12, 0, BuildingType.RESERVOIR);
    place(state, 13, 0, BuildingType.SPACEPORT);

    const { participants } = collectAureusPowerGridParticipants(state);
    const generator = participantAt(participants, 10, 0, 'PRODUCER');
    const powerLine = participantAt(participants, 11, 0, 'CARRIER');
    const reservoir = participantAt(participants, 12, 0, 'CONSUMER');
    const spaceport = participantAt(participants, 13, 0, 'CONSUMER');

    assert.deepEqual(generator.roles, ['CARRIER', 'PRODUCER']);
    assert.equal(generator.production, 10);
    assert.equal(generator.demand, 0);
    assert.equal(generator.serviceRadius, 1);
    assert.equal(generator.serviceMetric, 'MANHATTAN');
    assert.deepEqual(powerLine.roles, ['CARRIER']);
    assert.equal(powerLine.production, 0);
    assert.equal(powerLine.demand, 0);
    assert.equal(reservoir.demand, 2);
    assert.equal(reservoir.priority, 100);
    assert.equal(spaceport.demand, 100);
    assert.equal(spaceport.priority, 50);
});

test('water network delegates connectivity and allocation to the resource grid solver', () => {
    const waterSystem = source('engine/sim/systems/WaterNetworkSystem.ts');
    const adapter = source('engine/sim/resourceGrid/AureusWaterGridAdapter.ts');

    assert.match(waterSystem, /solveResourceGridNetwork\(WATER_NETWORK_TYPE, participants\)/);
    assert.match(waterSystem, /collectAureusWaterGridParticipants\(state\)/);
    assert.equal(waterSystem.includes('const openSet'), false);
    assert.equal(waterSystem.includes('markNearbyConsumersConnected'), false);
    assert.match(adapter, /getResourceGridRoleDef\(tile\.buildingType, WATER_NETWORK_TYPE, 'CARRIER'\)/);
    assert.match(adapter, /getResourceGridRoleDef\(tile\.buildingType, WATER_NETWORK_TYPE, 'PRODUCER'\)/);
    assert.match(adapter, /getResourceGridRoleDef\(tile\.buildingType, WATER_NETWORK_TYPE, 'CONSUMER'\)/);
    assert.match(adapter, /getResourceGridConsumerPriority\(tile\.buildingType, WATER_NETWORK_TYPE\)/);
    assert.match(adapter, /producerDef\.baseProduction/);
    assert.match(adapter, /consumerDef\.baseDemand/);
    assert.match(adapter, /modifiers\.includes\('POND_WEATHER'\)/);
    assert.match(adapter, /modifiers\.includes\('RESERVOIR_POWER_DEPENDENCY'\)/);
    assert.match(adapter, /tile\.buildingType === BuildingType\.PIPE \|\| tile\.undergroundPipe === true/);
    assert.equal(adapter.includes('BUILDINGS'), false);
    assert.equal(adapter.includes('def?.water?.produces'), false);
    assert.equal(adapter.includes('def?.water?.consumes'), false);
});

test('power grid delegates connectivity and allocation to the resource grid solver', () => {
    const powerSystem = source('engine/sim/systems/PowerGridSystem.ts');
    const adapter = source('engine/sim/resourceGrid/AureusPowerGridAdapter.ts');

    assert.match(powerSystem, /solveResourceGridNetwork\(POWER_NETWORK_TYPE, participants\)/);
    assert.match(powerSystem, /collectAureusPowerGridParticipants\(state\)/);
    assert.equal(powerSystem.includes('const openSet'), false);
    assert.equal(powerSystem.includes('allocatePowerBudget'), false);
    assert.match(adapter, /getResourceGridRoleDef\(tile\.buildingType, POWER_NETWORK_TYPE, 'CARRIER'\)/);
    assert.match(adapter, /getResourceGridRoleDef\(tile\.buildingType, POWER_NETWORK_TYPE, 'PRODUCER'\)/);
    assert.match(adapter, /getResourceGridRoleDef\(tile\.buildingType, POWER_NETWORK_TYPE, 'CONSUMER'\)/);
    assert.match(adapter, /getResourceGridConsumerPriority\(tile\.buildingType, POWER_NETWORK_TYPE\)/);
    assert.match(adapter, /producerDef\.baseProduction/);
    assert.match(adapter, /consumerDef\.baseDemand/);
    assert.match(adapter, /modifiers\.includes\('SOLAR_DAYLIGHT'\)/);
    assert.match(adapter, /modifiers\.includes\('WIND_WEATHER'\)/);
    assert.equal(adapter.includes('BUILDINGS'), false);
    assert.equal(adapter.includes('def.power?.produces'), false);
    assert.equal(adapter.includes('def.power?.consumes'), false);
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

test('static resource grid roles live in declarative schema data', () => {
    const roleData = source('engine/data/resourceGridRoles.ts');
    const roleSchema = source('engine/data/resourceGridRoleSchema.ts');
    const waterAdapter = source('engine/sim/resourceGrid/AureusWaterGridAdapter.ts');
    const powerAdapter = source('engine/sim/resourceGrid/AureusPowerGridAdapter.ts');

    assert.match(roleData, /RESOURCE_GRID_BUILDING_ROLES/);
    assert.match(roleData, /buildResourceGridBuildingRoles\(RESOURCE_GRID_ROLE_SCHEMA\)/);
    assert.match(roleData, /export function getResourceGridConsumerPriority/);
    assert.match(roleSchema, /ResourceGridProductionModifier/);
    assert.match(roleSchema, /baseProduction\?: number/);
    assert.match(roleSchema, /baseDemand\?: number/);
    assert.match(roleSchema, /buildingType: 'PIPE'/);
    assert.match(roleSchema, /networkType: 'water'/);
    assert.match(roleSchema, /roles: \['CARRIER'\]/);
    assert.match(roleSchema, /serviceRadius: 3/);
    assert.match(roleSchema, /serviceMetric: 'CHEBYSHEV'/);
    assert.match(roleSchema, /buildingType: 'POND'/);
    assert.match(roleSchema, /baseProduction: 5/);
    assert.match(roleSchema, /productionModifiers: \['POND_WEATHER'\]/);
    assert.match(roleSchema, /buildingType: 'WATER_WELL'/);
    assert.match(roleSchema, /baseProduction: 10/);
    assert.match(roleSchema, /buildingType: 'RESERVOIR'/);
    assert.match(roleSchema, /baseProduction: 50/);
    assert.match(roleSchema, /baseDemand: 2, priority: 100/);
    assert.match(roleSchema, /productionModifiers: \['RESERVOIR_POWER_DEPENDENCY'\]/);
    assert.match(roleSchema, /buildingType: 'POWER_LINE'/);
    assert.match(roleSchema, /networkType: 'power'/);
    assert.match(roleSchema, /serviceRadius: 1/);
    assert.match(roleSchema, /serviceMetric: 'MANHATTAN'/);
    assert.match(roleSchema, /buildingType: 'SOLAR_ARRAY'/);
    assert.match(roleSchema, /baseProduction: 5/);
    assert.match(roleSchema, /productionModifiers: \['SOLAR_DAYLIGHT'\]/);
    assert.match(roleSchema, /buildingType: 'WIND_TURBINE'/);
    assert.match(roleSchema, /baseProduction: 8/);
    assert.match(roleSchema, /productionModifiers: \['WIND_WEATHER'\]/);
    assert.match(roleSchema, /buildingType: 'GENERATOR'/);
    assert.match(roleSchema, /baseProduction: 10/);
    assert.match(roleSchema, /buildingType: 'GEOTHERMAL_PLANT'/);
    assert.match(roleSchema, /baseProduction: 50/);
    assert.match(roleSchema, /buildingType: 'SPACEPORT'/);
    assert.match(roleSchema, /baseDemand: 100/);
    assert.equal(waterAdapter.includes('function getAureusWaterPriority'), false);
    assert.equal(powerAdapter.includes('function getAureusPowerPriority'), false);
});
