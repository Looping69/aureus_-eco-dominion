import type { SidebarMode } from '../../types';

export interface AppModalVisibilityInput {
    showHomePage: boolean;
    isIntroAnim: boolean;
    eraUnlockedPopup: unknown;
    dismissedEraPopup: unknown;
    showWorldMap: boolean;
    isFPS: boolean;
    hasPendingPlacement: boolean;
    hasSelectedBuilding: boolean;
    selectedBuildingIsLinePlacement: boolean;
    hasSelectedTile: boolean;
    selectedTileCanOpenModal: boolean;
    debugMode: boolean;
    hasLinePlacementStart: boolean;
    sidebarOpen: SidebarMode;
}

export interface AppModalVisibility {
    eraModalOpen: boolean;
    placementModalOpen: boolean;
    tileModalOpen: boolean;
    blockingModalOpen: boolean;
    floatingHudVisible: boolean;
    sidebarsVisible: boolean;
    debugVisible: boolean;
    hoverTooltipHidden: boolean;
}

export function getAppModalVisibility(input: AppModalVisibilityInput): AppModalVisibility {
    const eraModalOpen = Boolean(
        !input.showHomePage
        && !input.isIntroAnim
        && input.eraUnlockedPopup
        && input.eraUnlockedPopup !== input.dismissedEraPopup
    );
    const placementModalOpen = Boolean(
        !eraModalOpen
        && !input.showWorldMap
        && !input.isFPS
        && input.hasPendingPlacement
        && input.hasSelectedBuilding
        && !input.selectedBuildingIsLinePlacement
    );
    const tileModalOpen = Boolean(
        !eraModalOpen
        && !input.showWorldMap
        && !placementModalOpen
        && !input.isFPS
        && input.hasSelectedTile
        && input.selectedTileCanOpenModal
    );
    const blockingModalOpen = eraModalOpen || input.showWorldMap || placementModalOpen || tileModalOpen;

    return {
        eraModalOpen,
        placementModalOpen,
        tileModalOpen,
        blockingModalOpen,
        floatingHudVisible: !blockingModalOpen && !input.isFPS,
        sidebarsVisible: !blockingModalOpen && !input.isFPS,
        debugVisible: Boolean(input.debugMode && !eraModalOpen && !input.showWorldMap && !placementModalOpen && !tileModalOpen),
        hoverTooltipHidden: Boolean(
            input.showHomePage
            || input.isIntroAnim
            || blockingModalOpen
            || input.isFPS
            || input.hasLinePlacementStart
            || input.sidebarOpen !== 'NONE'
        ),
    };
}
