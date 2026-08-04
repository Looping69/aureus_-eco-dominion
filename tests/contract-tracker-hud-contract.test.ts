import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function source(relativePath: string): string {
  const filePath = path.join(process.cwd(), relativePath);
  assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
  return readFileSync(filePath, 'utf8');
}

function assertInOrder(text: string, snippets: string[]): void {
  let index = -1;
  for (const snippet of snippets) {
    const nextIndex = text.indexOf(snippet, index + 1);
    assert.equal(nextIndex > index, true, `Expected '${snippet}' after index ${index}`);
    index = nextIndex;
  }
}

test('ContractTracker presents a compact docket summary when collapsed', () => {
  const tracker = source('components/ContractTracker.tsx');

  assert.match(tracker, /const ContractStatusPill/);
  assert.match(tracker, /const availableCount = contracts\.filter/);
  assert.match(tracker, /const urgentCount = contracts\.filter/);
  assert.match(tracker, /const collapsedTitle = readyCount > 0/);
  assert.match(tracker, /aria-label=\{`Open contracts: \$\{collapsedTitle\}`\}/);
  assert.match(tracker, /title=\{collapsedTitle\}/);
  assert.match(tracker, /hover:-translate-y-0\.5/);
  assert.match(tracker, /\{collapsedTitle\}/);
});

test('ContractTracker expanded header keeps status pills and urgent deadlines visible', () => {
  const tracker = source('components/ContractTracker.tsx');

  assertInOrder(tracker, [
    '<ContractStatusPill label="Ready"',
    '<ContractStatusPill label="Run"',
    '<ContractStatusPill label="New"',
  ]);
  assert.match(tracker, /aria-expanded=\{!isCollapsed\}/);
  assert.match(tracker, /aria-controls="contract-docket-list"/);
  assert.match(tracker, /id="contract-docket-list"/);
  assert.match(tracker, /urgentCount > 0/);
  assert.match(tracker, /urgent deadline\{urgentCount === 1 \? '' : 's'\}/);
});

test('ContractTracker refinement keeps contract command behavior intact', () => {
  const tracker = source('components/ContractTracker.tsx');

  assert.match(tracker, /queueContractCommand\(world, 'ACCEPT_CONTRACT', contract\.id\)/);
  assert.match(tracker, /queueContractCommand\(world, 'DELIVER_CONTRACT', contract\.id\)/);
  assert.match(tracker, /queueContractCommand\(world, 'ABANDON_CONTRACT', contract\.id\)/);
  assert.match(tracker, /createQueuedGameCommandCandidateEnvelope/);
  assert.match(tracker, /GAME_COMMAND_CANDIDATE_SOURCES\.UI/);
  assert.match(tracker, /CONTRACT_TRACKER_COMMAND_REASON/);
});

test('ContractTracker docket uses subtle reveal and hover motion hooks', () => {
  const tracker = source('components/ContractTracker.tsx');

  assert.match(tracker, /animate-in fade-in slide-in-from-bottom-2 duration-200/);
  assert.match(tracker, /transition-\[max-height,opacity,transform\] duration-300 ease-out max-h-\[42rem\] opacity-100 translate-y-0/);
  assert.match(tracker, /transition-colors duration-200 hover:border-slate-700/);
});
