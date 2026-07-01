import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function source(relativePath: string): string {
    const filePath = path.join(root, relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} is missing`);
    return readFileSync(filePath, 'utf8');
}

test('AureusWorld registers the combat simulation system', () => {
    const world = source('game/AureusWorld.ts');

    assert.match(world, /CombatSystem/);
    assert.match(world, /this\.sim\.addSystem\(new CombatSystem\(\)\)/);
    assert.equal(world.includes("from '../engine/sim/systems/CombatSystem'"), false);
});
