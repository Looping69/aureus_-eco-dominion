import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const appPath = path.join(process.cwd(), 'App.tsx');
const engineHookPath = path.join(process.cwd(), 'game', 'useAureusEngine.ts');
const undergroundHudPath = path.join(process.cwd(), 'components', 'UndergroundHUD.tsx');
const dungeonInputPath = path.join(process.cwd(), 'game', 'dungeon', 'DungeonInputHandler.ts');
const dungeonTypesPath = path.join(process.cwd(), 'engine', 'dungeon', 'DungeonTypes.ts');
const dungeonMinerSystemPath = path.join(process.cwd(), 'engine', 'sim', 'systems', 'DungeonMinerSystem.ts');
const dungeonRenderSystemPath = path.join(process.cwd(), 'game', 'render', 'systems', 'DungeonRenderSystem.ts');
const renderFramePath = path.join(process.cwd(), 'game', 'world', 'renderFrame.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('Deep Ledger HUD only renders while underground view is active', () => {
  assert.equal(existsSync(appPath), true, 'App.tsx is missing');

  const source = readFileSync(appPath, 'utf8');

  for (const snippet of [
    "state.activeView === 'DUNGEON'",
    '<UndergroundHUD underground={state.underground} />',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Deep Ledger HUD shows the Phase 1 survey metrics explicitly', () => {
  assert.equal(existsSync(undergroundHudPath), true, 'UndergroundHUD.tsx is missing');

  const source = readFileSync(undergroundHudPath, 'utf8');

  for (const snippet of [
    'const sectorLabel = `Sector B${underground.depthLevel}`;',
    '>Depth<',
    '>Stability<',
    '>Oxygen<',
    '>Exposure<',
    '>Surveyed Tiles<',
    '>Hazards<',
    'visibleTiles.length',
    'hazardCount',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Underground HUD exposes playable mine controls', () => {
  assert.equal(existsSync(undergroundHudPath), true, 'UndergroundHUD.tsx is missing');

  const source = readFileSync(undergroundHudPath, 'utf8');

  for (const snippet of [
    'Mine Console',
    'emitDungeonAction',
    "'SET_MODE'",
    "'HIRE_MINER'",
    "'SURFACE_RESOURCES'",
    'build_support',
    'build_recharger',
    'Driller',
    'Excavator',
    'Foreman',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Underground HUD panels can collapse out of the mine view', () => {
  assert.equal(existsSync(undergroundHudPath), true, 'UndergroundHUD.tsx is missing');

  const source = readFileSync(undergroundHudPath, 'utf8');

  for (const snippet of [
    'const [ledgerCollapsed, setLedgerCollapsed] = useState(true);',
    'const [consoleCollapsed, setConsoleCollapsed] = useState(false);',
    'ChevronDown',
    'ChevronUp',
    'pointer-events-auto',
    '!ledgerCollapsed &&',
    '!consoleCollapsed &&',
    'Collapse Mine Console',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Dungeon input handler receives HUD actions and mutates real mine state', () => {
  assert.equal(existsSync(dungeonInputPath), true, 'DungeonInputHandler.ts is missing');

  const source = readFileSync(dungeonInputPath, 'utf8');

  for (const snippet of [
    "window.addEventListener('aureus:dungeon-action'",
    'handleUiAction',
    'hireMiner',
    'surfaceResources',
    'MINER_COSTS',
    'state.dungeon.miners.push',
    'state.resources.agt += agtGain',
    'window.removeEventListener',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});

test('Dungeon block clicks create persistent mine orders that compatible miners claim', () => {
  for (const [filePath, label] of [
    [dungeonTypesPath, 'DungeonTypes.ts'],
    [dungeonInputPath, 'DungeonInputHandler.ts'],
    [dungeonMinerSystemPath, 'DungeonMinerSystem.ts'],
  ] as const) {
    assert.equal(existsSync(filePath), true, `${label} is missing`);
  }

  const typesSource = readFileSync(dungeonTypesPath, 'utf8');
  const inputSource = readFileSync(dungeonInputPath, 'utf8');
  const minerSource = readFileSync(dungeonMinerSystemPath, 'utf8');

  for (const snippet of [
    'export interface DungeonMineOrder',
    'mineOrders?: DungeonMineOrder[];',
    "status: 'QUEUED' | 'ASSIGNED';",
  ]) {
    assert.match(typesSource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'requiredMinerForBlock',
    'canMinerMineBlock',
    'state.dungeon.mineOrders ??= [];',
    'state.dungeon.mineOrders.push(order);',
    "Needs an available ${requiredMiner}.",
  ]) {
    assert.match(inputSource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'claimQueuedMineOrder',
    "candidate.status !== 'QUEUED'",
    "order.status = 'ASSIGNED';",
    'clearMineOrder',
    'pruneInvalidMineOrders',
  ]) {
    assert.match(minerSource, new RegExp(escapeRegExp(snippet)));
  }
});

test('Dungeon block picking ignores overlays and aligns to voxel centers', () => {
  for (const [filePath, label] of [
    [dungeonInputPath, 'DungeonInputHandler.ts'],
    [dungeonRenderSystemPath, 'DungeonRenderSystem.ts'],
    [dungeonMinerSystemPath, 'DungeonMinerSystem.ts'],
  ] as const) {
    assert.equal(existsSync(filePath), true, `${label} is missing`);
  }

  const inputSource = readFileSync(dungeonInputPath, 'utf8');
  const renderSource = readFileSync(dungeonRenderSystemPath, 'utf8');
  const minerSource = readFileSync(dungeonMinerSystemPath, 'utf8');

  for (const snippet of [
    'isDungeonBlockHit',
    '.filter(isDungeonBlockHit)',
    'Math.round(point.x)',
    'this.selectionMesh.position.set(x, y, z);',
    'this.selectionMesh.position.set(tx, ty, tz);',
  ]) {
    assert.match(inputSource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'mesh.userData.isDungeonBlock = true;',
    'mesh.position.set(order.position.x, order.position.y, order.position.z);',
  ]) {
    assert.match(renderSource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'const tx = m.targetBlock.x;',
    'const tz = m.targetBlock.z;',
  ]) {
    assert.match(minerSource, new RegExp(escapeRegExp(snippet)));
  }
});

test('Dungeon renderer shows queued mine orders and uses a black underground backdrop', () => {
  for (const [filePath, label] of [
    [dungeonRenderSystemPath, 'DungeonRenderSystem.ts'],
    [renderFramePath, 'renderFrame.ts'],
  ] as const) {
    assert.equal(existsSync(filePath), true, `${label} is missing`);
  }

  const renderSystemSource = readFileSync(dungeonRenderSystemPath, 'utf8');
  const renderFrameSource = readFileSync(renderFramePath, 'utf8');

  for (const snippet of [
    'private mineOrderGroup: THREE.Group;',
    'private mineOrderMeshes: Map<string, THREE.Mesh>',
    'this.updateMineOrders(state);',
    "order.status === 'ASSIGNED'",
    'depthTest: false',
  ]) {
    assert.match(renderSystemSource, new RegExp(escapeRegExp(snippet)));
  }

  for (const snippet of [
    'const dungeonBackgroundColor = new THREE.Color(0x000000);',
    "state.activeView === 'DUNGEON'",
    'renderer.setClearColor(0x000000, 1);',
    'scene.background = dungeonBackgroundColor;',
    'scene.fog = new THREE.Fog(0x000000, 32, 110);',
  ]) {
    assert.match(renderFrameSource, new RegExp(escapeRegExp(snippet)));
  }
});

test('Engine subscription gives React a fresh state reference for UI toggles', () => {
  assert.equal(existsSync(engineHookPath), true, 'useAureusEngine.ts is missing');

  const source = readFileSync(engineHookPath, 'utf8');

  for (const snippet of [
    'worldInstance.subscribeToState((newState) => {',
    'setState({ ...newState });',
    'setState({ ...worldInstance.getState() });',
  ]) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
});
