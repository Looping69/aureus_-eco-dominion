import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const testsDir = path.join(repoRoot, 'tests');
const outDir = path.join(repoRoot, '.contract-test-cache');

const testFiles = readdirSync(testsDir)
    .filter((file) => file.endsWith('.test.ts'))
    .sort();

if (testFiles.length === 0) {
    console.error('No contract tests found in tests/*.test.ts');
    process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const compiledFiles = testFiles.map((file) => {
    const sourcePath = path.join(testsDir, file);
    const source = readFileSync(sourcePath, 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            esModuleInterop: true,
            sourceMap: false,
        },
        fileName: sourcePath,
    });
    const outPath = path.join(outDir, file.replace(/\.ts$/, '.mjs'));
    writeFileSync(outPath, compiled.outputText, 'utf8');
    return outPath;
});

const result = spawnSync(process.execPath, ['--test', ...compiledFiles], {
    stdio: 'inherit',
    shell: false,
    cwd: repoRoot,
});

rmSync(outDir, { recursive: true, force: true });

if (result.error) {
    throw result.error;
}

process.exit(result.status ?? 1);
