import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const servicePath = path.join(root, 'services', 'overseerLocalQwen.ts');
const panelPath = path.join(root, 'components', 'AIOverseerPanel.tsx');
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

test('overseer panel exposes Qwen as on-demand advice instead of sim-loop automation', () => {
    const text = source(panelPath);

    for (const snippet of [
        'generateOverseerLocalInsight',
        'OVERSEER_LOCAL_QWEN_CONFIG',
        'Local Qwen',
        'Ask local Qwen for an overseer recommendation',
        "qwenStatus === 'loading'",
        'local browser model',
    ]) {
        assertSnippet(text, snippet);
    }

    assert.doesNotMatch(text, /commandQueue\.push\(\{[^}]*Qwen/is);
});
