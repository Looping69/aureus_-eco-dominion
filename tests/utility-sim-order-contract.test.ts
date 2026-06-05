import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const simulationSource = readFileSync(path.join(process.cwd(), 'engine', 'sim', 'Simulation.ts'), 'utf8');
const constructionSource = readFileSync(path.join(process.cwd(), 'engine', 'sim', 'systems', 'ConstructionSystem.ts'), 'utf8');
const powerSource = readFileSync(path.join(process.cwd(), 'engine', 'sim', 'systems', 'PowerGridSystem.ts'), 'utf8');
const waterSource = readFileSync(path.join(process.cwd(), 'engine', 'sim', 'systems', 'WaterNetworkSystem.ts'), 'utf8');
const productionSource = readFileSync(path.join(process.cwd(), 'engine', 'sim', 'systems', 'ProductionSystem.ts'), 'utf8');

function priorityOf(source: string): number {
    const match = source.match(/readonly priority = (\d+);/);
    assert.ok(match, 'System priority declaration is missing');
    return Number(match[1]);
}

test('simulation runs higher priority systems first', () => {
    assert.match(simulationSource, /this\.systems\.sort\(\(a, b\) => b\.priority - a\.priority\);/);
});

test('utility networks recalculate before production consumes utility state', () => {
    const constructionPriority = priorityOf(constructionSource);
    const powerPriority = priorityOf(powerSource);
    const waterPriority = priorityOf(waterSource);
    const productionPriority = priorityOf(productionSource);

    assert.ok(constructionPriority > powerPriority, 'construction must settle placement before utility scans');
    assert.ok(powerPriority > waterPriority, 'power must run before water because reservoirs can depend on power state');
    assert.ok(waterPriority > productionPriority, 'water must run before production so buildings do not use stale water state');

    assert.equal(powerPriority, 45);
    assert.equal(waterPriority, 44);
    assert.equal(productionPriority, 25);
});

test('production still gates output by current power and water status', () => {
    assert.match(productionSource, /if \(tile\.powerStatus !== 'CONNECTED'\)/);
    assert.match(productionSource, /state\.powerGrid\?\.deficit > 0/);
    assert.match(productionSource, /if \(tile\.waterStatus !== 'CONNECTED'\)/);
    assert.match(productionSource, /state\.waterNetwork\?\.deficit > 0/);
});
