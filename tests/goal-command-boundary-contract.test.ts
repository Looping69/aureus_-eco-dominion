import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const useEnginePath = path.join(root, 'game', 'useAureusEngine.ts');
const dispatcherPath = path.join(root, 'engine', 'sim', 'systems', 'CommandDispatcher.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('goal claims cross the shared command boundary instead of reloading game state', () => {
  const hookText = source(useEnginePath);
  const dispatcherText = source(dispatcherPath);

  for (const snippet of [
    "if (action?.type === 'CLAIM_GOAL')",
    "enqueueWorldCommand(world, 'CLAIM_GOAL');",
  ]) {
    assertSnippet(hookText, snippet);
  }

  assert.doesNotMatch(
    hookText,
    /if \(action\?\.type === 'CLAIM_GOAL'\)[\s\S]*?reloadWorldState\(world, updatedState\)/,
  );

  for (const snippet of [
    "commandType === 'CLAIM_GOAL'",
    'private claimGoal(state: GameState): CommandResult',
    "reason: 'No active goal to claim.'",
    "reason: 'Active goal is not complete yet.'",
    'state.resources.agt += goal.reward.amount;',
    'state.resources.gems += goal.reward.amount;',
    'state.pendingEffects.push({ type: \'AUDIO\', sfx: SfxType.COMPLETE });',
    'state.activeGoal = null;',
  ]) {
    assertSnippet(dispatcherText, snippet);
  }
});

test('goal claim news ids are deterministic for a tick and goal', () => {
  const dispatcherText = source(dispatcherPath);
  assertSnippet(dispatcherText, 'id: `goal_claim_${state.tickCount}_${goal.id}`');
  assert.doesNotMatch(dispatcherText, /id: `goal_claim_\$\{Date\.now\(\)\}/);
});
