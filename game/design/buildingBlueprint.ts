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

export const BUILDING_BLUEPRINT_STORAGE_KEY = 'aureus.buildingBlueprints.v2';
export const BUILDING_DETAIL_GRID_STEP = 0.25;
export const BUILDING_DETAIL_PART_SIZE = 0.18;

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
                return { buildingType, parts, updatedAt: Number(parsed.updatedAt) || Date.now() };
            }
        } catch {
            // Fall through to an empty edit layer over the real game model.
        }
    }

    return createDefaultBuildingBlueprint(buildingType);
}

export function saveBuildingBlueprint(blueprint: BuildingBlueprint): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
        getBlueprintStorageKey(blueprint.buildingType),
        JSON.stringify({ ...blueprint, parts: dedupeParts(blueprint.parts), updatedAt: Date.now() }),
    );
}

export function createDefaultBuildingBlueprint(buildingType: BuildingType): BuildingBlueprint {
    return { buildingType, parts: [], updatedAt: Date.now() };
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
    const sx = snapToDetailGrid(x);
    const sy = snapToDetailGrid(y);
    const sz = snapToDetailGrid(z);
    return { id: formatPartId(sx, sy, sz), x: sx, y: sy, z: sz, role };
}

export function dedupeParts(parts: BuildingVoxelPart[]): BuildingVoxelPart[] {
    const byId = new Map<string, BuildingVoxelPart>();
    for (const part of parts) {
        const normalized = normalizeVoxelPart(part);
        byId.set(normalized.id, normalized);
    }
    return Array.from(byId.values()).sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
}

export function getBuildingDisplayName(buildingType: BuildingType): string {
    return BUILDINGS[buildingType]?.name || buildingType.replace(/_/g, ' ');
}

export function snapToDetailGrid(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Number((Math.round(value / BUILDING_DETAIL_GRID_STEP) * BUILDING_DETAIL_GRID_STEP).toFixed(2));
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
    const x = Math.max(-8, Math.min(8, snapToDetailGrid(part.x)));
    const y = Math.max(0, Math.min(12, snapToDetailGrid(part.y)));
    const z = Math.max(-8, Math.min(8, snapToDetailGrid(part.z)));
    return createPart(x, y, z, part.role);
}

function formatPartId(x: number, y: number, z: number): string {
    return `${x.toFixed(2)}:${y.toFixed(2)}:${z.toFixed(2)}`;
}
