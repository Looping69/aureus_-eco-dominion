import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = path.join(root, 'engine');
const baselinePath = path.join(root, 'docs/engine-boundary-baseline.json');
const mode = process.argv[2];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(location) : /\.(ts|tsx)$/.test(entry.name) ? [location] : [];
  });
}

export function externalEngineImports(source, filename, rootPath) {
  const imports = [];
  const pattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    if (!match[1].startsWith('.')) continue;
    const target = path.resolve(path.dirname(filename), match[1]);
    const enginePath = path.join(rootPath, 'engine') + path.sep;
    if (target.startsWith(enginePath)) continue;
    imports.push({
      source: path.relative(rootPath, filename).replaceAll(path.sep, '/'),
      target: path.relative(rootPath, target).replaceAll(path.sep, '/'),
    });
  }
  return imports;
}

export function inventory(rootPath = root) {
  return walk(path.join(rootPath, 'engine'))
    .flatMap(file => externalEngineImports(readFileSync(file, 'utf8'), file, rootPath))
    .sort((a, b) => `${a.source}:${a.target}`.localeCompare(`${b.source}:${b.target}`));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const current = inventory();
  if (mode === '--print') {
    process.stdout.write(JSON.stringify(current, null, 2) + '\n');
  } else {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    const allowed = new Set(baseline.map(item => `${item.source}:${item.target}`));
    const added = current.filter(item => !allowed.has(`${item.source}:${item.target}`));
    if (added.length) {
      console.error('New engine imports from game-owned code:', JSON.stringify(added, null, 2));
      process.exitCode = 1;
    } else {
      console.log(`Engine boundary: ${current.length} existing external imports; no new dependencies.`);
    }
  }
}
