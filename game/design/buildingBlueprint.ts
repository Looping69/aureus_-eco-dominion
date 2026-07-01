import { BuildingType } from '../../types';
import { BUILDINGS } from '../../engine/data/buildings';
import { BuildingStyleSettings } from './buildingStyle';

export type BuildingVoxelRole = 'wall' | 'roof' | 'accent' | 'greenery';
export type BuildingVoxelShape = 'block' | 'beam' | 'wedge' | 'cylinder' | 'spire';

export interface BuildingVoxelPart {
    id: string;
    x: number;
    y: number;
    z: number;
    role: BuildingVoxelRole;
    shape?: BuildingVoxelShape;
    scaleX?: number;
    scaleY?: number;
    scaleZ?: number;
    rotationY?: number;
}

export interface BuildingSourceMeshOverride {
    id: string;
    hidden?: boolean;
    color?: string;
    metalness?: number;
    roughness?: number;
}

export interface BuildingBlueprint {
    buildingType: BuildingType;
    parts: BuildingVoxelPart[];
    sourceMeshOverrides?: BuildingSourceMeshOverride[];
    updatedAt: number;
}

export const BUILDING_BLUEPRINT_STORAGE_KEY = 'aureus.buildingBlueprints.v3';
export const BUILDING_DETAIL_GRID_STEP = 0.25;
export const BUILDING_DETAIL_PART_SIZE = 0.18;
export const BUILDING_VOXEL_SHAPES: BuildingVoxelShape[] = ['block', 'beam', 'wedge', 'cylinder', 'spire'];

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
                const sourceMeshOverrides = Array.isArray(parsed.sourceMeshOverrides)
                    ? parsed.sourceMeshOverrides.filter(isValidSourceMeshOverride).map(normalizeSourceMeshOverride)
                    : [];
                return { buildingType, parts, sourceMeshOverrides, updatedAt: Number(parsed.updatedAt) || Date.now() };
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
        JSON.stringify({
            ...blueprint,
            parts: dedupeParts(blueprint.parts),
            sourceMeshOverrides: normalizeSourceMeshOverrides(blueprint.sourceMeshOverrides || []),
            updatedAt: Date.now(),
        }),
    );
}

export function createDefaultBuildingBlueprint(buildingType: BuildingType): BuildingBlueprint {
    return { buildingType, parts: [], sourceMeshOverrides: [], updatedAt: Date.now() };
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

export function createPart(
    x: number,
    y: number,
    z: number,
    role: BuildingVoxelRole,
    shape: BuildingVoxelShape = 'block',
): BuildingVoxelPart {
    const sx = snapToDetailGrid(x);
    const sy = snapToDetailGrid(y);
    const sz = snapToDetailGrid(z);
    const normalizedShape = normalizeVoxelShape(shape);
    return {
        id: formatPartId(sx, sy, sz, normalizedShape),
        x: sx,
        y: sy,
        z: sz,
        role,
        shape: normalizedShape,
        scaleX: normalizedShape === 'beam' ? 2 : 1,
        scaleY: normalizedShape === 'beam' ? 0.5 : 1,
        scaleZ: 1,
        rotationY: 0,
    };
}

export function dedupeParts(parts: BuildingVoxelPart[]): BuildingVoxelPart[] {
    const byId = new Map<string, BuildingVoxelPart>();
    for (const part of parts) {
        const normalized = normalizeVoxelPart(part);
        byId.set(normalized.id, normalized);
    }
    return Array.from(byId.values()).sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x || String(a.shape).localeCompare(String(b.shape)));
}

export function normalizeSourceMeshOverrides(overrides: BuildingSourceMeshOverride[]): BuildingSourceMeshOverride[] {
    const byId = new Map<string, BuildingSourceMeshOverride>();
    for (const override of overrides) {
        const normalized = normalizeSourceMeshOverride(override);
        if (normalized.hidden || normalized.color || normalized.metalness !== undefined || normalized.roughness !== undefined) {
            byId.set(normalized.id, normalized);
        }
    }
    return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
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
    const shape = normalizeVoxelShape(part.shape);
    return {
        ...createPart(x, y, z, part.role, shape),
        scaleX: clampTransform(part.scaleX ?? (shape === 'beam' ? 2 : 1), 0.25, 6),
        scaleY: clampTransform(part.scaleY ?? (shape === 'beam' ? 0.5 : 1), 0.25, 6),
        scaleZ: clampTransform(part.scaleZ ?? 1, 0.25, 6),
        rotationY: clampRotation(part.rotationY ?? 0),
    };
}

function isValidSourceMeshOverride(value: unknown): value is BuildingSourceMeshOverride {
    const override = value as BuildingSourceMeshOverride;
    return !!override && typeof override.id === 'string' && override.id.length > 0;
}

function normalizeSourceMeshOverride(override: BuildingSourceMeshOverride): BuildingSourceMeshOverride {
    const normalized: BuildingSourceMeshOverride = { id: override.id.slice(0, 64) };
    if (override.hidden) normalized.hidden = true;
    if (typeof override.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(override.color)) normalized.color = override.color;
    if (override.metalness !== undefined) normalized.metalness = clampTransform(override.metalness, 0, 1);
    if (override.roughness !== undefined) normalized.roughness = clampTransform(override.roughness, 0, 1);
    return normalized;
}

function normalizeVoxelShape(shape?: BuildingVoxelShape): BuildingVoxelShape {
    return shape && BUILDING_VOXEL_SHAPES.includes(shape) ? shape : 'block';
}

function clampTransform(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Number(Math.max(min, Math.min(max, value)).toFixed(2));
}

function clampRotation(value: number): number {
    if (!Number.isFinite(value)) return 0;
    const snapped = Math.round(value / 15) * 15;
    return ((snapped % 360) + 360) % 360;
}

function formatPartId(x: number, y: number, z: number, shape: BuildingVoxelShape): string {
    return `${shape}:${x.toFixed(2)}:${y.toFixed(2)}:${z.toFixed(2)}`;
}
