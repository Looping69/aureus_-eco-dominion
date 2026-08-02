import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { createGamePackRegistry, defineGamePack, summarizeGamePack } from '../engine/game-pack/index.ts';
import { collectGameDefinitionIssues, validateGameCommandType } from '../engine/game-definition/index.ts';
import {
  ACTIVE_GAME_DEFINITION,
  ACTIVE_GAME_PACK,
  ACTIVE_GAME_PACK_SUMMARY,
  GAME_DEFINITION_REGISTRY,
  GAME_PACK_REGISTRY,
  GAME_PACKS,
  getActiveGamePack,
  getActiveGamePackSummary,
} from '../game-definitions/activeGameDefinition.ts';
import { AUREUS_ACTIVE_GAME_DEFINITION, AUREUS_GAME_PACK } from '../game-definitions/aureusGamePack.ts';
import { SAMPLE_COLONY_GAME_DEFINITION } from '../game-definitions/sampleColony.ts';
import { SAMPLE_COLONY_GAME_PACK } from '../game-definitions/sampleColonyGamePack.ts';
import { canBootGamePackRuntime, selectGamePackRuntime } from '../game/gamePackRuntime.ts';

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

test('sample colony is a valid non-Aureus game pack', () => {
  assert.equal(SAMPLE_COLONY_GAME_PACK.id, 'sample.micro-colony');
  assert.equal(SAMPLE_COLONY_GAME_PACK.definition, SAMPLE_COLONY_GAME_DEFINITION);
  assert.notEqual(SAMPLE_COLONY_GAME_PACK.id, AUREUS_GAME_PACK.id);
  assert.deepEqual(collectGameDefinitionIssues(SAMPLE_COLONY_GAME_DEFINITION), []);
  assert.equal(validateGameCommandType(SAMPLE_COLONY_GAME_DEFINITION, 'SAMPLE_PING').ok, true);
  assert.equal(validateGameCommandType(SAMPLE_COLONY_GAME_DEFINITION, 'PLACE_BUILDING').ok, false);
  assert.equal(SAMPLE_COLONY_GAME_PACK.runtime.worldModule, 'game-definitions/sampleColonyRuntime');
});

test('game pack registry drives the existing active definition registry', () => {
  assert.equal(ACTIVE_GAME_PACK, AUREUS_GAME_PACK);
  assert.equal(getActiveGamePack(), AUREUS_GAME_PACK);
  assert.equal(ACTIVE_GAME_PACK_SUMMARY?.id, 'aureus.eco-dominion');
  assert.equal(getActiveGamePackSummary()?.definition.title, 'Aureus: Eco Dominion');
  assert.equal(GAME_PACKS.length, 2);
  assert.equal(GAME_PACK_REGISTRY.get('sample.micro-colony'), SAMPLE_COLONY_GAME_PACK);
  assert.equal(GAME_DEFINITION_REGISTRY.get('sample.micro-colony'), SAMPLE_COLONY_GAME_DEFINITION);
  assert.equal(GAME_PACK_REGISTRY.getActiveDefinition(), AUREUS_ACTIVE_GAME_DEFINITION);
  assert.equal(ACTIVE_GAME_DEFINITION, AUREUS_ACTIVE_GAME_DEFINITION);
  assert.equal(GAME_DEFINITION_REGISTRY.getActive(), AUREUS_ACTIVE_GAME_DEFINITION);
});

test('game pack registry can switch packs without changing definition consumers', () => {
  const registry = createGamePackRegistry([AUREUS_GAME_PACK, SAMPLE_COLONY_GAME_PACK]);

  assert.equal(registry.has('aureus.eco-dominion'), true);
  assert.equal(registry.has('sample.micro-colony'), true);
  assert.equal(registry.getActive()?.id, 'aureus.eco-dominion');
  assert.equal(registry.getActiveDefinition()?.id, 'aureus.eco-dominion');
  assert.equal(registry.getActiveDefinitionSummary()?.title, 'Aureus: Eco Dominion');
  assert.equal(registry.setActive('sample.micro-colony'), SAMPLE_COLONY_GAME_PACK);
  assert.equal(registry.getActiveDefinition()?.id, 'sample.micro-colony');
  assert.equal(registry.getActiveSummary()?.definition.actionCount, 1);
  assert.throws(() => registry.setActive('missing.pack'), /Unknown game pack/);
  assert.throws(
    () => defineGamePack({ ...AUREUS_GAME_PACK, id: 'mismatched.pack' }),
    /must match definition id/,
  );
});

