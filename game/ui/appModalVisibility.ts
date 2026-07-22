import type { BuildingType, SidebarMode } from '../../types';
import { isLinePlacementType } from './tileSelection';

export interface AppModalVisibilityInput {
    showHomePage: boolean;
    isIntroAnim: boolean;
    eraUnlockedPopup: unknown;
    dismissedEraPopup: unknown;
    showWorldMap: boolean;
    isFPS: boolean;
    pendingPlacementPos: unknown;
    selectedBuilding: BuildingType | null | undefined;
    selectedTilePos: unknown;
    selectedTileCanOpenModal: boolean;
    debugMode: boolean;
    linePlacementStart: unknown;
    sidebarOpen: SidebarMode;
}

export interface AppModalVisibilityState {
    eraModalOpen: boolean;
    placementModalOpen: boolean;
    tileModalOpen: boolean;
    blockingModalOpen: boolean;
    floatingHudVisible: boolean;
    sidebarsVisible: boolean;
    debugVisible: boolean;
    hoverTooltipHidden: boolean;
}

export function getAppModalVisibility(input: AppModalVisibilityInput): AppModalVisibilityState {
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
        && input.pendingPlacementPos
        && input.selectedBuilding
        && !isLinePlacementType(input.selectedBuilding)
    );
    const tileModalOpen = Boolean(
        !eraModalOpen
        && !input.showWorldMap
        && !placementModalOpen
        && !input.isFPS
        && input.selectedTilePos
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
            || input.linePlacementStart
            || input.sidebarOpen !== 'NONE'
        ),
    };
}
