import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFactoryDashboardMetrics } from '../game/factoryDashboard.ts';
import type { GameState } from '../types.ts';

const baseState = {
    grid: [
        { id: 0, x: 0, y: 0, buildingType: 'EMPTY', level: 1, terrainHeight: 0, biome: 'GRASS' },
        { id: 1, x: 1, y: 0, buildingType: 'WASH_PLANT', level: 1, terrainHeight: 0, biome: 'GRASS' },
        { id: 2, x: 2, y: 0, buildingType: 'SOLAR_ARRAY', level: 1, terrainHeight: 0, biome: 'GRASS', isUnderConstruction: true },
    ],
    agents: [],
    jobs: [
        { id: 'pending', type: 'BUILD', targetTileId: 1, priority: 3, assignedAgentId: null },
        { id: 'assigned', type: 'MINE', targetTileId: 2, priority: 2, assignedAgentId: 'agent_1' },
    ],
    resources: {
        agt: 1000,
        minerals: 123.9,
        gems: 0,
        eco: 80,
        trust: 70,
        income: 18,
        maintenance: 5,
    },
    inventory: {},
    selectedBuilding: null,
    selectedAgentId: null,
    interactionMode: 'BUILD',
    viewMode: 'SURFACE',
    step: 'PLAYING',
    tickCount: 0,
    logistics: { autoSell: false, sellThreshold: 100 },
    activeGoal: null,
    newsFeed: [],
    activeEvents: [],
    research: { unlocked: [] },
    debugMode: false,
    cheatsEnabled: false,
    pendingEffects: [],
    market: {
        minerals: { basePrice: 10, currentPrice: 10, trend: 'STABLE', history: [10], volatility: 0.1 },
        gems: { basePrice: 50, currentPrice: 50, trend: 'STABLE', history: [50], volatility: 0.05 },
        eventDuration: 0,
    },
    contracts: [],
    weather: { current: 'CLEAR', timeLeft: 300, intensity: 0 },
    dayNightCycle: { timeOfDay: 6000, dayCount: 1, isDaytime: true },
    currentEra: 'SETTLEMENT',
    unlockedEras: ['SETTLEMENT'],
    powerGrid: { totalProduced: 12, totalConsumed: 18, deficit: 6 },
    waterNetwork: { totalProduced: 20, totalConsumed: 15, deficit: 0 },
    agentRequests: [],
    commandQueue: [],
} satisfies GameState;

test('buildFactoryDashboardMetrics summarizes factory pressure from game state', () => {
    const metrics = buildFactoryDashboardMetrics(baseState);

    assert.equal(metrics.constructedBuildings, 1);
    assert.equal(metrics.underConstruction, 1);
    assert.equal(metrics.pendingJobs, 1);
    assert.equal(metrics.assignedJobs, 1);
    assert.equal(metrics.powerBalance, -6);
    assert.equal(metrics.waterBalance, 5);
    assert.equal(metrics.oreStockpile, 123);
    assert.equal(metrics.netAgtPerSecond, 13);
});