test('runtime selector boots Aureus and safely falls back for definition-only packs', () => {
  const aureusRuntime = selectGamePackRuntime('aureus.eco-dominion');
  assert.equal(canBootGamePackRuntime(AUREUS_GAME_PACK), true);
  assert.equal(aureusRuntime.status, 'selected');
  assert.equal(aureusRuntime.requestedPack, AUREUS_GAME_PACK);
  assert.equal(aureusRuntime.runtimePack, AUREUS_GAME_PACK);
  assert.equal(aureusRuntime.definitionRegistry.getActive()?.id, 'aureus.eco-dominion');

  const sampleRuntime = selectGamePackRuntime('sample.micro-colony');
  assert.equal(canBootGamePackRuntime(SAMPLE_COLONY_GAME_PACK), false);
  assert.equal(sampleRuntime.status, 'fallback');
  assert.equal(sampleRuntime.requestedPack, SAMPLE_COLONY_GAME_PACK);
  assert.equal(sampleRuntime.runtimePack, AUREUS_GAME_PACK);
  assert.match(sampleRuntime.fallbackReason ?? '', /not bootable yet/);
  assert.equal(sampleRuntime.definitionRegistry.getActive()?.id, 'aureus.eco-dominion');

  const missingRuntime = selectGamePackRuntime('missing.pack');
  assert.equal(missingRuntime.status, 'fallback');
  assert.equal(missingRuntime.requestedPack, AUREUS_GAME_PACK);
  assert.equal(missingRuntime.runtimePack, AUREUS_GAME_PACK);
  assert.match(missingRuntime.fallbackReason ?? '', /Unknown game pack/);
});

test('runtime selector is isolated from the stable Aureus hook boot path', () => {
  const hook = source('game/useAureusEngine.ts');
  const runtimeSelector = source('game/gamePackRuntime.ts');

  assert.match(runtimeSelector, /export function selectGamePackRuntime/);
  assert.match(runtimeSelector, /BOOTABLE_WORLD_MODULES/);
  assert.match(runtimeSelector, /createRuntimeDefinitionRegistry/);
  assert.match(runtimeSelector, /Unknown game pack/);
  assert.match(hook, /GAME_DEFINITION_REGISTRY/);
  assert.doesNotMatch(hook, /selectGamePackRuntime/);
});

test('active game definition module now exposes pack-first wiring', () => {
  const activeGameDefinition = source('game-definitions/activeGameDefinition.ts');
  const aureusGamePack = source('game-definitions/aureusGamePack.ts');
  const sampleColony = source('game-definitions/sampleColony.ts');
  const sampleColonyGamePack = source('game-definitions/sampleColonyGamePack.ts');

  assert.match(activeGameDefinition, /createGamePackRegistry/);
  assert.match(activeGameDefinition, /export const GAME_PACKS = \[AUREUS_GAME_PACK, SAMPLE_COLONY_GAME_PACK\] as const/);
  assert.match(activeGameDefinition, /export const GAME_PACK_REGISTRY/);
  assert.match(activeGameDefinition, /export function getActiveGamePack/);
  assert.match(activeGameDefinition, /GAME_PACKS\.map\(\(pack\) => pack\.definition\)/);
  assert.match(aureusGamePack, /export const AUREUS_GAME_PACK = defineGamePack/);
  assert.match(aureusGamePack, /worldModule: 'game\/AureusWorld'/);
  assert.match(sampleColony, /export const SAMPLE_COLONY_GAME_DEFINITION = defineGameDefinition/);
  assert.match(sampleColonyGamePack, /export const SAMPLE_COLONY_GAME_PACK = defineGamePack/);
});
