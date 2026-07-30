import test from 'node:test';
import assert from 'node:assert/strict';

import { getAppModalVisibility, type AppModalVisibilityInput } from '../game/ui/appModalVisibility.ts';

const base: AppModalVisibilityInput = {
    showHomePage: false,
    isIntroAnim: false,
    eraUnlockedPopup: null,
    dismissedEraPopup: null,
    showWorldMap: false,
    isFPS: false,
    hasPendingPlacement: false,
    hasSelectedBuilding: false,
    selectedBuildingIsLinePlacement: false,
    hasSelectedTile: false,
    selectedTileCanOpenModal: false,
    debugMode: false,
    hasLinePlacementStart: false,
    sidebarOpen: 'NONE',
};

test('App modal visibility helper keeps modal blocking priority', () => {
    assert.deepEqual(getAppModalVisibility(base), {
        eraModalOpen: false,
        placementModalOpen: false,
        tileModalOpen: false,
        blockingModalOpen: false,
        floatingHudVisible: true,
        sidebarsVisible: true,
        debugVisible: false,
        hoverTooltipHidden: false,
    });

    assert.equal(getAppModalVisibility({ ...base, eraUnlockedPopup: 'GROWTH' }).eraModalOpen, true);
    assert.equal(getAppModalVisibility({ ...base, eraUnlockedPopup: 'GROWTH', dismissedEraPopup: 'GROWTH' }).eraModalOpen, false);
    assert.equal(getAppModalVisibility({ ...base, hasPendingPlacement: true, hasSelectedBuilding: true }).placementModalOpen, true);
    assert.equal(getAppModalVisibility({ ...base, hasPendingPlacement: true, hasSelectedBuilding: true, selectedBuildingIsLinePlacement: true }).placementModalOpen, false);
    assert.equal(getAppModalVisibility({ ...base, hasSelectedTile: true, selectedTileCanOpenModal: true }).tileModalOpen, true);
    assert.equal(getAppModalVisibility({ ...base, showWorldMap: true, hasSelectedTile: true, selectedTileCanOpenModal: true }).tileModalOpen, false);
});

test('App modal visibility helper preserves HUD, debug, and tooltip visibility gates', () => {
    assert.equal(getAppModalVisibility({ ...base, showWorldMap: true }).floatingHudVisible, false);
    assert.equal(getAppModalVisibility({ ...base, showWorldMap: true }).sidebarsVisible, false);
    assert.equal(getAppModalVisibility({ ...base, isFPS: true }).floatingHudVisible, false);
    assert.equal(getAppModalVisibility({ ...base, isFPS: true }).sidebarsVisible, false);
    assert.equal(getAppModalVisibility({ ...base, debugMode: true }).debugVisible, true);
    assert.equal(getAppModalVisibility({ ...base, debugMode: true, showWorldMap: true }).debugVisible, false);
    assert.equal(getAppModalVisibility({ ...base, showHomePage: true }).hoverTooltipHidden, true);
    assert.equal(getAppModalVisibility({ ...base, hasLinePlacementStart: true }).hoverTooltipHidden, true);
    assert.equal(getAppModalVisibility({ ...base, sidebarOpen: 'SHOP' }).hoverTooltipHidden, true);
});
