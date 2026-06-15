import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Palette, RotateCcw, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BuildingVoxelStudio } from './BuildingVoxelStudio';
import {
    BUILDING_STYLE_PRESETS,
    BUILDING_STYLE_STORAGE_KEY,
    BuildingStyleSettings,
    DEFAULT_BUILDING_STYLE,
    normalizeBuildingStyleSettings,
    styleSettingsFromPreset,
} from '../game/design/buildingStyle';

const MATERIAL_LABELS: Record<BuildingStyleSettings['primaryMaterial'], string> = {
    earth: 'Earth',
    stone: 'Stone',
    timber: 'Timber',
    metal: 'Metal',
    glass: 'Glass',
    green: 'Green',
};

const ROOF_LABELS: Record<BuildingStyleSettings['roofProfile'], string> = {
    flat: 'Flat',
    pitched: 'Pitched',
    solar: 'Solar',
    green: 'Green',
    industrial: 'Industrial',
};

const WINDOW_LABELS: Record<BuildingStyleSettings['windowProfile'], string> = {
    small: 'Small',
    wide: 'Wide',
    vertical: 'Vertical',
    lit: 'Lit',
};

function loadSavedStyle(): BuildingStyleSettings {
    if (typeof window === 'undefined') return normalizeBuildingStyleSettings(DEFAULT_BUILDING_STYLE);
    try {
        const raw = window.localStorage.getItem(BUILDING_STYLE_STORAGE_KEY);
        return normalizeBuildingStyleSettings(raw ? JSON.parse(raw) : DEFAULT_BUILDING_STYLE);
    } catch {
        return normalizeBuildingStyleSettings(DEFAULT_BUILDING_STYLE);
    }
}

function saveStyle(settings: BuildingStyleSettings): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BUILDING_STYLE_STORAGE_KEY, JSON.stringify(normalizeBuildingStyleSettings(settings)));
}

