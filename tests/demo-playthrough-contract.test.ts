import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const demoSource = readFileSync('engine/sim/systems/TutorialDemoSystem.ts', 'utf8');
const homeSource = readFileSync('components/HomePage.tsx', 'utf8');

test('demo is a five-minute guided playthrough, not an instant catalogue', () => {
    assert.match(demoSource, /const DEMO_DURATION_SECONDS = 300;/);
    assert.match(demoSource, /GUIDED DEMO: FIVE-MINUTE COLONY STARTUP BEGINNING\./);
    assert.match(demoSource, /delay: 250,/);
    assert.match(demoSource, /this\.addTask\(DEMO_DURATION_SECONDS/);
    assert.doesNotMatch(demoSource, /CATALOGUE COMPLETE/);
    assert.doesNotMatch(demoSource, /ALL BUILDINGS AND UPGRADE TIERS DEPLOYED/);
    assert.doesNotMatch(demoSource, /getDemoBuildings/);
    assert.doesNotMatch(demoSource, /Object\.entries\(BUILDINGS\)/);
});

test('guided demo stages mirror real game progression', () => {
    const expectedBuildings = [
        'BuildingType.STAFF_QUARTERS',
        'BuildingType.CANTEEN',
        'BuildingType.WATER_WELL',
        'BuildingType.GENERATOR',
        'BuildingType.MINING_HEADFRAME',
        'BuildingType.SAWMILL',
        'BuildingType.STONE_QUARRY',
        'BuildingType.WASH_PLANT',
        'BuildingType.ORE_FOUNDRY',
        'BuildingType.SOLAR_ARRAY',
        'BuildingType.WIND_TURBINE',
        'BuildingType.WORKSHOP',
        'BuildingType.DISTRIBUTION_HUB',
        'BuildingType.COMMUNITY_GARDEN',
        'BuildingType.RECYCLING_PLANT',
        'BuildingType.TRAIN_STATION',
        'BuildingType.SURVEY_DRILL',
    ];

    for (const building of expectedBuildings) {
        assert.match(demoSource, new RegExp(building.replace('.', '\\.')));
    }

    assert.match(demoSource, /overlayMode: 'FLOW'/);
    assert.match(demoSource, /overlayMode: 'JUNCTIONS'/);
    assert.match(demoSource, /Era\.GROWTH/);
    assert.match(demoSource, /Era\.INDUSTRY/);
    assert.match(demoSource, /machineParts: 15/);
    assert.match(demoSource, /automationKits: 2/);
});

test('home screen presents the demo as a guided run', () => {
    assert.match(homeSource, />Guided Demo</);
    assert.match(homeSource, />5-Min Run</);
    assert.doesNotMatch(homeSource, />Play Demo</);
    assert.doesNotMatch(homeSource, />Auto-Sim</);
});
