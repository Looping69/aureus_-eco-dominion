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

test('top HUD collapses into a compact phone status strip', () => {
    assert.match(viewSwitchCss, /\.absolute\.top-0\.left-0\.right-0\.z-10 \{/);
    assert.match(viewSwitchCss, /\.absolute\.top-0\.left-0\.right-0\.z-10 > div \{/);
    assert.match(viewSwitchCss, /flex-direction: row !important;/);
    assert.match(viewSwitchCss, /overflow-x: auto;/);
    assert.match(viewSwitchCss, /scroll-snap-type: x proximity;/);
    assert.match(viewSwitchCss, /section\[aria-label\$="HUD cluster"\]/);
    assert.match(viewSwitchCss, /section\[aria-label="Materials HUD cluster"\]/);
    assert.match(viewSwitchCss, /section\[aria-label="Industry \/ Logistics HUD cluster"\]/);
    assert.match(viewSwitchCss, /display: none;/);
    assert.match(viewSwitchCss, /grid-template-rows: 0fr !important;/);
});

test('bottom command rail has phone-safe gutters and tap anchors', () => {
    assert.match(viewSwitchCss, /@media \(max-width: 640px\) \{/);
    assert.match(viewSwitchCss, /div:has\(> details #command-rail-panel\) \{/);
    assert.match(viewSwitchCss, /bottom: max\(0\.75rem, env\(safe-area-inset-bottom\)\) !important;/);
    assert.match(viewSwitchCss, /left: 0\.5rem !important;/);
    assert.match(viewSwitchCss, /right: 0\.5rem !important;/);
    assert.match(viewSwitchCss, /gap: 0\.5rem !important;/);
    assert.match(viewSwitchCss, /align-items: flex-end;/);

    assert.match(viewSwitchCss, /div:has\(> details #command-rail-panel\) > button \{/);
    assert.match(viewSwitchCss, /width: 3\.25rem !important;/);
    assert.match(viewSwitchCss, /height: 3\.25rem !important;/);
    assert.match(viewSwitchCss, /padding-left: 0 !important;/);
    assert.match(viewSwitchCss, /padding-right: 0 !important;/);
    assert.match(viewSwitchCss, /flex-shrink: 0;/);
});

test('expanded command rail is bounded and scrollable on phones', () => {
    assert.match(viewSwitchCss, /details:has\(#command-rail-panel\) \{/);
    assert.match(viewSwitchCss, /max-width: calc\(100vw - 7\.5rem\) !important;/);
    assert.match(viewSwitchCss, /details:has\(#command-rail-panel\) > summary \{/);
    assert.match(viewSwitchCss, /max-width: 100%;/);
    assert.match(viewSwitchCss, /overflow: hidden;/);
    assert.match(viewSwitchCss, /#command-rail-panel > div \{/);
    assert.match(viewSwitchCss, /max-height: 30svh;/);
    assert.match(viewSwitchCss, /overflow-y: auto !important;/);
    assert.match(viewSwitchCss, /overscroll-behavior: contain;/);
});

test('selected-agent and inventory HUDs stay in the bottom command band', () => {
    assert.match(agentHud, /bottom-\[8\.75rem\] left-2 right-2 z-\[70\] w-auto pointer-events-none/);
    assert.match(agentHud, /sm:bottom-28 sm:left-1\/2 sm:right-auto sm:w-\[min\(24rem,calc\(100vw-2rem\)\)\] sm:-translate-x-1\/2/);
    assert.match(agentHud, /flex max-w-\[48%\] shrink-0 items-center gap-1\.5 overflow-hidden/);
    assert.match(viewSwitchCss, /\.absolute\.bottom-\\\[8\\\.75rem\\\]\.left-2\.right-2\.z-\\\[70\\\] \{/);
    assert.match(viewSwitchCss, /bottom: calc\(4\.9rem \+ env\(safe-area-inset-bottom\)\) !important;/);
    assert.match(viewSwitchCss, /\.absolute\.bottom-36\.sm\\:bottom-28\.left-1\\\/2\.-translate-x-1\\\/2\.z-30 \{/);
    assert.match(viewSwitchCss, /max-height: 6\.75rem;/);
});

test('left floating stack and minimap stop competing with core mobile play space', () => {
    assert.match(app, /absolute top-14 left-2 sm:left-4 z-40 flex flex-col gap-2 items-start pointer-events-none/);
    assert.match(viewSwitchCss, /\.absolute\.top-14\.left-2\.z-40 \{/);
    assert.match(viewSwitchCss, /display: none !important;/);
    assert.match(viewSwitchCss, /\.absolute\.top-20\.right-2 \{/);
    assert.match(viewSwitchCss, /top: 3\.25rem !important;/);
    assert.match(viewSwitchCss, /\.absolute\.top-20\.right-2 canvas \{/);
    assert.match(viewSwitchCss, /width: min\(8rem, 38vw\) !important;/);
});

test('open mobile drawers own the screen and suppress background HUD layers', () => {
    for (const drawerSelector of [
        '.fixed.right-0.top-14.bottom-20',
        '.absolute.inset-y-0.left-0.w-full',
        '.fixed.top-0.right-0.h-full',
    ]) {
        assert.match(viewSwitchCss, new RegExp(`\\.relative\\.w-full\\.h-full:has\\(${drawerSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\) \\.absolute\\.top-0\\.left-0\\.right-0\\.z-10`));
        assert.match(viewSwitchCss, new RegExp(`\\.relative\\.w-full\\.h-full:has\\(${drawerSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\) div:has\\(> details #command-rail-panel\\)`));
    }

    assert.match(viewSwitchCss, /opacity: 0 !important;/);
    assert.match(viewSwitchCss, /pointer-events: none !important;/);
    assert.match(viewSwitchCss, /transform: translateY\(0\.5rem\) !important;/);
    assert.match(viewSwitchCss, /transition: opacity 160ms ease, transform 160ms ease;/);
    assert.match(viewSwitchCss, /\.fixed\.right-0\.top-14\.bottom-20,/);
    assert.match(viewSwitchCss, /\.absolute\.inset-y-0\.left-0\.w-full,/);
    assert.match(viewSwitchCss, /\.fixed\.top-0\.right-0\.h-full \{/);
    assert.match(viewSwitchCss, /inset: 4\.25rem 0\.75rem calc\(0\.75rem \+ env\(safe-area-inset-bottom\)\) 0\.75rem !important;/);
    assert.match(viewSwitchCss, /width: auto !important;/);
    assert.match(viewSwitchCss, /max-width: none !important;/);
    assert.match(viewSwitchCss, /height: auto !important;/);
    assert.match(viewSwitchCss, /z-index: 140 !important;/);
    assert.match(viewSwitchCss, /border-radius: 8px !important;/);
});
