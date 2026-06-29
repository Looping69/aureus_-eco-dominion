import test from 'node:test';
import assert from 'node:assert/strict';

import { solveResourceGridNetwork } from '../engine/sim/resourceGrid/ResourceGridSolver.ts';
import type { ResourceGridParticipant } from '../engine/sim/resourceGrid/ResourceGridSolver.ts';

function node(partial: ResourceGridParticipant): ResourceGridParticipant {
    return partial;
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
