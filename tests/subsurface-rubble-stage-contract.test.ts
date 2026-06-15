import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const agentSystemPath = path.join(root, 'engine', 'sim', 'systems', 'AgentSystem.ts');
const interactionPath = path.join(root, 'game', 'world', 'interaction.ts');
const subsurfaceModelPath = path.join(root, 'engine', 'subsurface', 'SubsurfaceModel.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('dig jobs cannot silently advance through rubble', () => {
  const text = source(agentSystemPath);

  for (const snippet of [
    "const isRubbleClearJob = job.id.startsWith('dig_sub_clear_');",
    "if (cell.material === 'RUBBLE' && !isRubbleClearJob)",
    'Waiting: rubble remains; use clear rubble before digging deeper.',
    "if (isRubbleClearJob && cell.material !== 'RUBBLE')",
    'Waiting: rubble target is already cleared.',
    'const isClearingRubble = isRubbleClearJob;',
    'clearSubsurfaceRubbleForHaul(state, job.targetX, y, job.targetZ)',
    'excavateSubsurfaceCell(state, job.targetX, y, job.targetZ, { deformSurface: job.context === \'SURFACE_CUT\' })',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('player dig clicks on rubble are routed to the explicit clear command', () => {
  const text = source(interactionPath);

  for (const snippet of [
    "cell?.material === 'RUBBLE'",
    "? 'CLEAR_RUBBLE'",
    ": 'DIG_VOXEL';",
    'deps.stateManager.pushCommand(command, { x, y: activeY, z });',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('the subsurface model rejects digging rubble before job creation', () => {
  const text = source(subsurfaceModelPath);

  for (const snippet of [
    "if (cell.material === 'RUBBLE') return { ok: false",
    'Clear rubble before digging deeper.',
    "export const SUBSURFACE_CLEAR_RUBBLE_JOB_PREFIX = 'dig_sub_clear';",
    'export function queueSubsurfaceRubbleClearJob',
  ]) {
    assertSnippet(text, snippet);
  }
});
