import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Palette, RotateCcw, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
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

const BuildingPreview: React.FC<{ settings: BuildingStyleSettings }> = ({ settings }) => {
    const roofRadius = settings.roofProfile === 'industrial' ? '2px' : settings.roofProfile === 'green' ? '7px' : '4px';
    const roofHeight = settings.roofProfile === 'flat' ? 18 : settings.roofProfile === 'industrial' ? 26 : 34;
    const windowCount = settings.windowProfile === 'small' ? 6 : settings.windowProfile === 'wide' ? 4 : 5;
    const glow = settings.nightGlow;

    return (
        <div className="relative min-h-[21rem] bg-slate-950 border border-slate-800 rounded-[6px] overflow-hidden">
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900 to-transparent" />
            <div className="absolute inset-x-8 bottom-11 h-5 rounded-full bg-black/35 blur-md" />
            <div className="absolute left-1/2 bottom-16 -translate-x-1/2 w-56 h-40">
                <div
                    className="absolute left-4 right-4 top-0 border border-black/30 shadow-[0_10px_0_rgba(0,0,0,0.18)]"
                    style={{
                        height: roofHeight,
                        background: settings.roofProfile === 'green'
                            ? `linear-gradient(135deg, ${settings.roofColor}, #6f9c55)`
                            : settings.roofProfile === 'solar'
                                ? `linear-gradient(135deg, ${settings.roofColor}, #0e1729 56%, ${settings.accentColor})`
                                : settings.roofColor,
                        borderRadius: roofRadius,
                        transform: settings.roofProfile === 'pitched' ? 'skewX(-8deg)' : undefined,
                    }}
                />
                <div
                    className="absolute left-0 right-0 bottom-0 h-32 border border-black/35 shadow-[10px_10px_0_rgba(0,0,0,0.2)]"
                    style={{
                        background: `linear-gradient(135deg, ${settings.wallColor}, color-mix(in srgb, ${settings.wallColor} 72%, #0f172a))`,
                        filter: `saturate(${1 - settings.weathering * 0.18})`,
                    }}
                >
                    <div className="grid grid-cols-3 gap-3 p-5 pt-8">
                        {Array.from({ length: windowCount }).map((_, index) => (
                            <div
                                key={index}
                                className="h-8 border border-black/25"
                                style={{
                                    background: `color-mix(in srgb, ${settings.accentColor} ${Math.round(28 + glow * 58)}%, #0f172a)`,
                                    boxShadow: glow > 0.5 ? `0 0 ${Math.round(glow * 18)}px ${settings.accentColor}` : undefined,
                                    borderRadius: settings.windowProfile === 'vertical' ? 2 : 4,
                                    gridColumn: settings.windowProfile === 'wide' ? 'span 1' : undefined,
                                }}
                            />
                        ))}
                    </div>
                    <div
                        className="absolute left-5 bottom-0 w-10 h-16 border border-black/35"
                        style={{ background: `color-mix(in srgb, ${settings.roofColor} 70%, #111827)` }}
                    />
                    <div
                        className="absolute right-5 bottom-4 w-16 h-3 rounded-full"
                        style={{ background: settings.accentColor, opacity: 0.4 + settings.greenery * 0.4 }}
                    />
                </div>
            </div>
            <div className="absolute left-5 top-5">
                <div className="text-[10px] uppercase font-black tracking-widest text-slate-500">Preview</div>
                <div className="text-xl font-black text-white font-['Rajdhani']">{settings.districtName}</div>
            </div>
        </div>
    );
};

export const DesignStudio: React.FC = () => {
    const [settings, setSettings] = useState<BuildingStyleSettings>(() => loadSavedStyle());
    const [saved, setSaved] = useState(false);

    const activePreset = useMemo(
        () => BUILDING_STYLE_PRESETS.find((preset) => preset.presetId === settings.presetId) || DEFAULT_BUILDING_STYLE,
        [settings.presetId]
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
                            <RotateCcw size={16} /> Reset
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="h-11 px-4 rounded-[4px] border-2 border-emerald-900 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider text-xs flex items-center gap-2"
                        >
                            {saved ? <Check size={16} /> : <Save size={16} />} {saved ? 'Saved' : 'Save'}
                        </button>
                    </div>
                </header>

                <section className="grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr] gap-5 mt-5">
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
                            <label className="block rounded-[6px] border border-slate-800 bg-slate-900 p-4">
                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Material</span>
                                <select
                                    value={settings.primaryMaterial}
                                    onChange={(event) => update('primaryMaterial', event.target.value as BuildingStyleSettings['primaryMaterial'])}
                                    className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-[4px] px-3 py-2 text-sm font-bold outline-none focus:border-cyan-400"
                                >
                                    {Object.entries(MATERIAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </label>
                            <label className="block rounded-[6px] border border-slate-800 bg-slate-900 p-4">
                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Roof</span>
                                <select
                                    value={settings.roofProfile}
                                    onChange={(event) => update('roofProfile', event.target.value as BuildingStyleSettings['roofProfile'])}
                                    className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-[4px] px-3 py-2 text-sm font-bold outline-none focus:border-cyan-400"
                                >
                                    {Object.entries(ROOF_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <label className="block rounded-[6px] border border-slate-800 bg-slate-900 p-4">
                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Windows</span>
                                <select
                                    value={settings.windowProfile}
                                    onChange={(event) => update('windowProfile', event.target.value as BuildingStyleSettings['windowProfile'])}
                                    className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-[4px] px-3 py-2 text-sm font-bold outline-none focus:border-cyan-400"
                                >
                                    {Object.entries(WINDOW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </label>
                            {([
                                ['wallColor', 'Walls'],
                                ['roofColor', 'Roof'],
                            ] as const).map(([key, label]) => (
                                <label key={key} className="block rounded-[6px] border border-slate-800 bg-slate-900 p-4">
                                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">{label}</span>
                                    <input
                                        type="color"
                                        value={settings[key]}
                                        onChange={(event) => update(key, event.target.value)}
                                        className="mt-2 w-full h-10 bg-slate-950 border border-slate-700 rounded-[4px] p-1"
                                    />
                                </label>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <label className="block rounded-[6px] border border-slate-800 bg-slate-900 p-4">
                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Accent</span>
                                <input
                                    type="color"
                                    value={settings.accentColor}
                                    onChange={(event) => update('accentColor', event.target.value)}
                                    className="mt-2 w-full h-10 bg-slate-950 border border-slate-700 rounded-[4px] p-1"
                                />
                            </label>
                            {([
                                ['nightGlow', 'Night Glow'],
                                ['weathering', 'Weathering'],
                                ['greenery', 'Greenery'],
                            ] as const).map(([key, label]) => (
                                <label key={key} className="block rounded-[6px] border border-slate-800 bg-slate-900 p-4">
                                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">{label}</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={settings[key]}
                                        onChange={(event) => update(key, Number(event.target.value))}
                                        className="mt-4 w-full accent-cyan-400"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>

                    <aside className="space-y-5">
                        <BuildingPreview settings={settings} />
                        <div className="rounded-[6px] border border-slate-800 bg-slate-900 p-5">
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Overseer Doctrine</h2>
                            <p className="mt-3 text-sm leading-relaxed text-slate-300">{activePreset.doctrine}</p>
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
