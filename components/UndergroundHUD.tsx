import React, { useState } from 'react';
import { Pickaxe, Shield, Zap, UserPlus, Upload } from 'lucide-react';
import { UndergroundState, UndergroundTile } from '../types';

type DungeonMode = 'mine' | 'build_support' | 'build_recharger';
type MinerType = 'driller' | 'excavator' | 'foreman';

interface UndergroundHUDProps {
    underground?: UndergroundState;
}

const modeOptions: Array<{ mode: DungeonMode; label: string; icon: React.ReactNode }> = [
    { mode: 'mine', label: 'Mine', icon: <Pickaxe size={14} /> },
    { mode: 'build_support', label: 'Support', icon: <Shield size={14} /> },
    { mode: 'build_recharger', label: 'Recharge', icon: <Zap size={14} /> },
];

const emitDungeonAction = (type: string, payload?: Record<string, any>) => {
    window.dispatchEvent(new CustomEvent('aureus:dungeon-action', {
        detail: { type, payload },
    }));
};

export const UndergroundHUD: React.FC<UndergroundHUDProps> = ({ underground }) => {
    const [activeMode, setActiveMode] = useState<DungeonMode>('mine');
    if (!underground) return null;

    const visibleTiles = (Object.values(underground.tiles) as UndergroundTile[]).filter(tile => tile.status !== 'HIDDEN');
    const hazardCount = visibleTiles.filter(tile => tile.hazard !== 'NONE').length;
    const resourceCount = visibleTiles.filter(tile => tile.resourceType !== 'NONE').length;
    const sectorLabel = `Sector B${underground.depthLevel}`;

    const setMode = (mode: DungeonMode) => {
        setActiveMode(mode);
        emitDungeonAction('SET_MODE', { mode });
    };

    const hireMiner = (minerType: MinerType) => {
        emitDungeonAction('HIRE_MINER', { minerType });
    };

    return (
        <div className="absolute top-24 right-4 z-50 pointer-events-none flex flex-col gap-3 items-end max-w-[calc(100vw-1rem)]">
            <div className="bg-slate-950/90 border border-amber-500/40 rounded-lg p-4 shadow-xl min-w-[250px] backdrop-blur-md">
                <div className="text-amber-400 text-xs font-black tracking-widest uppercase mb-3 font-['Rajdhani']">
                    Deep Ledger // {sectorLabel}
                </div>

                <div className="space-y-2 text-xs text-slate-200 font-mono">
                    <div className="flex justify-between gap-6">
                        <span className="text-slate-500 uppercase">Depth</span>
                        <span>{sectorLabel}</span>
                    </div>
                    <div className="flex justify-between gap-6">
                        <span className="text-slate-500 uppercase">Stability</span>
                        <span>{underground.globalStability}%</span>
                    </div>
                    <div className="flex justify-between gap-6">
                        <span className="text-slate-500 uppercase">Oxygen</span>
                        <span>{underground.oxygen}%</span>
                    </div>
                    <div className="flex justify-between gap-6">
                        <span className="text-slate-500 uppercase">Exposure</span>
                        <span>{underground.exposureRisk}%</span>
                    </div>
                    <div className="h-px bg-slate-800 my-2" />
                    <div className="flex justify-between gap-6">
                        <span className="text-slate-500 uppercase">Surveyed Tiles</span>
                        <span>{visibleTiles.length}</span>
                    </div>
                    <div className="flex justify-between gap-6">
                        <span className="text-slate-500 uppercase">Deposits</span>
                        <span>{resourceCount}</span>
                    </div>
                    <div className="flex justify-between gap-6">
                        <span className="text-slate-500 uppercase">Hazards</span>
                        <span className={hazardCount > 0 ? 'text-amber-400' : ''}>{hazardCount}</span>
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] leading-snug text-slate-500">
                    The surface tells the public story. The Deep Ledger records what happens beneath it.
                </div>
            </div>

            <div className="pointer-events-auto bg-slate-950/92 border border-cyan-500/35 rounded-lg p-3 shadow-xl w-[min(26rem,calc(100vw-2rem))] backdrop-blur-md">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                        <div className="text-cyan-300 text-xs font-black tracking-widest uppercase font-['Rajdhani']">Mine Console</div>
                        <div className="text-[10px] text-slate-500 font-mono">Click blocks after choosing a mode</div>
                    </div>
                    <button
                        onClick={() => emitDungeonAction('SURFACE_RESOURCES')}
                        className="h-8 px-2.5 rounded-[4px] bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/60 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                        title="Move mined valuables to surface stock"
                    >
                        <Upload size={13} /> Surface
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {modeOptions.map(option => (
                        <button
                            key={option.mode}
                            onClick={() => setMode(option.mode)}
                            className={`h-9 rounded-[4px] border text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${activeMode === option.mode
                                ? 'bg-amber-500 border-amber-300 text-amber-950'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                            {option.icon}
                            {option.label}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                    {([
                        ['driller', 'Driller', '250 AGT'],
                        ['excavator', 'Excavator', '600 AGT'],
                        ['foreman', 'Foreman', '900 AGT + 5 Gems'],
                    ] as Array<[MinerType, string, string]>).map(([minerType, label, cost]) => (
                        <button
                            key={minerType}
                            onClick={() => hireMiner(minerType)}
                            className="min-h-11 rounded-[4px] bg-slate-800 hover:bg-cyan-800 border border-slate-700 hover:border-cyan-400 text-slate-200 px-2 py-1.5 text-left transition-colors"
                        >
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                                <UserPlus size={12} /> {label}
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">{cost}</div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
