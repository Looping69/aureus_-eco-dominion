import type { SidebarMode } from '../../types';

export type EscapeKeyAction =
    | 'EXIT_FPS'
    | 'DISMISS_ERA'
    | 'CLOSE_WORLD_MAP'
    | 'CLEAR_PLACEMENT'
    | 'CLEAR_SELECTED_TILE'
    | 'CLOSE_SIDEBAR';

export interface EscapeKeyActionInput {
    showHomePage: boolean;
    isFPS: boolean;
    eraModalOpen: boolean;
    showWorldMap: boolean;
    hasPendingPlacement: boolean;
    hasSelectedTile: boolean;
    sidebarOpen: SidebarMode;
}

export function getEscapeKeyAction(input: EscapeKeyActionInput): EscapeKeyAction | null {
    if (input.showHomePage) return null;
    if (input.isFPS) return 'EXIT_FPS';
    if (input.eraModalOpen) return 'DISMISS_ERA';
    if (input.showWorldMap) return 'CLOSE_WORLD_MAP';
    if (input.hasPendingPlacement) return 'CLEAR_PLACEMENT';
    if (input.hasSelectedTile) return 'CLEAR_SELECTED_TILE';
    if (input.sidebarOpen !== 'NONE') return 'CLOSE_SIDEBAR';

    return null;
}
