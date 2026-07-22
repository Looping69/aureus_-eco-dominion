export interface AppPlacementPromptReset {
    pendingPlacementPos: null;
    pinnedTilePos: null;
    linePlacementStart: null;
}

export function getPlacementPromptReset(): AppPlacementPromptReset {
    return {
        pendingPlacementPos: null,
        pinnedTilePos: null,
        linePlacementStart: null,
    };
}
