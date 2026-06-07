import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const mutationPath = path.join(process.cwd(), 'engine', 'worldgen', 'LayeredWorldMutations.ts');
const dispatcherPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'CommandDispatcher.ts');
const supplySidebarPath = path.join(process.cwd(), 'components', 'SupplySidebar.tsx');

function assertIncludes(source: string, snippet: string) {
  assert.equal(source.includes(snippet), true, `Missing expected snippet: ${snippet}`);
}

test('layered world voxels can be excavated into tunnels with resource drops', () => {
  assert.equal(existsSync(mutationPath), true, 'LayeredWorldMutations.ts is missing');
  const source = readFileSync(mutationPath, 'utf8');

  for (const snippet of [
    'export function digLayeredWorldVoxel(',
    'if (y >= layeredWorld.surfaceY) {',
    "return { ok: false, reason: 'Use surface tools above ground.' };",
    'if (!cell.mineable || !cell.destructible) {',
    "if (material === 'ORE') return { minerals: Math.max(4, resourceAmount) };",
    "if (material === 'GEMS') return { gems: Math.max(1, resourceAmount) };",
    "if (material === 'AUREUS_VEIN') return { minerals: 25, gems: 2 };",
    "cell.material = 'AIR';",
    "cell.contents = 'TUNNEL';",
    'layer.dirty = true;',
    'chunk.dirty = true;',
    'layeredWorld.renderVersion += 1;',
  ]) {
    assertIncludes(source, snippet);
  }
});

test('command dispatcher handles DIG_VOXEL through layered world mutation', () => {
  assert.equal(existsSync(dispatcherPath), true, 'CommandDispatcher.ts is missing');
  const source = readFileSync(dispatcherPath, 'utf8');

  for (const snippet of [
    "import { digLayeredWorldVoxel } from '../../worldgen/LayeredWorldMutations';",
    "} else if (commandType === 'DIG_VOXEL') {",
    'result = this.digVoxel(cmd, state);',
    'const result = digLayeredWorldVoxel(state.layeredWorld, x, y, z);',
    'state.resources.minerals += result.drops.minerals || 0;',
    'state.resources.gems += result.drops.gems || 0;',
    'state.resources.stone += result.drops.stone || 0;',
    "state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.MINING_HIT });",
    "'DIG_VOXEL'",
  ]) {
    assertIncludes(source, snippet);
  }
});

test('survey drill is available from the starter build menu', () => {
  assert.equal(existsSync(supplySidebarPath), true, 'SupplySidebar.tsx is missing');
  const source = readFileSync(supplySidebarPath, 'utf8');

  for (const snippet of [
    'case BuildingType.SURVEY_DRILL: return <Pickaxe size={18} />;',
    "[BuildingType.SURVEY_DRILL]: 'UNDERGROUND',",
    'BuildingType.MINING_HEADFRAME, BuildingType.SURVEY_DRILL, BuildingType.MINE_SHAFT,',
    'BuildingType.SURVEY_DRILL,',
  ]) {
    assertIncludes(source, snippet);
  }
});
