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

  assert.match(controls, /import React, \{ useState \} from 'react'/);
  assert.match(controls, /ChevronDown/);
  assert.match(controls, /const \[commandRailCollapsed, setCommandRailCollapsed\] = useState\(false\)/);
  assert.match(controls, /const commandRailActions = \(/);
  assert.match(controls, /aria-expanded=\{!commandRailCollapsed\}/);
  assert.match(controls, /aria-controls="command-rail-actions"/);
  assert.match(controls, /id="command-rail-actions"/);
  assert.match(controls, /setCommandRailCollapsed\(value => !value\)/);
  assert.match(controls, /title=\{commandRailCollapsed \? 'Expand command rail' : 'Collapse command rail'\}/);

  assertInOrder(controls, [
    'const modeLabel',
    'const overlayLabel',
    'const layerLabel',
    '{modeLabel}',
    '{overlayLabel}',
    '{layerLabel}',
  ]);
});

test('Controls command rail uses subtle collapse motion instead of abrupt removal', () => {
  const controls = source('components/Controls.tsx');

  assert.match(controls, /transition-\[max-height,opacity,transform\]/);
  assert.match(controls, /commandRailCollapsed \? '-rotate-90' : 'rotate-0'/);
  assert.match(controls, /commandRailCollapsed \? 'pointer-events-none max-h-0 translate-y-1 opacity-0' : 'max-h-\[9rem\] translate-y-0 opacity-100'/);
});
