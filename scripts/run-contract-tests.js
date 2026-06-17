import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const testsDir = path.join(repoRoot, 'tests');

const testFiles = readdirSync(testsDir)
    .filter((file) => file.endsWith('.test.ts'))
    .sort()
    .map((file) => path.join('tests', file));

if (testFiles.length === 0) {
    console.error('No contract tests found in tests/*.test.ts');
    process.exit(1);
}

const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...testFiles], {
    stdio: 'inherit',
    shell: false,
    cwd: repoRoot,
});

if (result.error) {
    throw result.error;
}

process.exit(result.status ?? 1);
