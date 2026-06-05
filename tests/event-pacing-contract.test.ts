import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const eventSystemPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'EventSystem.ts');
const aiLogicPath = path.join(process.cwd(), 'engine', 'sim', 'logic', 'AiLogic.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('world events use a slower cadence and lower random-event odds', () => {
  assert.equal(existsSync(eventSystemPath), true, 'EventSystem.ts is missing');
  assert.equal(existsSync(aiLogicPath), true, 'AiLogic.ts is missing');

  const eventSystem = readFileSync(eventSystemPath, 'utf8');
  const aiLogic = readFileSync(aiLogicPath, 'utf8');

  for (const snippet of [
    'private readonly EVENT_CHECK_INTERVAL = 180.0; // Seconds',
    'if (ctx.time - this.lastEventCheck > this.EVENT_CHECK_INTERVAL) {',
  ]) {
    assert.match(eventSystem, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'const dustStormChance = eco < 50 ? Math.min(0.12, 0.035 + ((50 - eco) / 700)) : 0;',
    'if (r < 0.12) {',
    'if (r < 0.22) {',
    'if (r < 0.30) {',
  ]) {
    assert.match(aiLogic, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(eventSystem, /EVENT_CHECK_INTERVAL = 30\.0/);
  assert.doesNotMatch(aiLogic, /const dustStormChance = eco < 50 \? 0\.22/);
  assert.doesNotMatch(aiLogic, /if \(r < 0\.45\)/);
  assert.doesNotMatch(aiLogic, /if \(r < 0\.6\)/);
  assert.doesNotMatch(aiLogic, /if \(r < 0\.75\)/);
});

test('illegal miner incursions are super rare and spawn a single camp', () => {
  assert.equal(existsSync(aiLogicPath), true, 'AiLogic.ts is missing');

  const aiLogic = readFileSync(aiLogicPath, 'utf8');

  for (const snippet of [
    '// 5. INCURSION (Super rare)',
    'if (r > 0.9985) {',
    "chunk.tiles[tIdx] = { ...chunk.tiles[tIdx], foliage: 'ILLEGAL_CAMP' };",
    "newAgents.push(createColonist(tile.x, tile.z, 'ILLEGAL_MINER'));",
  ]) {
    assert.match(aiLogic, new RegExp(escapeRegExp(snippet)));
  }

  assert.doesNotMatch(aiLogic, /if \(r > 0\.95\)/);
  assert.doesNotMatch(aiLogic, /for \(let i = 0; i < 3; i\+\+\)/);
});
