import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const controls = readFileSync('components/Controls.tsx', 'utf8');
const viewSwitchCss = readFileSync('components/ViewSwitchButton.css', 'utf8');
const agentHud = readFileSync('components/AgentCommandHUD.tsx', 'utf8');
const app = readFileSync('App.tsx', 'utf8');

test('controls load the mobile HUD safety stylesheet', () => {
    assert.match(controls, /import '\.\.\/components\/ViewSwitchButton\.css';/);
});

test('bottom command rail has phone-safe gutters and tap anchors', () => {
    assert.match(viewSwitchCss, /@media \(max-width: 640px\) \{/);
    assert.match(viewSwitchCss, /div:has\(> details #command-rail-panel\) \{/);
    assert.match(viewSwitchCss, /left: 0\.5rem !important;/);
    assert.match(viewSwitchCss, /right: 0\.5rem !important;/);
    assert.match(viewSwitchCss, /gap: 0\.5rem !important;/);
    assert.match(viewSwitchCss, /align-items: flex-end;/);

    assert.match(viewSwitchCss, /div:has\(> details #command-rail-panel\) > button \{/);
    assert.match(viewSwitchCss, /width: 3rem !important;/);
    assert.match(viewSwitchCss, /height: 3rem !important;/);
    assert.match(viewSwitchCss, /padding-left: 0 !important;/);
    assert.match(viewSwitchCss, /padding-right: 0 !important;/);
    assert.match(viewSwitchCss, /flex-shrink: 0;/);
});

test('expanded command rail is bounded and scrollable on phones', () => {
    assert.match(viewSwitchCss, /details:has\(#command-rail-panel\) \{/);
    assert.match(viewSwitchCss, /max-width: calc\(100vw - 7rem\) !important;/);
    assert.match(viewSwitchCss, /#command-rail-panel > div \{/);
    assert.match(viewSwitchCss, /max-height: 42svh;/);
    assert.match(viewSwitchCss, /overflow-y: auto !important;/);
    assert.match(viewSwitchCss, /overscroll-behavior: contain;/);
});

test('selected-agent command HUD uses mobile-safe anchoring', () => {
    assert.match(agentHud, /bottom-\[8\.75rem\] left-2 right-2 z-\[70\] w-auto pointer-events-none/);
    assert.match(agentHud, /sm:bottom-28 sm:left-1\/2 sm:right-auto sm:w-\[min\(24rem,calc\(100vw-2rem\)\)\] sm:-translate-x-1\/2/);
    assert.match(agentHud, /px-2\.5 py-2\.5[\s\S]*sm:px-3/);
    assert.match(agentHud, /justify-between gap-2 sm:gap-3/);
    assert.match(agentHud, /flex max-w-\[48%\] shrink-0 items-center gap-1\.5 overflow-hidden/);
    assert.match(agentHud, /<span className=\{`truncate rounded-\[3px\] border px-2 py-1 font-mono text-\[9px\] font-bold uppercase \$\{orderToneClass\}`\}>/);
    assert.match(agentHud, /<span className="truncate rounded-\[3px\] border border-slate-500\/50 bg-slate-800\/80 px-2 py-1 font-mono text-\[9px\] font-bold uppercase text-slate-200">/);
});

test('left floating HUD stack is constrained on narrow screens', () => {
    assert.match(app, /absolute top-14 left-2 sm:left-4 z-40 flex flex-col gap-2 items-start pointer-events-none/);
    assert.match(viewSwitchCss, /\.absolute\.top-14\.left-2\.z-40 \{/);
    assert.match(viewSwitchCss, /right: 0\.5rem;/);
    assert.match(viewSwitchCss, /max-width: calc\(100vw - 1rem\);/);
});
