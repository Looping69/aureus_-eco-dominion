import type { BuildingType } from '../../types';

export interface AppPlacementTilePos {
    x: number;
    z: number;
}

export interface AppLinePlacementStart extends AppPlacementTilePos {
    type: BuildingType;
}

export interface AppPlacementPromptReset {
    pendingPlacementPos: null;
    pinnedTilePos: null;
    linePlacementStart: null;
}

export interface AppLinePlacementClearReset {
    linePlacementStart: null;
}

export interface AppLinePlacementStartPrompt {
    pendingPlacementPos: null;
    pinnedTilePos: AppPlacementTilePos;
    linePlacementStart: AppLinePlacementStart;
}

export interface AppInspectTilePlacementReset {
    pendingPlacementPos: null;
    pinnedTilePos: null;
}

export function getPlacementPromptReset(): AppPlacementPromptReset {
    return {
        pendingPlacementPos: null,
        pinnedTilePos: null,
        linePlacementStart: null,
    };
}

export function getLinePlacementClearReset(): AppLinePlacementClearReset {
    return {
        linePlacementStart: null,
    };
}

export function getLinePlacementStartPrompt(x: number, z: number, type: BuildingType): AppLinePlacementStartPrompt {
    return {
        pendingPlacementPos: null,
        pinnedTilePos: { x, z },
        linePlacementStart: { x, z, type },
    };
}

export function getInspectTilePlacementReset(): AppInspectTilePlacementReset {
    return {
        pendingPlacementPos: null,
        pinnedTilePos: null,
    };
}
