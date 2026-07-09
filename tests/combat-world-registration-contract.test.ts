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

test('AureusWorld registers the combat simulation system for live ticks and command routing', () => {
    const world = source('game/AureusWorld.ts');

    assert.match(world, /CombatSystem/);
    assert.match(world, /private combatSystem: CombatSystem;/);
    assert.match(world, /this\.combatSystem = new CombatSystem\(\);/);
    assert.match(world, /this\.sim\.addSystem\(this\.combatSystem\);/);
    assert.ok(
        world.indexOf('this.agentSystem,') < world.indexOf('this.combatSystem,'),
        'combat commands should be routed after agent commands are offered to the agent system',
    );
    assert.equal(world.includes("from '../engine/sim/systems/CombatSystem'"), false);
});
