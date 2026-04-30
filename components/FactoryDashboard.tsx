import React, { useState } from 'react';
import { BarChart3, ChevronRight, Droplets, Factory, Pickaxe, Power, SlidersHorizontal, Zap } from 'lucide-react';
import { Action, GameState } from '../types';
import { buildFactoryDashboardMetrics } from '../game/factoryDashboard';

interface FactoryDashboardProps {
    state: GameState;
    dispatch: React.Dispatch<Action>;
    playSfx: (type: any) => void;
}

const statusClass = (value: number) => value < 0 ? 'text-rose-400' : value === 0 ? 'text-amber-400' : 'text-emerald-400';

const MetricRow = ({ label, value, icon: Icon, valueClass = 'text-white' }: { label: string; value: string; icon: any; valueClass?: string }) => (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5 last:border-b-0 last:pb-0">
        <div className="flex items-center gap-2 min-w-0">
            <Icon size={12} className="text-slate-500 shrink-0" />
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider truncate">{label}</span>
        </div>
        <span className={`text-[11px] font-mono font-bold ${valueClass}`}>{value}</span>
    </div>
);

export const FactoryDashboard: React.FC<FactoryDashboardProps> = React.memo(({ state, dispatch, playSfx }) => {
    const [isCollapsed, setIsCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
    const metrics = buildFactoryDashboardMetrics(state);

    const updateLogistics = (next: Partial<GameState['logistics']>) => {
        dispatch({
            type: 'UPDATE_LOGISTICS',
            payload: {
                ...state.logistics,
                ...next,
            },
        });
        playSfx('UI_CLICK');
    };

    if (isCollapsed) {
        return (
            <div className="absolute z-30 top-[232px] right-2 sm:top-48 sm:right-4 pointer-events-auto animate-in slide-in-from-right-4">
                <button
                    onClick={() => {
                        setIsCollapsed(false);
                        playSfx('UI_CLICK');
                    }}
                    className="w-10 h-10 bg-slate-900 border-2 border-slate-600 flex items-center justify-center hover:bg-slate-800 transition-colors shadow-lg group"
                    title="Open factory dashboard"
                >
                    <Factory size={20} className="text-slate-400 group-hover:text-amber-400 transition-colors" />
                </button>
            </div>
        );
    }

    return (
        <aside className="absolute z-30 top-[232px] right-2 sm:top-48 sm:right-4 pointer-events-auto w-[190px] sm:w-[220px] animate-in slide-in-from-right-4">
            <div className="bg-slate-900 border-2 border-slate-700 shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] rounded-sm overflow-hidden">
                <button
                    onClick={() => {
                        setIsCollapsed(true);
                        playSfx('UI_CLICK');
                    }}
                    className="w-full flex items-center justify-between p-2 bg-slate-800 border-b border-slate-700 hover:bg-slate-750 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <BarChart3 size={12} className="text-amber-400" />
                        <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest font-['Rajdhani']">Factory</span>
                    </div>
                    <ChevronRight size={13} className="text-slate-500" />
                </button>

                <div className="p-2.5 space-y-2.5">
                    <div className="space-y-1.5">
                        <MetricRow label="Net AGT" value={`${metrics.netAgtPerSecond >= 0 ? '+' : ''}${metrics.netAgtPerSecond.toFixed(1)}/s`} icon={Zap} valueClass={statusClass(metrics.netAgtPerSecond)} />
                        <MetricRow label="Power" value={`${metrics.powerBalance >= 0 ? '+' : ''}${metrics.powerBalance}`} icon={Power} valueClass={statusClass(metrics.powerBalance)} />
                        <MetricRow label="Water" value={`${metrics.waterBalance >= 0 ? '+' : ''}${metrics.waterBalance}`} icon={Droplets} valueClass={statusClass(metrics.waterBalance)} />
                        <MetricRow label="Jobs" value={`${metrics.pendingJobs}/${metrics.assignedJobs}`} icon={SlidersHorizontal} valueClass={metrics.pendingJobs > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                        <MetricRow label="Ore" value={metrics.oreStockpile.toLocaleString()} icon={Pickaxe} valueClass="text-slate-200" />
                    </div>

                    <div className="bg-slate-950 border border-slate-800 p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Auto Sell</span>
                            <button
                                onClick={() => updateLogistics({ autoSell: !state.logistics.autoSell })}
                                className={`w-10 h-5 rounded-full p-0.5 transition-colors ${state.logistics.autoSell ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                title="Toggle automatic ore exports"
                            >
                                <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${state.logistics.autoSell ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <label className="block">
                            <div className="flex justify-between text-[8px] font-mono font-bold uppercase tracking-wider mb-1">
                                <span className="text-slate-500">Threshold</span>
                                <span className="text-amber-400">{state.logistics.sellThreshold}</span>
                            </div>
                            <input
                                type="range"
                                min={25}
                                max={500}
                                step={25}
                                value={state.logistics.sellThreshold}
                                onChange={(event) => updateLogistics({ sellThreshold: Number(event.target.value) })}
                                className="w-full accent-amber-500"
                            />
                        </label>
                    </div>
                </div>
            </div>
        </aside>
    );
});
