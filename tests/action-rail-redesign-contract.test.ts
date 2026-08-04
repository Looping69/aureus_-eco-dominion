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

test('Controls keeps Ops and Build as persistent action rail anchors', () => {
  const controls = source('components/Controls.tsx');

  assertInOrder(controls, [
    "setSidebarOpen('OPS')",
    'Command Rail',
    "setSidebarOpen('SHOP')",
  ]);
  assert.match(controls, /highlightOps \? 'animate-bounce border-emerald-400 z-50' : ''/);
  assert.match(controls, /highlightBuild \? 'highlight-pulse z-50 ring-4 ring-emerald-400' : ''/);
});

test('Controls center command rail is collapsible with a persistent summary', () => {
  const controls = source('components/Controls.tsx');

  assert.match(controls, /ChevronDown/);
  assert.match(controls, /id="command-rail-toggle"/);
  assert.match(controls, /type="checkbox"/);
  assert.match(controls, /defaultChecked/);
  assert.match(controls, /className="peer sr-only"/);
  assert.match(controls, /htmlFor="command-rail-toggle"/);
  assert.match(controls, /role="button"/);
  assert.match(controls, /id="command-rail-actions"/);
  assert.match(controls, /title="Toggle command rail"/);

  assertInOrder(controls, [
    'const modeLabel',
    'const overlayLabel',
    'const layerLabel',
    '{modeLabel}',
    '{overlayLabel}',
    '{layerLabel}',
  ]);
});

test('Controls command rail uses subtle CSS-only collapse motion', () => {
  const controls = source('components/Controls.tsx');

  assert.match(controls, /transition-\[max-height,opacity,transform\]/);
  assert.match(controls, /-rotate-90 text-slate-500 transition-transform duration-300 ease-out peer-checked:rotate-0/);
  assert.match(controls, /max-h-0 translate-y-1 overflow-hidden opacity-0/);
  assert.match(controls, /peer-checked:max-h-\[9rem\] peer-checked:translate-y-0 peer-checked:opacity-100/);
});
