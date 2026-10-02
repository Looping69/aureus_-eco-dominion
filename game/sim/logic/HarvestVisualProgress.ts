export const HARVEST_VISUAL_STAGE_COUNT = 5;
export const HARVEST_VISUAL_STAGE_SIZE = 100 / HARVEST_VISUAL_STAGE_COUNT;

export function getHarvestVisualStage(integrity: number | undefined): number {
    if (integrity === undefined || !Number.isFinite(integrity)) return 0;
    const clampedIntegrity = Math.max(0, Math.min(100, integrity));
    return Math.min(HARVEST_VISUAL_STAGE_COUNT - 1, Math.floor((100 - clampedIntegrity) / HARVEST_VISUAL_STAGE_SIZE));
}
