import React, { useState } from 'react';
import { AlertTriangle, Boxes, ChevronDown, ChevronUp, Pickaxe, Shield, Upload, UserPlus, Zap } from 'lucide-react';
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

const percent = (value: number, max: number) => {
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
};

export const UndergroundHUD: React.FC<UndergroundHUDProps> = ({ underground }) => {
    const [activeMode, setActiveMode] = useState<DungeonMode>('mine');
    const [ledgerCollapsed, setLedgerCollapsed] = useState(true);
    const [consoleCollapsed, setConsoleCollapsed] = useState(false);
    if (!underground) return null;

    const visibleTiles = (Object.values(underground.tiles) as UndergroundTile[]).filter(tile => tile.status !== 'HIDDEN');
    const hazardCount = visibleTiles.filter(tile => tile.hazard !== 'NONE').length;
    const resourceCount = visibleTiles.filter(tile => tile.resourceType !== 'NONE').length;
    const sectorLabel = `Sector B${underground.depthLevel}`;
    const openPit = underground.openPit;
    const rubblePercent = openPit ? percent(openPit.rubbleStored, openPit.rubbleCapacity) : 0;

    const setMode = (mode: DungeonMode) => {
        setActiveMode(mode);
        emitDungeonAction('SET_MODE', { mode });
    };

    const hireMiner = (minerType: MinerType) => {
        emitDungeonAction('HIRE_MINER', { minerType });
    };

    return (
        <div className="absolute top-24 right-4 z-50 pointer-events-none flex flex-col gap-2 items-end max-w-[calc(100vw-1rem)]">
            <div className="pointer-events-auto bg-slate-950/90 border border-amber-500/40 rounded-lg shadow-xl min-w-[210px] max-w-[min(22rem,calc(100vw-2rem))] backdrop-blur-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => setLedgerCollapsed(value => !value)}
                    className="w-full h-10 px-3 flex items-center justify-between gap-3 text-left hover:bg-amber-500/10 transition-colors"
                    title={ledgerCollapsed ? 'Expand Deep Ledger' : 'Collapse Deep Ledger'}
                >
                    <span className="text-amber-400 text-xs font-black tracking-widest uppercase font-['Rajdhani']">
                        Deep Ledger // {sectorLabel}
                    </span>
                    {ledgerCollapsed ? <ChevronDown size={15} className="text-amber-300" /> : <ChevronUp size={15} className="text-amber-300" />}
                </button>

                {!ledgerCollapsed && (
                    <div className="px-4 pb-4">
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
                )}
            </div>

            <div className="pointer-events-auto bg-slate-950/92 border border-cyan-500/35 rounded-lg shadow-xl w-[min(26rem,calc(100vw-2rem))] backdrop-blur-md overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <button
                        type="button"
                        onClick={() => setConsoleCollapsed(value => !value)}
                        className="min-w-0 flex-1 text-left flex items-center gap-2 hover:text-cyan-200 transition-colors"
                        title={consoleCollapsed ? 'Expand Mine Console' : 'Collapse Mine Console'}
                    >
                        <span className="text-cyan-300 text-xs font-black tracking-widest uppercase font-['Rajdhani']">Mine Console</span>
                        <span className="text-[10px] text-slate-500 font-mono truncate">Click blocks after choosing a mode</span>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            onClick={() => emitDungeonAction('SURFACE_RESOURCES')}
                            className="h-8 px-2.5 rounded-[4px] bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/60 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                            title="Move mined valuables to surface stock"
                        >
                            <Upload size={13} /> Surface
                        </button>
                        <button
                            type="button"
                            onClick={() => setConsoleCollapsed(value => !value)}
                            className="h-8 w-8 rounded-[4px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-200 flex items-center justify-center transition-colors"
                            title={consoleCollapsed ? 'Expand Mine Console' : 'Collapse Mine Console'}
                        >
                            {consoleCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                        </button>
                    </div>
                </div>

                {!consoleCollapsed && (
                    <div className="px-3 pb-3">
                        {openPit && (
                            <div className={`mb-3 rounded-[6px] border p-3 ${openPit.capacityBlocked ? 'border-amber-500/60 bg-amber-950/25' : 'border-slate-700 bg-slate-900/75'}`}>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-cyan-200 font-['Rajdhani']">
                                        {openPit.capacityBlocked ? <AlertTriangle size={14} className="text-amber-300" /> : <Boxes size={14} className="text-cyan-300" />}
                                        Open Pit
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-400">Layer {openPit.activeLayer} / Surface {openPit.surfaceLayer}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-mono text-slate-300">
                                    <div className="flex justify-between gap-3"><span className="text-slate-500 uppercase">Pit Tiles</span><span>{openPit.openPitTiles}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-slate-500 uppercase">Depth</span><span>{openPit.deepestOpenPitDepth}/{openPit.maxOpenPitDepth}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-slate-500 uppercase">Dig Jobs</span><span>{openPit.queuedDigJobs}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-slate-500 uppercase">Clear Jobs</span><span>{openPit.queuedClearJobs}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-slate-500 uppercase">Assigned</span><span>{openPit.assignedExcavationJobs}</span></div>
                                    <div className="flex justify-between gap-3"><span className="text-slate-500 uppercase">Workers</span><span>{openPit.activeWorkers}</span></div>
                                </div>
                                <div className="mt-2">
                                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                        <span className="text-slate-500 uppercase">Rubble</span>
                                        <span className={openPit.capacityBlocked ? 'text-amber-300' : 'text-slate-300'}>{openPit.rubbleStored}/{openPit.rubbleCapacity}</span>
                                    </div>
                                    <div className="h-2 bg-black/40 border border-slate-800 rounded-[3px] overflow-hidden">
                                        <div className={`h-full ${openPit.capacityBlocked ? 'bg-amber-400' : 'bg-cyan-400'}`} style={{ width: `${rubblePercent}%` }} />
                                    </div>
                                    <div className="mt-1 text-[9px] font-mono text-slate-500">
                                        Stockpile {openPit.stockpileCapacity} / Underground dump {openPit.undergroundDumpCapacity}
                                    </div>
                                </div>
                                <div className={`mt-2 text-[10px] leading-snug font-bold ${openPit.capacityBlocked ? 'text-amber-200' : 'text-cyan-100'}`}>
                                    {openPit.nextAction}
                                </div>
                            </div>
                        )}

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
                )}
            </div>
        </div>
    );
};