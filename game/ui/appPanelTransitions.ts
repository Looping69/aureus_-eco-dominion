import type { SidebarMode } from '../../types';

export interface AppPanelOpenTransition {
    showWorldMap: boolean;
    sidebarOpen: SidebarMode;
    selectedTilePos: null;
    activeHUDBlock: null;
}

export interface AppTileInteractionPanelReset {
    showWorldMap: false;
    sidebarOpen: 'NONE';
    selectedTilePos: null;
}

function createPanelOpenTransition(showWorldMap: boolean, sidebarOpen: SidebarMode): AppPanelOpenTransition {
    return {
        showWorldMap,
        sidebarOpen,
        selectedTilePos: null,
        activeHUDBlock: null,
    };
}

export function getClosedPanelTransition(): AppPanelOpenTransition {
    return createPanelOpenTransition(false, 'NONE');
}

export function getTileInteractionPanelReset(): AppTileInteractionPanelReset {
    return {
        showWorldMap: false,
        sidebarOpen: 'NONE',
        selectedTilePos: null,
    };
}

export function getSidebarOpenTransition(mode: SidebarMode): AppPanelOpenTransition {
    return createPanelOpenTransition(false, mode);
}

export function getWorldMapOpenTransition(): AppPanelOpenTransition {
    return createPanelOpenTransition(true, 'NONE');
}
