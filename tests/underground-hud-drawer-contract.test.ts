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

test('UndergroundHUD exposes persistent drawer summaries for ledger and console', () => {
  const hud = source('components/UndergroundHUD.tsx');

  assert.match(hud, /const UndergroundSummaryPill/);
  assert.match(hud, /const activeModeLabel = modeOptions\.find/);
  assert.match(hud, /aria-expanded=\{!ledgerCollapsed\}/);
  assert.match(hud, /aria-controls="deep-ledger-body"/);
  assert.match(hud, /id="deep-ledger-body"/);
  assert.match(hud, /aria-expanded=\{!consoleCollapsed\}/);
  assert.match(hud, /aria-controls="mine-console-body"/);
  assert.match(hud, /id="mine-console-body"/);

  assertInOrder(hud, [
    '<UndergroundSummaryPill label="Stab"',
    '<UndergroundSummaryPill label="O2"',
    '<UndergroundSummaryPill label="Haz"',
    '<UndergroundSummaryPill label="Rub"',
  ]);
});

test('UndergroundHUD drawer bodies use subtle motion instead of hard unmounts', () => {
  const hud = source('components/UndergroundHUD.tsx');

  assert.match(hud, /transition-\[max-height,opacity,transform\] duration-300 ease-out/);
  assert.match(hud, /ledgerCollapsed \? 'max-h-0 -translate-y-1 opacity-0' : 'max-h-80 translate-y-0 opacity-100'/);
  assert.match(hud, /consoleCollapsed \? 'max-h-0 -translate-y-1 opacity-0' : 'max-h-\[42rem\] translate-y-0 opacity-100'/);
  assert.match(hud, /ledgerCollapsed \? '-rotate-90' : 'rotate-0'/);
  assert.match(hud, /consoleCollapsed \? '-rotate-90' : 'rotate-0'/);
  assert.doesNotMatch(hud, /!ledgerCollapsed && \(/);
  assert.doesNotMatch(hud, /!consoleCollapsed && \(/);
});

test('UndergroundHUD keeps dungeon action emissions intact', () => {
  const hud = source('components/UndergroundHUD.tsx');

  assert.match(hud, /emitDungeonAction\('SET_MODE', \{ mode \}\)/);
  assert.match(hud, /emitDungeonAction\('HIRE_MINER', \{ minerType \}\)/);
  assert.match(hud, /emitDungeonAction\('SURFACE_RESOURCES'\)/);
  assert.match(hud, /window\.dispatchEvent\(new CustomEvent\('aureus:dungeon-action'/);
});
