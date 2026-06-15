import { BuildingType } from '../../types';
import { BUILDINGS } from '../../engine/data/buildings';
import { BuildingStyleSettings } from './buildingStyle';

export type BuildingVoxelRole = 'wall' | 'roof' | 'accent' | 'greenery';

export interface BuildingVoxelPart {
    id: string;
    x: number;
    y: number;
    z: number;
    role: BuildingVoxelRole;
}

export interface BuildingBlueprint {
    buildingType: BuildingType;
    parts: BuildingVoxelPart[];
    updatedAt: number;
}

export const BUILDING_BLUEPRINT_STORAGE_KEY = 'aureus.buildingBlueprints.v1';

export const DESIGNABLE_BUILDINGS: BuildingType[] = [
    BuildingType.STAFF_QUARTERS,
    BuildingType.STOCKPILE,
    BuildingType.MINING_HEADFRAME,
    BuildingType.WASH_PLANT,
    BuildingType.STORAGE_DEPOT,
    BuildingType.WORKSHOP,
    BuildingType.SOLAR_ARRAY,
    BuildingType.WATER_WELL,
    BuildingType.SAWMILL,
    BuildingType.STONE_QUARRY,
    BuildingType.MEDICAL_BAY,
    BuildingType.TRAINING_CENTER,
];

export function getBlueprintStorageKey(buildingType: BuildingType): string {
    return `${BUILDING_BLUEPRINT_STORAGE_KEY}.${buildingType}`;
}

export function loadBuildingBlueprint(buildingType: BuildingType): BuildingBlueprint {
    if (typeof window !== 'undefined') {
        try {
            const raw = window.localStorage.getItem(getBlueprintStorageKey(buildingType));
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<BuildingBlueprint>;
                const parts = Array.isArray(parsed.parts)
                    ? parsed.parts.filter(isValidVoxelPart).map(normalizeVoxelPart)
                    : [];
                if (parts.length > 0) {
                    return { buildingType, parts, updatedAt: Number(parsed.updatedAt) || Date.now() };
                }
            }
        } catch {
            // Fall through to a generated starter blueprint.
        }
    }

    return createDefaultBuildingBlueprint(buildingType);
}

export function saveBuildingBlueprint(blueprint: BuildingBlueprint): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
        getBlueprintStorageKey(blueprint.buildingType),
        JSON.stringify({ ...blueprint, updatedAt: Date.now() }),
    );
}

export function createDefaultBuildingBlueprint(buildingType: BuildingType): BuildingBlueprint {
    const def = BUILDINGS[buildingType];
    const width = Math.max(1, Math.min(6, def?.width || 2));
    const depth = Math.max(1, Math.min(6, def?.depth || 2));
    const parts: BuildingVoxelPart[] = [];
    const xOffset = Math.floor(width / 2);
    const zOffset = Math.floor(depth / 2);

    for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
            parts.push(createPart(x - xOffset, 0, z - zOffset, 'wall'));
            if (x === 0 || z === 0 || x === width - 1 || z === depth - 1) {
                parts.push(createPart(x - xOffset, 1, z - zOffset, 'wall'));
            }
            parts.push(createPart(x - xOffset, 2, z - zOffset, getRoofRole(buildingType)));
        }
    }

    const accentX = Math.min(width - 1, Math.max(0, Math.floor(width / 2))) - xOffset;
    parts.push(createPart(accentX, 1, -zOffset - 1, 'accent'));

    return { buildingType, parts: dedupeParts(parts), updatedAt: Date.now() };
}

export function getVoxelRoleColor(role: BuildingVoxelRole, settings: BuildingStyleSettings): string {
    switch (role) {
        case 'roof': return settings.roofColor;
        case 'accent': return settings.accentColor;
        case 'greenery': return '#5f8f4f';
        case 'wall':
        default:
            return settings.wallColor;
    }
}

export function createPart(x: number, y: number, z: number, role: BuildingVoxelRole): BuildingVoxelPart {
    return { id: `${x}:${y}:${z}`, x, y, z, role };
}

export function dedupeParts(parts: BuildingVoxelPart[]): BuildingVoxelPart[] {
    const byId = new Map<string, BuildingVoxelPart>();
    for (const part of parts) {
        byId.set(`${part.x}:${part.y}:${part.z}`, { ...part, id: `${part.x}:${part.y}:${part.z}` });
    }
    return Array.from(byId.values()).sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
}

export function getBuildingDisplayName(buildingType: BuildingType): string {
    return BUILDINGS[buildingType]?.name || buildingType.replace(/_/g, ' ');
}

function getRoofRole(buildingType: BuildingType): BuildingVoxelRole {
    if (buildingType === BuildingType.COMMUNITY_GARDEN || buildingType === BuildingType.NATURE_RESERVE) {
        return 'greenery';
    }
    return 'roof';
}

function isValidVoxelPart(value: unknown): value is BuildingVoxelPart {
    const part = value as BuildingVoxelPart;
    return !!part
        && Number.isFinite(part.x)
        && Number.isFinite(part.y)
        && Number.isFinite(part.z)
        && ['wall', 'roof', 'accent', 'greenery'].includes(part.role);
}

function normalizeVoxelPart(part: BuildingVoxelPart): BuildingVoxelPart {
    const x = Math.max(-8, Math.min(8, Math.round(part.x)));
    const y = Math.max(0, Math.min(12, Math.round(part.y)));
    const z = Math.max(-8, Math.min(8, Math.round(part.z)));
    return createPart(x, y, z, part.role);
}
