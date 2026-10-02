import { BuildingDef } from '../../types';

export function getMaxBuildingLevel(def: BuildingDef): number {
    if (!def.upgrades || def.upgrades.length === 0) {
        return 1;
    }

    return Math.max(1, ...def.upgrades.map(upgrade => upgrade.level));
}

export function resolveBuildingDefinition(def: BuildingDef, level: number = 1): BuildingDef {
    if (!def.upgrades || level <= 1) {
        return def;
    }

    const upgrade = def.upgrades.find(candidate => candidate.level === level);
    if (!upgrade) {
        return def;
    }

    return {
        ...def,
        ...upgrade,
        desc: upgrade.description || def.desc,
    };
}

export function getVisualBuildingLevel(
    def: BuildingDef,
    currentLevel: number = 1,
    isUnderConstruction: boolean = false,
    progress: number = 1
): number {
    const maxLevel = getMaxBuildingLevel(def);

    if (!isUnderConstruction || maxLevel <= 1) {
        return Math.max(1, Math.min(maxLevel, currentLevel || 1));
    }

    const clampedProgress = Math.max(0, Math.min(0.999999, progress));
    const stagedLevel = 1 + Math.floor(clampedProgress * maxLevel);
    return Math.max(1, Math.min(maxLevel, stagedLevel));
}
