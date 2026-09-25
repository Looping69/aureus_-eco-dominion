import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { externalEngineImports } from '../scripts/check-engine-boundary.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('boundary resolves relative imports and recognizes game-owned code', () => {
  const filename = path.join(root, 'engine/state/Store.ts');
  const imports = externalEngineImports(
    "import type { GameState } from '../../types';\nexport { App } from '../../game/App';\nimport { Queue } from '../kernel/Queue';",
    filename,
    root,
  );
  assert.deepEqual(imports, [
    { source: 'engine/state/Store.ts', target: 'types' },
    { source: 'engine/state/Store.ts', target: 'game/App' },
  ]);
});

test('engine has no newly introduced external imports', () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, ['scripts/check-engine-boundary.js'], { cwd: root }));
});
