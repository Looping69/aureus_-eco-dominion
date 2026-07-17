import assert from 'node:assert/strict';
import test from 'node:test';

import { ACTIVE_GAME_DEFINITION } from '../game-definitions/activeGameDefinition.ts';
import { findActionForCommandType, validateGameCommandType } from '../engine/game-definition/index.ts';

const BUILD_COMMANDS = [
  'PLACE_BUILDING',
  'BUY_BUILDING',
  'BULLDOZE',
  'SPEED_UP',
  'REHABILITATE',
  'UPGRADE_BUILDING',
] as const;

test('active Aureus game pack declares schemas for core build commands', () => {
  for (const commandType of BUILD_COMMANDS) {
    const action = findActionForCommandType(ACTIVE_GAME_DEFINITION, commandType);
    assert.ok(action, `${commandType} should exist`);
    assert.ok(action.payloadSchema, `${commandType} should declare a payload schema`);
  }
});

test('build action schemas accept valid payloads and reject malformed payloads', () => {
  assert.equal(validateGameCommandType(ACTIVE_GAME_DEFINITION, 'PLACE_BUILDING', {
    x: 4,
    z: -2,
    buildingType: 'STAFF_QUARTERS',
  }).ok, true);
  assert.equal(validateGameCommandType(ACTIVE_GAME_DEFINITION, 'PLACE_BUILDING', {
    x: 4,
    z: -2,
    buildingType: '',
  }).ok, false);
  assert.equal(validateGameCommandType(ACTIVE_GAME_DEFINITION, 'BUY_BUILDING', {
    buildingType: 'STAFF_QUARTERS',
    cost: 500,
  }).ok, true);
  assert.equal(validateGameCommandType(ACTIVE_GAME_DEFINITION, 'BUY_BUILDING', {
    buildingType: 'STAFF_QUARTERS',
    cost: Number.NaN,
  }).ok, false);
  assert.equal(validateGameCommandType(ACTIVE_GAME_DEFINITION, 'BULLDOZE', { x: 2, z: 3 }).ok, true);
  assert.equal(validateGameCommandType(ACTIVE_GAME_DEFINITION, 'SPEED_UP', { x: 2 }).ok, false);
  assert.equal(validateGameCommandType(ACTIVE_GAME_DEFINITION, 'REHABILITATE', { x: 2, z: Infinity }).ok, false);
  assert.equal(validateGameCommandType(ACTIVE_GAME_DEFINITION, 'UPGRADE_BUILDING', { x: 2, z: 3 }).ok, true);
});
