import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const servicePath = path.join(root, 'services', 'overseerLocalQwen.ts');
const panelPath = path.join(root, 'components', 'AIOverseerPanel.tsx');
const systemPath = path.join(root, 'engine', 'sim', 'systems', 'AIOverseerPlaySystem.ts');
const packagePath = path.join(root, 'package.json');

function source(filePath: string): string {
    assert.equal(existsSync(filePath), true, `${filePath} is missing`);
    return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string): void {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('overseer local model uses the browser-compatible Qwen2.5 Transformers.js target', () => {
    const text = source(servicePath);

    for (const snippet of [
        "provider: 'Transformers.js'",
        "modelId: 'onnx-community/Qwen2.5-0.5B-Instruct'",
        "displayName: 'Qwen2.5 0.5B Instruct'",
        "task: 'text-generation'",
        "preferredDevice: 'webgpu'",
        "fallbackDevice: 'wasm'",
        "@huggingface/transformers@3.7.2",
    ]) {
        assertSnippet(text, snippet);
    }
});

test('local model loader is browser-side and does not require a backend AI key', () => {
    const text = source(servicePath);
    const packageJson = JSON.parse(source(packagePath));

    for (const snippet of [
        'navigator',
        "'gpu' in navigator",
        'import(/* @vite-ignore */ moduleUrl)',
        'transformers.env.allowLocalModels = false',
        'transformers.env.useBrowserCache = true',
        'return_full_text: false',
    ]) {
        assertSnippet(text, snippet);
    }

    assert.equal(Boolean(packageJson.dependencies?.openai), false, 'local overseer must not add an OpenAI backend dependency');
    assert.equal(Boolean(packageJson.dependencies?.['@huggingface/inference']), false, 'local overseer must not add hosted inference dependency');
    assert.doesNotMatch(text, /process\.env|OPENAI|apiKey|Authorization/i);
});

test('local Qwen is taught pilot rules and a strict action schema', () => {
    const text = source(servicePath);

    for (const snippet of [
        'export const OVERSEER_PILOT_RULES',
        'Protect survival first: fix power and water deficits before optional growth.',
        'Deliver accepted contracts immediately when stock is ready.',
        'Return only JSON. Never claim that an action already happened.',
        'export const OVERSEER_PILOT_ACTION_SCHEMA',
        'generateOverseerPilotDirective',
        'parseOverseerPilotDirective',
        'normalizePilotAction',
        'isExecutablePilotAction',
    ]) {
        assertSnippet(text, snippet);
    }
});

test('local Qwen pilot actions can be validated against the active game definition', () => {
    const text = source(servicePath);

    for (const snippet of [
        'buildGameCommandValidationContext',
        'validateGameCommandType',
        'type GameDefinition',
        'export function validateOverseerPilotAction',
        "if (!isExecutablePilotAction(action)) return { ok: false, reason: 'Pilot action is not executable.' };",
        "if (action.type === 'NONE') return { ok: true };",
        'return validateGameCommandType(definition, action.type, action.payload || {}, buildGameCommandValidationContext(state as any));',
    ]) {
        assertSnippet(text, snippet);
    }
});

test('overseer panel assigns Pilot mode to Local Qwen and queues whitelisted model actions', () => {
    const text = source(panelPath);

    for (const snippet of [
        "type OverseerPilotProvider = 'HEURISTIC' | 'LOCAL_QWEN'",
        'generateOverseerPilotDirective',
        'queuePilotGameCommand',
        "pilotProvider: mode === 'AUTOPILOT' ? 'LOCAL_QWEN' : 'HEURISTIC'",
        'QWEN_PILOT_INTERVAL_MS = 30000',
        'qwenPilotBusyRef',
        'latestStateRef',
        'latestWorldRef',
        'isExecutablePilotAction(action)',
        "id: `qwen_pilot_${Date.now()}_${action.type.toLowerCase()}`",
        "{overseer.autoAct ? 'Qwen Pilot Enabled' : 'Enable Qwen Auto Act'}",
    ]) {
        assertSnippet(text, snippet);
    }
});

test('Auto Act control always promotes Local Qwen to the decision-maker', () => {
    const text = source(panelPath);

    for (const snippet of [
        'const toggleAutoAct = () => {',
        "send({ enabled: true, autoAct: false });",
        "mode: 'AUTOPILOT'",
        'autoAct: true',
        "pilotProvider: 'LOCAL_QWEN'",
        "autoAct: mode === 'AUTOPILOT' ? overseer.autoAct : false",
        "{overseer.mode} / {isQwenPilot ? 'Local Qwen' : 'Advising'}",
    ]) {
        assertSnippet(text, snippet);
    }

    assert.doesNotMatch(text, /Auto Act Enabled/);
});

test('overseer panel shows a clear Local Qwen working indicator', () => {
    const text = source(panelPath);

    for (const snippet of [
        'function getQwenIndicator',
        'Qwen Thinking',
        'Qwen Piloting',
        'Qwen Ready',
        'Qwen Idle',
        'Qwen Error',
        'qwenWorking',
        'setQwenWorking(true)',
        'setQwenWorking(false)',
        'qwenIndicator.label',
        'qwenIndicator.detail',
        'qwenIndicator.dot',
        'qwenIndicator.pill',
        "{qwenStatus === 'loading' || qwenWorking ? 'Working' : isQwenPilot ? 'Move' : 'Ask'}",
    ]) {
        assertSnippet(text, snippet);
    }
});

test('engine heuristic autopilot yields when Local Qwen owns Pilot mode', () => {
    const text = source(systemPath);

    for (const snippet of [
        "type OverseerPilotProvider = 'HEURISTIC' | 'LOCAL_QWEN'",
        "pilotProvider: 'HEURISTIC'",
        "pilotProvider: existing?.pilotProvider === 'LOCAL_QWEN' ? 'LOCAL_QWEN' : 'HEURISTIC'",
        "const localQwenPilot = overseer.mode === 'AUTOPILOT' && overseer.pilotProvider === 'LOCAL_QWEN';",
        'const insight = localQwenPilot ? this.getLocalQwenPilotInsight(overseer) : this.analyze(state);',
        'if (overseer.autoAct && !localQwenPilot) this.tryAct(ctx, state, overseer);',
        "payload.pilotProvider === 'LOCAL_QWEN' || payload.pilotProvider === 'HEURISTIC'",
        'private getLocalQwenPilotInsight(overseer: OverseerState)',
    ]) {
        assertSnippet(text, snippet);
    }
});
