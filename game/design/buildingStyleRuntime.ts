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

type StyleRole = 'wall' | 'roof' | 'accent';

type ColorableMaterial = THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
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
    const target = role === 'roof'
        ? settings.roofColor
        : role === 'accent'
            ? settings.accentColor
            : settings.wallColor;

    if (next.color) {
        const baseColor = next.color.clone();
        const targetColor = new THREE.Color(target);
        const blend = role === 'accent' ? 0.68 : role === 'roof' ? 0.58 : 0.52;
        next.color.copy(baseColor.lerp(targetColor, blend));
    }

    if (next.emissive && role === 'accent') {
        next.emissive.copy(new THREE.Color(settings.accentColor));
        next.emissiveIntensity = Math.max(next.emissiveIntensity || 0, settings.nightGlow * 0.45);
    }

    if (typeof next.roughness === 'number') {
        next.roughness = clamp01(0.62 + settings.weathering * 0.24 - settings.greenery * 0.08);
    }

    if (typeof next.metalness === 'number') {
        const materialBoost = settings.primaryMaterial === 'metal' ? 0.22 : settings.primaryMaterial === 'glass' ? 0.12 : 0;
        next.metalness = clamp01(next.metalness * 0.55 + materialBoost);
    }

    next.needsUpdate = true;
    return next;
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
