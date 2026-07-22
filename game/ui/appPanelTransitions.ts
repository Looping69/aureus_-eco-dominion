import type { SidebarMode } from '../../types';

export interface AppPanelOpenTransition {
    showWorldMap: boolean;
    sidebarOpen: SidebarMode;
    selectedTilePos: null;
    activeHUDBlock: null;
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

export function getSidebarOpenTransition(mode: SidebarMode): AppPanelOpenTransition {
    return createPanelOpenTransition(false, mode);
}

export function getWorldMapOpenTransition(): AppPanelOpenTransition {
    return createPanelOpenTransition(true, 'NONE');
}
