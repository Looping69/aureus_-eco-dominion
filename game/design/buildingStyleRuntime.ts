import * as THREE from 'three';
import {
    BUILDING_STYLE_STORAGE_KEY,
    BuildingStyleSettings,
    DEFAULT_BUILDING_STYLE,
    normalizeBuildingStyleSettings,
} from './buildingStyle';

const INFRASTRUCTURE_STYLE_EXCLUSIONS = new Set([
    'ROAD',
    'PIPE',
    'POWER_LINE',
    'FENCE',
    'RAIL_LINE',
]);

// Global settlement style should never wash out authored building palettes.
// Custom colors belong to explicit per-building edits, not a broad live overlay.
const LIVE_COLOR_BLEND = 0;

type StyleRole = 'wall' | 'roof' | 'accent';

type ColorableMaterial = THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
    map?: THREE.Texture | null;
    vertexColors?: boolean;
};

export function readSavedBuildingStyle(): BuildingStyleSettings {
    if (typeof window === 'undefined' || !window.localStorage) {
        return normalizeBuildingStyleSettings(DEFAULT_BUILDING_STYLE);
    }

    try {
        const raw = window.localStorage.getItem(BUILDING_STYLE_STORAGE_KEY);
        return normalizeBuildingStyleSettings(raw ? JSON.parse(raw) : DEFAULT_BUILDING_STYLE);
    } catch {
        return normalizeBuildingStyleSettings(DEFAULT_BUILDING_STYLE);
    }
}

export function getBuildingStyleSignature(settings = readSavedBuildingStyle()): string {
    return [
        settings.presetId,
        settings.primaryMaterial,
        settings.roofProfile,
        settings.windowProfile,
        settings.wallColor,
        settings.roofColor,
        settings.accentColor,
        settings.nightGlow.toFixed(2),
        settings.weathering.toFixed(2),
        settings.greenery.toFixed(2),
    ].join('|');
}

export function applyBuildingStyleToGroup(
    type: string,
    group: THREE.Group,
    settings = readSavedBuildingStyle(),
): THREE.Group {
    if (INFRASTRUCTURE_STYLE_EXCLUSIONS.has(type)) {
        return group;
    }

    group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;

        mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map((material, index) => styleMaterial(material, mesh, settings, index))
            : styleMaterial(mesh.material, mesh, settings, 0);
    });

    group.userData.buildingStyleSignature = getBuildingStyleSignature(settings);
    group.userData.buildingStylePreset = settings.presetId;
    return group;
}

function styleMaterial(
    material: THREE.Material,
    mesh: THREE.Mesh,
    settings: BuildingStyleSettings,
    materialIndex: number,
): THREE.Material {
    const next = material.clone() as ColorableMaterial;
    const role = inferStyleRole(mesh, next, materialIndex);
    const blend = getStyleBlend(next, role);

    if (next.color && blend > 0) {
        const baseColor = next.color.clone();
        const targetColor = new THREE.Color(role === 'roof'
            ? settings.roofColor
            : role === 'accent'
                ? settings.accentColor
                : settings.wallColor);
        next.color.copy(baseColor.lerp(targetColor, blend));
    }

    if (next.emissive && role === 'accent') {
        next.emissiveIntensity = Math.max(next.emissiveIntensity || 0, settings.nightGlow * 0.08);
    }

    if (typeof next.roughness === 'number') {
        const targetRoughness = clamp01(0.62 + settings.weathering * 0.18 - settings.greenery * 0.05);
        next.roughness = THREE.MathUtils.lerp(next.roughness, targetRoughness, 0.12);
    }

    if (typeof next.metalness === 'number') {
        const materialBoost = settings.primaryMaterial === 'metal' ? 0.08 : settings.primaryMaterial === 'glass' ? 0.04 : 0;
        next.metalness = clamp01(THREE.MathUtils.lerp(next.metalness, materialBoost, 0.1));
    }

    next.needsUpdate = true;
    return next;
}

function getStyleBlend(material: ColorableMaterial, role: StyleRole): number {
    void material;
    void role;
    return LIVE_COLOR_BLEND;
}

function inferStyleRole(mesh: THREE.Mesh, material: ColorableMaterial, materialIndex: number): StyleRole {
    if (mesh.userData.isSolarPanel || mesh.userData.isRotor || mesh.userData.isConveyorPulse) {
        return 'accent';
    }

    if ((material.emissiveIntensity || 0) > 0.1) {
        return 'accent';
    }

    if (mesh.position.y > 0.55 || Math.abs(mesh.rotation.x) > 0.01 || Math.abs(mesh.rotation.z) > 0.01) {
        return 'roof';
    }

    if (materialIndex > 0 && mesh.position.y > 0.32) {
        return 'roof';
    }

    return 'wall';
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}
