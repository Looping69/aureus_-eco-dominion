export type BuildingMaterialKey = 'earth' | 'stone' | 'timber' | 'metal' | 'glass' | 'green';
export type RoofProfileKey = 'flat' | 'pitched' | 'solar' | 'green' | 'industrial';
export type WindowProfileKey = 'small' | 'wide' | 'vertical' | 'lit';

export interface BuildingStyleSettings {
    presetId: string;
    districtName: string;
    primaryMaterial: BuildingMaterialKey;
    roofProfile: RoofProfileKey;
    windowProfile: WindowProfileKey;
    wallColor: string;
    roofColor: string;
    accentColor: string;
    nightGlow: number;
    weathering: number;
    greenery: number;
}

export interface BuildingStylePreset extends BuildingStyleSettings {
    name: string;
    description: string;
    doctrine: string;
}

export const BUILDING_STYLE_STORAGE_KEY = 'aureus.buildingStyle.v1';

export const BUILDING_STYLE_PRESETS: BuildingStylePreset[] = [
    {
        presetId: 'frontier-oxide',
        name: 'Frontier Oxide',
        districtName: 'First Camp',
        description: 'Warm mineral roofs, patched metal, and practical stone bases for a young mining settlement.',
        doctrine: 'Build tight, cheap, and close to the first pit. Prioritize storage, shelter, and production before civic beauty.',
        primaryMaterial: 'stone',
        roofProfile: 'pitched',
        windowProfile: 'small',
        wallColor: '#b68b5f',
        roofColor: '#9a4f2f',
        accentColor: '#f0c36a',
        nightGlow: 0.45,
        weathering: 0.72,
        greenery: 0.18,
    },
    {
        presetId: 'solar-cooperative',
        name: 'Solar Cooperative',
        districtName: 'Sunworks',
        description: 'Pale walls, blue-black solar roofs, and clean accent lights for a power-positive colony.',
        doctrine: 'Cluster utilities on sunlit edges, keep worker housing shaded, and expand with clean energy before heavy industry.',
        primaryMaterial: 'glass',
        roofProfile: 'solar',
        windowProfile: 'wide',
        wallColor: '#d8e3dc',
        roofColor: '#18263f',
        accentColor: '#39c5bb',
        nightGlow: 0.68,
        weathering: 0.22,
        greenery: 0.42,
    },
    {
        presetId: 'stone-garden',
        name: 'Stone Garden',
        districtName: 'Restoration Ward',
        description: 'Low stone buildings, planted roofs, and restrained lighting for an ecology-first town.',
        doctrine: 'Leave breathing room between structures, protect restored land, and use gardens as district anchors.',
        primaryMaterial: 'green',
        roofProfile: 'green',
        windowProfile: 'vertical',
        wallColor: '#9ba88d',
        roofColor: '#486b42',
        accentColor: '#d7e897',
        nightGlow: 0.36,
        weathering: 0.38,
        greenery: 0.82,
    },
    {
        presetId: 'industrial-charter',
        name: 'Industrial Charter',
        districtName: 'Foundry Line',
        description: 'Darker walls, metal roofs, and amber work lights for production-heavy towns.',
        doctrine: 'Separate industry from housing, line production up near logistics, and make utility failures visible.',
        primaryMaterial: 'metal',
        roofProfile: 'industrial',
        windowProfile: 'lit',
        wallColor: '#6f7478',
        roofColor: '#2f3437',
        accentColor: '#ffb14a',
        nightGlow: 0.74,
        weathering: 0.64,
        greenery: 0.1,
    },
];

export const DEFAULT_BUILDING_STYLE = BUILDING_STYLE_PRESETS[0];

export function getBuildingStylePreset(presetId: string): BuildingStylePreset {
    return BUILDING_STYLE_PRESETS.find((preset) => preset.presetId === presetId) || DEFAULT_BUILDING_STYLE;
}

export function normalizeBuildingStyleSettings(value: Partial<BuildingStyleSettings> | null | undefined): BuildingStyleSettings {
    const preset = getBuildingStylePreset(value?.presetId || DEFAULT_BUILDING_STYLE.presetId);
    return {
        presetId: preset.presetId,
        districtName: typeof value?.districtName === 'string' && value.districtName.trim().length > 0
            ? value.districtName.trim().slice(0, 32)
            : preset.districtName,
        primaryMaterial: value?.primaryMaterial || preset.primaryMaterial,
        roofProfile: value?.roofProfile || preset.roofProfile,
        windowProfile: value?.windowProfile || preset.windowProfile,
        wallColor: value?.wallColor || preset.wallColor,
        roofColor: value?.roofColor || preset.roofColor,
        accentColor: value?.accentColor || preset.accentColor,
        nightGlow: clamp01(value?.nightGlow ?? preset.nightGlow),
        weathering: clamp01(value?.weathering ?? preset.weathering),
        greenery: clamp01(value?.greenery ?? preset.greenery),
    };
}

export function styleSettingsFromPreset(presetId: string): BuildingStyleSettings {
    const preset = getBuildingStylePreset(presetId);
    return normalizeBuildingStyleSettings(preset);
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}
