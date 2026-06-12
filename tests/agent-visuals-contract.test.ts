import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const agentIndexPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'agents', 'index.ts');
const agentExportPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'Agent.ts');
const commonBasePath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'agents', 'common', 'BaseAgent.ts');
const workerPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'agents', 'roles', 'Worker.ts');
const minerPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'agents', 'roles', 'Miner.ts');
const engineerPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'agents', 'roles', 'Engineer.ts');
const botanistPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'agents', 'roles', 'Botanist.ts');
const securityPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'agents', 'roles', 'Security.ts');
const illegalMinerPath = path.join(process.cwd(), 'engine', 'data', 'voxels', 'agents', 'roles', 'IllegalMiner.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectSnippets(filePath: string, snippets: string[]) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  const source = readFileSync(filePath, 'utf8');
  for (const snippet of snippets) {
    assert.match(source, new RegExp(escapeRegExp(snippet)));
  }
}

test('agent registry uses distinct factories for every visible role', () => {
  expectSnippets(agentIndexPath, [
    'LumberjackFactory',
    'QuarrymanFactory',
    'CitizenFactory',
    'UnemployedFactory',
    "'LUMBERJACK': LumberjackFactory",
    "'QUARRYMAN': QuarrymanFactory",
    "'UNEMPLOYED': UnemployedFactory",
    "'CITIZEN': CitizenFactory",
  ]);

  expectSnippets(agentExportPath, [
    'LumberjackFactory',
    'QuarrymanFactory',
    'CitizenFactory',
    'UnemployedFactory',
    'addVoxelBox',
  ]);
});

test('agent role factories add readable role-specific details', () => {
  expectSnippets(commonBasePath, ['export function addVoxelBox']);

  expectSnippets(workerPath, [
    'addHardHat',
    'addReflectiveVest',
    'LumberjackFactory',
    'QuarrymanFactory',
    'CitizenFactory',
    'UnemployedFactory',
    'addAxeBack',
    'addSledgeBack',
    'addMessengerBag',
  ]);

  expectSnippets(minerPath, ['addHelmet', 'addBackpack', 'addHarness', 'dustBoots']);
  expectSnippets(engineerPath, ['addEngineerHelmet', 'addBatteryPack', 'addToolBelt', 'CABLE_COLOR']);
  expectSnippets(botanistPath, ['addFieldHat', 'addSatchel', 'addPlantTools', 'mudLegs']);
  expectSnippets(securityPath, ['addArmor', 'addHelmet', 'armorArms', 'VISOR']);
  expectSnippets(illegalMinerPath, ['createHoodedHead', 'addContrabandPack', 'addDarkHarness', 'dustyLegs']);
});
