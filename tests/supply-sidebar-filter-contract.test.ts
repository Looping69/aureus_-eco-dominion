import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const supplySidebarPath = path.join(root, 'components', 'SupplySidebar.tsx');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('supply sidebar can remove all active building list filters', () => {
  const sidebarText = source(supplySidebarPath);

  for (const snippet of [
    'FilterX',
    "const hasActiveFilters = activeCategory !== 'ALL' || searchQuery.trim().length > 0;",
    'const clearFilters = () => {',
    "setActiveCategory('ALL');",
    "setSearchQuery('');",
    'title="Remove filters"',
    'disabled={!hasActiveFilters}',
    '<FilterX size={14} />',
    '<span className="hidden sm:inline">Clear</span>',
  ]) {
    assertSnippet(sidebarText, snippet);
  }
});
