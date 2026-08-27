import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const studioPath = path.join(root, 'components', 'DesignStudio.tsx');
const layoutCssPath = path.join(root, 'components', 'DesignStudio.css');

function source(filePath: string) {
    assert.equal(existsSync(filePath), true, `${filePath} is missing`);
    return readFileSync(filePath, 'utf8');
}

function assertSnippet(text: string, snippet: string) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('design studio loads dedicated layout containment styles', () => {
    const studioText = source(studioPath);
    const cssText = source(layoutCssPath);

    assertSnippet(studioText, "import './DesignStudio.css';");
    assertSnippet(cssText, 'main:has(section canvas)');
    assertSnippet(cssText, 'overflow-x: hidden;');
});

test('voxel workbench canvas is bounded inside its grid column', () => {
    const cssText = source(layoutCssPath);

    for (const snippet of [
        'section:has(canvas) {',
        'min-width: 0;',
        'max-width: 100%;',
        'grid-template-columns: minmax(0, 1fr);',
        'grid-template-columns: minmax(0, 1fr) minmax(17rem, 19rem);',
        'height: min(62svh, 34rem);',
        'overflow: hidden;',
        'canvas {',
        'display: block !important;',
        'width: 100% !important;',
        'height: 100% !important;',
        'max-width: 100% !important;',
        'touch-action: none;',
    ]) {
        assertSnippet(cssText, snippet);
    }
});

test('design studio controls wrap and editor panel scrolls without overlap', () => {
    const cssText = source(layoutCssPath);

    for (const snippet of [
        'grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));',
        'section:has(canvas) > div:first-child > div:last-child > *',
        'min-width: 0 !important;',
        'width: 100%;',
        'justify-content: center;',
        'section:has(canvas) > div:nth-child(2) > div:nth-child(2)',
        'overflow-y: auto;',
        'max-height: min(62svh, 34rem);',
        'white-space: pre-wrap;',
        'word-break: break-word;',
    ]) {
        assertSnippet(cssText, snippet);
    }
});

test('design studio has explicit phone viewport safeguards', () => {
    const cssText = source(layoutCssPath);

    for (const snippet of [
        '@media (max-width: 640px)',
        'padding-left: 0.75rem !important;',
        'padding-right: 0.75rem !important;',
        'grid-template-columns: repeat(2, minmax(0, 1fr));',
        'height: 58svh;',
        'min-height: 20rem;',
        'max-width: calc(100% - 1.5rem);',
    ]) {
        assertSnippet(cssText, snippet);
    }
});
