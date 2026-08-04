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

test('HUD clusters are cleanly collapsible with persistent summaries', () => {
  const hud = source('components/HUD.tsx');

  assert.match(hud, /import \{ ChevronDown,/);
  assert.match(hud, /const HUDSummaryPill/);
  assert.match(hud, /const \[collapsedClusters, setCollapsedClusters\] = useState<Record<string, boolean>>\(\{\}\)/);
  assert.match(hud, /aria-expanded=\{!collapsed\}/);
  assert.match(hud, /aria-controls=\{contentId\}/);
  assert.match(hud, /style=\{\{ gridTemplateRows: collapsed \? '0fr' : '1fr' \}\}/);
  assert.match(hud, /transition-\[grid-template-rows,opacity,transform\]/);
  assert.match(hud, /collapsed \? '-rotate-90' : 'rotate-0'/);

  assertInOrder(hud, [
    '<HUDSummaryPill label="AGT"',
    '<HUDSummaryPill label="Eco"',
    '<HUDSummaryPill label="Pop"',
    '<HUDSummaryPill label="Ore"',
    '<HUDSummaryPill label="Wood"',
    '<HUDSummaryPill label="Stone"',
    '<HUDSummaryPill label="Grid"',
    '<HUDSummaryPill label="Flow"',
    '<HUDSummaryPill label="Rail"',
  ]);
});

test('collapsing a HUD cluster clears an expanded block inside that cluster', () => {
  const hud = source('components/HUD.tsx');

  assert.match(hud, /const CLUSTER_BLOCK_IDS: Record<string, string\[\]>/);
  assert.match(hud, /core: \['era', 'agt', 'eco', 'trust', 'pop'\]/);
  assert.match(hud, /materials: \['minerals', 'wood', 'stone', 'gems'\]/);
  assert.match(hud, /industry: \['refined', 'alloys', 'parts', 'kits', 'chains', 'grid', 'flow', 'rail', 'charge', 'market'\]/);
  assert.match(hud, /if \(nextCollapsed && activeBlock && CLUSTER_BLOCK_IDS\[clusterId\]\.includes\(activeBlock\)\) \{/);
  assert.match(hud, /onToggleBlock\(null\);/);
});
