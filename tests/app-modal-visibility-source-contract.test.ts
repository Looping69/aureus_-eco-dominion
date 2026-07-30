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

test('App modal visibility formulas remain explicit while helper handoff is pending validation', () => {
    const app = source('App.tsx');
    const helper = source('game/ui/appModalVisibility.ts');

    assertContains(helper, 'export function getAppModalVisibility');
    assertContains(app, "const eraModalOpen = Boolean(!showHomePage && !isIntroAnim && state?.eraUnlockedPopup && state.eraUnlockedPopup !== dismissedEraPopup);");
    assertContains(app, "const placementModalOpen = Boolean(!eraModalOpen && !showWorldMap && !state?.isFPS && pendingPlacementPos && state?.selectedBuilding && !isLinePlacementType(state.selectedBuilding));");
    assertContains(app, "const tileModalOpen = Boolean(!eraModalOpen && !showWorldMap && !placementModalOpen && !state?.isFPS && selectedTilePos && selectedTileCanOpenModal);");
    assertContains(app, "const blockingModalOpen = eraModalOpen || showWorldMap || placementModalOpen || tileModalOpen;");
    assertContains(app, "const floatingHudVisible = !blockingModalOpen && !state?.isFPS;");
    assertContains(app, "const sidebarsVisible = !blockingModalOpen && !state?.isFPS;");
    assertContains(app, "const debugVisible = Boolean(state?.debugMode && !eraModalOpen && !showWorldMap && !placementModalOpen && !tileModalOpen);");
    assertContains(app, "const hoverTooltipHidden = Boolean(showHomePage || isIntroAnim || blockingModalOpen || state?.isFPS || linePlacementStart || sidebarOpen !== 'NONE');");
});
