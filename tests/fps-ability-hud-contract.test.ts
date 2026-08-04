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

test('FPS ability HUD is a collapsible field kit with persistent status', () => {
  const hud = source('components/FPSAbilityHUD.tsx');

  assert.match(hud, /import \{ ChevronDown \} from 'lucide-react'/);
  assert.match(hud, /const \[isCollapsed, setIsCollapsed\] = React\.useState\(false\)/);
  assert.match(hud, /aria-expanded=\{!isCollapsed\}/);
  assert.match(hud, /aria-controls="fps-ability-actions"/);
  assert.match(hud, /id="fps-ability-actions"/);
  assert.match(hud, /setIsCollapsed\(value => !value\)/);
  assert.match(hud, /title=\{isCollapsed \? 'Expand FPS abilities' : 'Collapse FPS abilities'\}/);
  assert.match(hud, /\{message \|\| 'LMB aim \/ RMB order'\}/);
});

test('FPS ability HUD keeps the ability order and subtle motion hooks', () => {
  const hud = source('components/FPSAbilityHUD.tsx');

  assertInOrder(hud, [
    "{ key: 'Q', label: 'Scan', ability: 'SCAN' }",
    "{ key: 'E', label: 'Harvest', ability: 'HARVEST' }",
    "{ key: 'R', label: 'Restore', ability: 'RESTORE' }",
    "{ key: 'F', label: 'Dig', ability: 'DIG' }",
    "{ key: 'G', label: 'Move Order', ability: 'MOVE' }",
  ]);

  assert.match(hud, /transition-\[max-height,opacity,transform\]/);
  assert.match(hud, /isCollapsed \? '-rotate-90' : 'rotate-0'/);
  assert.match(hud, /isCollapsed \? 'max-h-0 translate-y-1 opacity-0' : 'max-h-28 translate-y-0 opacity-100'/);
  assert.match(hud, /message && !isCollapsed/);
});
