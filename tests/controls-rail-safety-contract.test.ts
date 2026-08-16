import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const controls = readFileSync('components/Controls.tsx', 'utf8');

test('controls rail uses a native collapsible command surface', () => {
    assert.doesNotMatch(controls, /useState/);
    assert.doesNotMatch(controls, /ChevronDown/);
    assert.doesNotMatch(controls, /commandRailCollapsed/);
    assert.doesNotMatch(controls, /command-rail-actions/);
    assert.doesNotMatch(controls, /peer-checked/);

    assert.match(controls, /<details className="group pointer-events-auto self-end pb-1/);
    assert.match(controls, /<summary[\s\S]*aria-controls="command-rail-panel"/);
    assert.match(controls, /id="command-rail-panel"/);
    assert.match(controls, /transition-\[grid-template-rows,opacity,transform\]/);
    assert.match(controls, /group-open:grid-rows-\[1fr\]/);
    assert.match(controls, /group-open:opacity-100/);
    assert.match(controls, /group-open:translate-y-0/);
});

test('controls rail summary pills expose current command context', () => {
    assert.match(controls, /const commandContextLabel = selectedAgentId \? 'Agent' : isBelowSurface \|\| activeView === 'DUNGEON' \? 'Dungeon' : 'Surface';/);
    assert.match(controls, /const overlaySummaryLabel = overlayMode === 'WATER' \? 'Water' : normalizedOverlayMode === 'OFF' \? 'No overlay' : normalizedOverlayMode;/);
    assert.match(controls, /const layerSummaryLabel = canUseLayerTools \? `L\$\{activeLayer\}` : 'L0';/);
    assert.match(controls, /\{commandContextLabel\}/);
    assert.match(controls, /\{overlaySummaryLabel\}/);
    assert.match(controls, /\{layerSummaryLabel\}/);
    assert.match(controls, /selectedAgentId \? 'border-indigo-400\/60 bg-indigo-500\/15 text-indigo-100'/);
    assert.match(controls, /activeView === 'DUNGEON' \? 'border-amber-400\/60 bg-amber-500\/15 text-amber-100'/);
});

test('controls rail summary includes the active interaction tool', () => {
    assert.match(controls, /const TOOL_SUMMARY_LABEL: Record<ControlsProps\['interactionMode'\], string> = \{/);
    for (const label of ['Build', 'Bulldoze', 'Inspect', 'Test', 'Dig', 'Dump', 'Fill']) {
        assert.match(controls, new RegExp(`${label}'`));
    }
    assert.match(controls, /const activeToolLabel = TOOL_SUMMARY_LABEL\[interactionMode\];/);
    assert.match(controls, /const activeToolClassName = interactionMode === 'DIG' \|\| interactionMode === 'DUMP_RUBBLE' \|\| interactionMode === 'FILL_RUBBLE'/);
    assert.match(controls, /interactionMode === 'BULLDOZE' \|\| interactionMode === 'TEST_DESTRUCT'/);
    assert.match(controls, /interactionMode === 'BUILD'/);
    assert.match(controls, /\$\{activeToolClassName\}`}>\{activeToolLabel\}<\/span>/);
});

test('controls rail keeps stable command anchors through the collapse redesign', () => {
    assert.match(controls, /setSidebarOpen\('OPS'\)/);
    assert.match(controls, /setSidebarOpen\('SHOP'\)/);
    assert.ok(controls.indexOf("setSidebarOpen('OPS')") < controls.indexOf("setSidebarOpen('SHOP')"));
    assert.match(controls, /highlightOps \? 'animate-bounce border-emerald-400 z-50' : ''/);
    assert.match(controls, /highlightBuild \? 'highlight-pulse z-50 ring-4 ring-emerald-400' : ''/);

    assert.match(controls, /dispatch\(\{ type: 'TOGGLE_DEBUG' \}\)/);
    assert.match(controls, /dispatch\(\{ type: 'UPDATE_LOGISTICS', payload: \{ overlayMode: nextOverlayMode \} \}\)/);
    assert.match(controls, /toggleWaterView\(\)/);
    assert.match(controls, /toggleAudio\(\)/);
    assert.match(controls, /href="\/design-studio"/);
    assert.match(controls, /setSidebarOpen\('TRADE'\)/);
    assert.match(controls, /dispatch\(\{ type: 'SELECT_ALL_COLONY_AGENTS' \}\)/);
    assert.match(controls, /dispatch\(\{ type: 'ENTER_FPS', payload: selectedAgentId \}\)/);
    assert.match(controls, /onToggleView\(\)/);
});

test('controls layer tools preserve underground command behavior', () => {
    assert.match(controls, /const canUseLayerTools = activeView === 'SURFACE' && \(undergroundUnlocked \|\| debugMode\);/);
    assert.match(controls, /dispatch\(\{ type: 'SET_LAYERED_ACTIVE_Y', payload: lowerLayer \}\)/);
    assert.match(controls, /setLayerTool\('DIG'\)/);
    assert.match(controls, /setLayerTool\('DUMP_RUBBLE'\)/);
    assert.match(controls, /setLayerTool\('FILL_RUBBLE'\)/);
    assert.match(controls, /dispatch\(\{ type: 'SET_LAYERED_ACTIVE_Y', payload: upperLayer \}\)/);
});
