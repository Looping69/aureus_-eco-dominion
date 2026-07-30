import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
    const filePath = path.join(process.cwd(), relativePath);
    assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
    return readFileSync(filePath, 'utf8');
}

function assertContains(text: string, snippet: string): void {
    assert.equal(text.includes(snippet), true, `Expected source to include: ${snippet}`);
}

test('App modal visibility formulas are delegated to the modal visibility helper', () => {
    const app = source('App.tsx');
    const helper = source('game/ui/appModalVisibility.ts');

    assertContains(app, "from './game/ui/appModalVisibility'");
    assertContains(app, 'const modalVisibility = useMemo(() => getAppModalVisibility({');
    assertContains(app, 'const {');
    assertContains(app, 'hoverTooltipHidden,');
    assertContains(app, '} = modalVisibility;');
    assertContains(helper, 'export function getAppModalVisibility');

    for (const staleInlineSnippet of [
        "const eraModalOpen = Boolean(!showHomePage && !isIntroAnim && state?.eraUnlockedPopup && state.eraUnlockedPopup !== dismissedEraPopup);",
        "const placementModalOpen = Boolean(!eraModalOpen && !showWorldMap && !state?.isFPS && pendingPlacementPos && state?.selectedBuilding && !isLinePlacementType(state.selectedBuilding));",
        "const tileModalOpen = Boolean(!eraModalOpen && !showWorldMap && !placementModalOpen && !state?.isFPS && selectedTilePos && selectedTileCanOpenModal);",
        "const blockingModalOpen = eraModalOpen || showWorldMap || placementModalOpen || tileModalOpen;",
        "const floatingHudVisible = !blockingModalOpen && !state?.isFPS;",
        "const sidebarsVisible = !blockingModalOpen && !state?.isFPS;",
        "const debugVisible = Boolean(state?.debugMode && !eraModalOpen && !showWorldMap && !placementModalOpen && !tileModalOpen);",
        "const hoverTooltipHidden = Boolean(showHomePage || isIntroAnim || blockingModalOpen || state?.isFPS || linePlacementStart || sidebarOpen !== 'NONE');",
    ]) {
        assert.equal(app.includes(staleInlineSnippet), false, `App.tsx should not keep inline modal visibility formula: ${staleInlineSnippet}`);
    }
});
