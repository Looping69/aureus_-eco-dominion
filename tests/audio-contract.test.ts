import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const audioDirectorPath = path.join(root, 'game', 'audio', 'AureusAudio.ts');
const audioHookPath = path.join(root, 'game', 'audio', 'useAureusAudio.ts');
const controlsPath = path.join(root, 'components', 'Controls.tsx');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('procedural audio director owns persistent ambience and music', () => {
  const audioText = source(audioDirectorPath);

  for (const snippet of [
    'export interface AudioMood',
    "const STORAGE_KEY = 'aureus.audio.enabled.v1';",
    'export class AureusAudioDirector',
    'new AudioContextCtor()',
    'createOscillator()',
    'scheduleMusicPulse',
    'noiseBurst',
    'playSfx(type: SfxType | string)',
    'export const aureusAudio = new AureusAudioDirector();',
  ]) {
    assertSnippet(audioText, snippet);
  }
});

test('React audio hook exposes toggle and mood updates', () => {
  const hookText = source(audioHookPath);

  for (const snippet of [
    "import { aureusAudio, AudioMood } from './AureusAudio';",
    'export function useAureusAudio',
    'const [audioEnabled, setAudioEnabled]',
    'aureusAudio.setMood(mood);',
    'const next = aureusAudio.toggle();',
    'playAudioSfx',
  ]) {
    assertSnippet(hookText, snippet);
  }
});

test('HUD controls expose soundscape toggle as a compact icon', () => {
  const controlsText = source(controlsPath);

  for (const snippet of [
    'Volume2, VolumeX',
    "import { useAureusAudio } from '../game/audio/useAureusAudio';",
    'const { audioEnabled, toggleAudio, playAudioSfx } = useAureusAudio',
    'title={audioEnabled ? \'Mute Soundscape\' : \'Start Soundscape\'}',
    'aria-label={audioEnabled ? \'Mute Soundscape\' : \'Start Soundscape\'}',
    '<Volume2 size={20} />',
    '<VolumeX size={20} />',
  ]) {
    assertSnippet(controlsText, snippet);
  }
});
