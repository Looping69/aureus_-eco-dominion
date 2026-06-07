import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const decoratorPath = path.join(process.cwd(), 'game', 'render', 'assets', 'infrastructure', 'InfrastructureDecorators.ts');
const indexPath = path.join(process.cwd(), 'game', 'render', 'assets', 'infrastructure', 'index.ts');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('infrastructure renderer decorations live in their own asset module', () => {
  assert.equal(existsSync(decoratorPath), true, 'infrastructure decorator module is missing');
  assert.equal(existsSync(indexPath), true, 'infrastructure renderer asset barrel is missing');

  const decorators = readFileSync(decoratorPath, 'utf8');
  const index = readFileSync(indexPath, 'utf8');

  for (const snippet of [
    'export interface InfrastructureDecorationAssets',
    'dronePadGeo: THREE.BufferGeometry;',
    'dronePacketGeo: THREE.BufferGeometry;',
    'beaconGeo: THREE.BufferGeometry;',
    'junctionArrowGeo: THREE.BufferGeometry;',
    'export function decorateRailConveyor(',
    'export function decorateDistributionHub(',
    'export function decorateTrainStation(',
    'export function decorateDroneDepot(',
  ]) {
    assert.match(decorators, new RegExp(escapeRegExp(snippet)));
  }

  assert.match(index, /export \* from '\.\/InfrastructureDecorators';/);
});

test('infrastructure renderer assets preserve animated logistics detail hooks', () => {
  const decorators = readFileSync(decoratorPath, 'utf8');

  for (const snippet of [
    'pulse.userData.isConveyorPulse = true;',
    "pulse.userData.axis = 'x';",
    "pulse.userData.axis = 'z';",
    "pulse.userData.axis = 'orbit';",
    'pulse.userData.orbitRadius = 0.22;',
    'orb.userData.isConveyorPulse = true;',
    'drone.userData.isConveyorPulse = true;',
    'drone.userData.baseY = 0.52 + ((index % 2) * 0.06);',
  ]) {
    assert.match(decorators, new RegExp(escapeRegExp(snippet)));
  }
});

test('infrastructure renderer assets keep the logistics color language coherent', () => {
  const decorators = readFileSync(decoratorPath, 'utf8');

  for (const color of [
    '0x67e8f9',
    '0xa855f7',
    '0x38bdf8',
    '0x2dd4bf',
    '0x99f6e4',
    '0xe0f2fe',
    '0xe9d5ff',
  ]) {
    assert.match(decorators, new RegExp(escapeRegExp(color)));
  }
});
