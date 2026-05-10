import React, { useMemo } from 'react';
import { AlertTriangle, Eye, ShieldAlert, Wind } from 'lucide-react';
import { GameState, UndergroundTile } from '../types';

export interface UndergroundHUDProps {
    state: GameState;
}

export const UndergroundHUD: React.FC<UndergroundHUDProps> = ({ state }) => {
    if (state.activeView !== 'DUNGEON') return null;

    const underground = state.underground;

    const { surveyedCount, hazardCount } = useMemo(() => {
        const tiles = Object.values(underground.tiles) as UndergroundTile[];
        return {
            surveyedCount: tiles.length,
            hazardCount: tiles.filter(t => t.hazard !== 'NONE').length,
        };
    }, [underground.tiles]);

    return (
        <div className="pointer-events-none absolute top-4 right-4 z-[60]">
            <div className="bg-slate-950/70 backdrop-blur-sm border border-slate-700/50 rounded-md px-3 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.35)]">
                <div className="text-[9px] uppercase tracking-[0.25em] text-slate-400 font-black mb-1">Below Sector</div>

                <div className="flex items-center justify-between gap-6">
                    <div className="text-white font-black text-sm tracking-tight">{underground.depthLabel}</div>
                    <div className="text-[9px] text-slate-400 font-mono">Depth {underground.depth}</div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-200">
                    <div className="flex items-center gap-1.5">
                        <ShieldAlert size={12} className="text-emerald-400" />
                        <span className="text-slate-400">Stability</span>
                        <span className="ml-auto font-mono">{Math.round(underground.stability)}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Wind size={12} className="text-sky-400" />
                        <span className="text-slate-400">Oxygen</span>
                        <span className="ml-auto font-mono">{Math.round(underground.oxygen)}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Eye size={12} className="text-indigo-300" />
                        <span className="text-slate-400">Surveyed</span>
                        <span className="ml-auto font-mono">{surveyedCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-amber-400" />
                        <span className="text-slate-400">Hazards</span>
                        <span className="ml-auto font-mono">{hazardCount}</span>
                    </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 uppercase tracking-widest">Exposure Risk</span>
                    <span className="font-mono text-rose-300">{Math.round(underground.exposureRisk)}%</span>
                </div>
            </div>
        </div>
    );
};
