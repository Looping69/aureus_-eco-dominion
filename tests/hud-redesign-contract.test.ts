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

test('HUD uses cockpit clusters instead of one long resource strip', () => {
  const hud = source('components/HUD.tsx');

  assert.match(hud, /const HUDCluster/);
  assert.match(hud, /aria-label=\{`\$\{label\} HUD cluster`\}/);
  assert.match(hud, /max-w-\[88rem\]/);
  assert.match(hud, /sm:flex-row/);
  assert.doesNotMatch(hud, /flex flex-wrap gap-2 sm:gap-3 pointer-events-none items-start justify-start sm:justify-center/);
});

test('HUD groups gameplay signals by player intent', () => {
  const hud = source('components/HUD.tsx');

  assertInOrder(hud, [
    'label="Core"',
    "toggleBlock('era'",
    "toggleBlock('agt'",
    "toggleBlock('eco'",
    "toggleBlock('trust'",
    "toggleBlock('pop'",
    'label="Materials"',
    "toggleBlock('minerals'",
    "toggleBlock('wood'",
    "toggleBlock('stone'",
    "toggleBlock('gems'",
    'label="Industry / Logistics"',
    "toggleBlock('refined'",
    "toggleBlock('alloys'",
    "toggleBlock('parts'",
    "toggleBlock('kits'",
    "toggleBlock('chains'",
    "toggleBlock('grid'",
    "toggleBlock('flow'",
    "toggleBlock('rail'",
    "toggleBlock('charge'",
    '<MarketBlock state={state}',
  ]);
});