export const DesignStudio: React.FC = () => {
    const [settings, setSettings] = useState<BuildingStyleSettings>(() => loadSavedStyle());
    const [saved, setSaved] = useState(false);

    const activePreset = useMemo(
        () => BUILDING_STYLE_PRESETS.find((preset) => preset.presetId === settings.presetId) || DEFAULT_BUILDING_STYLE,
        [settings.presetId],
    );

    useEffect(() => {
        setSaved(false);
    }, [settings]);

    const update = <K extends keyof BuildingStyleSettings>(key: K, value: BuildingStyleSettings[K]) => {
        setSettings((current) => normalizeBuildingStyleSettings({ ...current, [key]: value }));
    };

    const applyPreset = (presetId: string) => {
        setSettings(styleSettingsFromPreset(presetId));
    };

    const handleSave = () => {
        saveStyle(settings);
        setSaved(true);
    };

    const handleReset = () => {
        setSettings(styleSettingsFromPreset(DEFAULT_BUILDING_STYLE.presetId));
    };

    return (
        <main className="min-h-full w-full bg-slate-950 text-slate-100 overflow-auto pointer-events-auto">
            <div className="mx-auto max-w-7xl px-5 py-5 lg:py-7">
                <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-cyan-300 text-[10px] font-black uppercase tracking-[0.22em]">
                            <Palette size={15} /> Aureus Design Studio
                        </div>
                        <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight font-['Rajdhani']">Settlement Identity</h1>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            to="/"
                            className="h-11 px-4 rounded-[4px] border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 font-black uppercase tracking-wider text-xs flex items-center gap-2"
                        >
                            <ArrowLeft size={16} /> Game
                        </Link>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="h-11 px-4 rounded-[4px] border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 font-black uppercase tracking-wider text-xs flex items-center gap-2"
                        >
                            <RotateCcw size={16} /> Reset Theme
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="h-11 px-4 rounded-[4px] border-2 border-emerald-900 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider text-xs flex items-center gap-2"
                        >
                            {saved ? <Check size={16} /> : <Save size={16} />} {saved ? 'Saved' : 'Save Theme'}
                        </button>
                    </div>
                </header>

                <div className="mt-5">
                    <BuildingVoxelStudio settings={settings} />
                </div>

                <section className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-5 mt-5">
                    <div className="space-y-5">
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">Theme Presets</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {BUILDING_STYLE_PRESETS.map((preset) => (
                                    <button
                                        key={preset.presetId}
                                        type="button"
                                        onClick={() => applyPreset(preset.presetId)}
                                        className={`text-left rounded-[6px] border-2 p-4 transition-colors ${settings.presetId === preset.presetId ? 'border-cyan-400 bg-cyan-950/35' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-black text-white font-['Rajdhani'] text-xl">{preset.name}</div>
                                            <div className="flex gap-1.5">
                                                {[preset.wallColor, preset.roofColor, preset.accentColor].map((color) => (
                                                    <span key={color} className="w-5 h-5 rounded-[3px] border border-white/20" style={{ backgroundColor: color }} />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="mt-2 text-xs leading-relaxed text-slate-400">{preset.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <label className="block rounded-[6px] border border-slate-800 bg-slate-900 p-4">
                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">District Name</span>
                                <input
                                    value={settings.districtName}
                                    onChange={(event) => update('districtName', event.target.value)}
                                    className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-[4px] px-3 py-2 text-sm font-bold outline-none focus:border-cyan-400"
                                    maxLength={32}
                                />
                            </label>
                            <SelectControl
                                label="Material"
                                value={settings.primaryMaterial}
                                options={MATERIAL_LABELS}
                                onChange={(value) => update('primaryMaterial', value as BuildingStyleSettings['primaryMaterial'])}
                            />
                            <SelectControl
                                label="Roof"
                                value={settings.roofProfile}
                                options={ROOF_LABELS}
                                onChange={(value) => update('roofProfile', value as BuildingStyleSettings['roofProfile'])}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <SelectControl
                                label="Windows"
                                value={settings.windowProfile}
                                options={WINDOW_LABELS}
                                onChange={(value) => update('windowProfile', value as BuildingStyleSettings['windowProfile'])}
                            />
                            <ColorControl label="Walls" value={settings.wallColor} onChange={(value) => update('wallColor', value)} />
                            <ColorControl label="Roof" value={settings.roofColor} onChange={(value) => update('roofColor', value)} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <ColorControl label="Accent" value={settings.accentColor} onChange={(value) => update('accentColor', value)} />
                            <RangeControl label="Night Glow" value={settings.nightGlow} onChange={(value) => update('nightGlow', value)} />
                            <RangeControl label="Weathering" value={settings.weathering} onChange={(value) => update('weathering', value)} />
                            <RangeControl label="Greenery" value={settings.greenery} onChange={(value) => update('greenery', value)} />
                        </div>
                    </div>

                    <aside className="space-y-5">
                        <div className="rounded-[6px] border border-slate-800 bg-slate-900 p-5">
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Overseer Doctrine</h2>
                            <p className="mt-3 text-sm leading-relaxed text-slate-300">{activePreset.doctrine}</p>
                            <p className="mt-4 text-xs leading-relaxed text-slate-500">
                                Shape edits are saved per building. Theme edits drive color, material feel, and the settlement doctrine the Overseer can consume next.
                            </p>
                        </div>
                        <div className="rounded-[6px] border border-slate-800 bg-slate-900 p-5">
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Saved Theme Payload</h2>
                            <div className="mt-4 rounded-[4px] bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-slate-400 overflow-x-auto">
                                <pre>{JSON.stringify(settings, null, 2)}</pre>
                            </div>
                        </div>
                    </aside>
                </section>
            </div>
        </main>
    );
};

interface SelectControlProps {
    label: string;
    value: string;
    options: Record<string, string>;
    onChange: (value: string) => void;
}

const SelectControl: React.FC<SelectControlProps> = ({ label, value, options, onChange }) => (
    <label className="block rounded-[6px] border border-slate-800 bg-slate-900 p-4">
        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">{label}</span>
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-[4px] px-3 py-2 text-sm font-bold outline-none focus:border-cyan-400"
        >
            {Object.entries(options).map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
        </select>
    </label>
);

interface ColorControlProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
}

const ColorControl: React.FC<ColorControlProps> = ({ label, value, onChange }) => (
    <label className="block rounded-[6px] border border-slate-800 bg-slate-900 p-4">
        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">{label}</span>
        <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="mt-2 w-full h-10 bg-slate-950 border border-slate-700 rounded-[4px] p-1"
        />
    </label>
);

interface RangeControlProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
}

const RangeControl: React.FC<RangeControlProps> = ({ label, value, onChange }) => (
    <label className="block rounded-[6px] border border-slate-800 bg-slate-900 p-4">
        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">{label}</span>
        <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="mt-4 w-full accent-cyan-400"
        />
    </label>
);
