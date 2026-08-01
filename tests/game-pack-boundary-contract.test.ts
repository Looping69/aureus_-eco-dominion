import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { createGamePackRegistry, defineGamePack, summarizeGamePack } from '../engine/game-pack/index.ts';
import {
  ACTIVE_GAME_DEFINITION,
  ACTIVE_GAME_PACK,
  ACTIVE_GAME_PACK_SUMMARY,
  GAME_DEFINITION_REGISTRY,
  GAME_PACK_REGISTRY,
  getActiveGamePack,
  getActiveGamePackSummary,
} from '../game-definitions/activeGameDefinition.ts';
import { AUREUS_ACTIVE_GAME_DEFINITION, AUREUS_GAME_PACK } from '../game-definitions/aureusGamePack.ts';

function source(relativePath: string): string {
  const filePath = path.join(process.cwd(), relativePath);
  assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
  return readFileSync(filePath, 'utf8');
}

test('engine exposes a generic game pack boundary', () => {
  const gamePack = source('engine/game-pack/GamePack.ts');
  const index = source('engine/game-pack/index.ts');

  assert.match(gamePack, /export interface GamePack/);
  assert.match(gamePack, /definition: GameDefinition/);
  assert.match(gamePack, /runtime: GamePackRuntimeDefinition/);
  assert.match(gamePack, /export class GamePackRegistry/);
  assert.match(gamePack, /getActiveDefinition/);
  assert.match(gamePack, /export function createGamePackRegistry/);
  assert.match(index, /export \{[\s\S]*createGamePackRegistry/);
  assert.match(index, /export type \{[\s\S]*GamePack/);
});

test('Aureus is wrapped as the default swappable game pack', () => {
  assert.equal(AUREUS_GAME_PACK.id, 'aureus.eco-dominion');
  assert.equal(AUREUS_GAME_PACK.definition, AUREUS_ACTIVE_GAME_DEFINITION);
  assert.equal(AUREUS_GAME_PACK.title, AUREUS_ACTIVE_GAME_DEFINITION.title);
  assert.deepEqual(AUREUS_GAME_PACK.genreTags, AUREUS_ACTIVE_GAME_DEFINITION.genreTags);
  assert.equal(AUREUS_GAME_PACK.runtime.worldModule, 'game/AureusWorld');
  assert.equal(AUREUS_GAME_PACK.runtime.stateModule, 'game/useAureusEngine');
  assert.equal(AUREUS_GAME_PACK.runtime.uiModule, 'App');

  const summary = summarizeGamePack(AUREUS_GAME_PACK);
  assert.equal(summary.id, 'aureus.eco-dominion');
  assert.equal(summary.definition.id, 'aureus.eco-dominion');
  assert.equal(summary.definition.actionCount, AUREUS_ACTIVE_GAME_DEFINITION.actions.length);
});

test('game pack registry drives the existing active definition registry', () => {
  assert.equal(ACTIVE_GAME_PACK, AUREUS_GAME_PACK);
  assert.equal(getActiveGamePack(), AUREUS_GAME_PACK);
  assert.equal(ACTIVE_GAME_PACK_SUMMARY?.id, 'aureus.eco-dominion');
  assert.equal(getActiveGamePackSummary()?.definition.title, 'Aureus: Eco Dominion');
  assert.equal(GAME_PACK_REGISTRY.getActiveDefinition(), AUREUS_ACTIVE_GAME_DEFINITION);
  assert.equal(ACTIVE_GAME_DEFINITION, AUREUS_ACTIVE_GAME_DEFINITION);
  assert.equal(GAME_DEFINITION_REGISTRY.getActive(), AUREUS_ACTIVE_GAME_DEFINITION);
});

test('game pack registry can switch packs without changing definition consumers', () => {
  const registry = createGamePackRegistry([AUREUS_GAME_PACK]);

  assert.equal(registry.has('aureus.eco-dominion'), true);
  assert.equal(registry.getActive()?.id, 'aureus.eco-dominion');
  assert.equal(registry.getActiveDefinition()?.id, 'aureus.eco-dominion');
  assert.equal(registry.getActiveDefinitionSummary()?.title, 'Aureus: Eco Dominion');
  assert.throws(() => registry.setActive('missing.pack'), /Unknown game pack/);
  assert.throws(
    () => defineGamePack({ ...AUREUS_GAME_PACK, id: 'mismatched.pack' }),
    /must match definition id/,
  );
});

test('active game definition module now exposes pack-first wiring', () => {
  const activeGameDefinition = source('game-definitions/activeGameDefinition.ts');
  const aureusGamePack = source('game-definitions/aureusGamePack.ts');

  assert.match(activeGameDefinition, /createGamePackRegistry/);
  assert.match(activeGameDefinition, /export const GAME_PACK_REGISTRY/);
  assert.match(activeGameDefinition, /export function getActiveGamePack/);
  assert.match(activeGameDefinition, /ACTIVE_GAME_PACK\.definition/);
  assert.match(aureusGamePack, /export const AUREUS_GAME_PACK = defineGamePack/);
  assert.match(aureusGamePack, /worldModule: 'game\/AureusWorld'/);
});
