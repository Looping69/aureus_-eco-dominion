import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const adapterPath = path.join(root, 'engine', 'render', 'ThreeRenderAdapter.ts');
const governorPath = path.join(root, 'engine', 'render', 'RuntimeQualityGovernor.ts');
const useEnginePath = path.join(root, 'game', 'useAureusEngine.ts');

function source(filePath: string) {
  assert.equal(existsSync(filePath), true, `${filePath} is missing`);
  return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
  assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('low-end render quality starts below high detail and includes a survival rung', () => {
  const text = source(adapterPath);

  for (const snippet of [
    'export function getRenderDeviceProfile()',
    'severelyConstrained',
    "label: 'SURVIVAL'",
    'pixelRatio: Math.max(0.55, Math.min(basePixelRatio, 0.65))',
    'export function getInitialRuntimeQualityLevel',
    'if (device.severelyConstrained) return 0;',
    'if (device.veryConstrained) return Math.min(1, ladder.length - 1);',
    'if (device.constrained) return Math.min(2, ladder.length - 1);',
    'this.runtimeQuality = this.runtimeQualityLadder[getInitialRuntimeQualityLevel(this.runtimeQualityLadder)];',
    'antialias: this.runtimeQuality.antialias',
    'this.renderer.setPixelRatio(this.runtimeQuality.pixelRatio)',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('capable devices can start at true max visual quality', () => {
  const text = source(adapterPath);

  for (const snippet of [
    'export interface RenderDeviceProfile {',
    'maxVisuals: boolean;',
    'const maxVisuals = !constrained && cores >= 8 && memory >= 8;',
    'return { constrained, veryConstrained, severelyConstrained, maxVisuals, touchDevice, dpr };',
    'device.maxVisuals ? 2 : 1.35',
    'shadowMapSize: device.veryConstrained ? 512 : device.constrained ? 768 : device.maxVisuals ? 2048 : 1536,',
    'const basePixelRatio = THREE.MathUtils.clamp(baseQuality.pixelRatio, 0.6, 2);',
    'pixelRatio: Math.max(1.0, Math.min(basePixelRatio, 1.35))',
    "label: 'ULTRA'",
    'pixelRatio: basePixelRatio,',
    'shadowMapSize: baseShadowSize,',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('quality governor emergency-downgrades catastrophic frame drops', () => {
  const text = source(governorPath);

  for (const snippet of [
    'criticalFpsThreshold: number;',
    'criticalRenderMs: number;',
    'emergencyDowngradeLevels: number;',
    'sampleIntervalMs: 1000',
    'downgradeSamples: 1',
    'upgradeSamples: 8',
    'criticalFpsThreshold: 30',
    'criticalRenderMs: 28',
    'emergencyDowngradeLevels: 2',
    'const criticallySlow = canDowngrade',
    'fps > 0 && fps < this.config.criticalFpsThreshold',
    'totalRenderMs > this.config.criticalRenderMs',
    'const nextLevel = Math.max(0, currentLevel - this.config.emergencyDowngradeLevels);',
    'this.render.setRuntimeQualityLevel(nextLevel);',
  ]) {
    assertSnippet(text, snippet);
  }
});

test('runtime quality governor remains active during engine startup', () => {
  const text = source(useEnginePath);

  for (const snippet of [
    'const renderQuality = getRecommendedRenderQuality();',
    'const qualityGovernor = new RuntimeQualityGovernor(runtimeInstance, render);',
    'qualityGovernor.start();',
    'qualityGovernor.stop();',
  ]) {
    assertSnippet(text, snippet);
  }
});