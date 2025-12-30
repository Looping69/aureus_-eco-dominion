
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import {
    Home, Factory, Recycle, Sun, Wind,
    Flower2, Droplet, GraduationCap, Tent,
    FlaskConical, ShieldAlert, GitCommit, Waves,
    Footprints, X, Eraser, Lock, Square, Plus, ShoppingCart,
    Coffee, PartyPopper, Container, Pickaxe, Flame
} from 'lucide-react';
import { GameState, BuildingType, Action } from '../types';
import { BUILDINGS } from '../utils/voxelConstants';
import { calculateBuildingCost } from '../utils/gameUtils';

interface SupplySidebarProps {
    isOpen: boolean;
    state: GameState;
    dispatch: React.Dispatch<Action>;
    onClose: () => void;
    playSfx: (type: any) => void;
}

export const getBuildingIcon = (type: BuildingType) => {
    switch (type) {
        case BuildingType.STAFF_QUARTERS: return <Home size={18} />;
        case BuildingType.CANTEEN: return <Coffee size={18} />;
        case BuildingType.SOCIAL_HUB: return <PartyPopper size={18} />;
        case BuildingType.WASH_PLANT: return <Factory size={18} />;
        case BuildingType.RECYCLING_PLANT: return <Recycle size={18} />;
        case BuildingType.SOLAR_ARRAY: return <Sun size={18} />;
        case BuildingType.WIND_TURBINE: return <Wind size={18} />;
        case BuildingType.COMMUNITY_GARDEN: return <Flower2 size={18} />;
        case BuildingType.WATER_WELL: return <Droplet size={18} />;
        case BuildingType.LOCAL_SCHOOL: return <GraduationCap size={18} />;
        case BuildingType.SAFARI_LODGE: return <Tent size={18} />;
        case BuildingType.GREEN_TECH_LAB: return <FlaskConical size={18} />;
        case BuildingType.SECURITY_POST: return <ShieldAlert size={18} />;
        case BuildingType.PIPE: return <GitCommit size={18} className="rotate-90" />;
        case BuildingType.POND: return <Waves size={18} />;
        case BuildingType.RESERVOIR: return <Container size={18} />;
        case BuildingType.MINING_HEADFRAME: return <Pickaxe size={18} />;
        case BuildingType.ORE_FOUNDRY: return <Flame size={18} />;
        case BuildingType.ROAD: return <Footprints size={18} />;
        case BuildingType.FENCE: return <Square size={18} />;
        default: return <X size={18} />;
    }
};

const getCategoryColor = (type: BuildingType): string => {
    const def = BUILDINGS[type];
    if (def.productionType === 'MINERALS') return 'bg-slate-600 border-slate-900';
    if (def.productionType === 'ECO' || type === BuildingType.SOLAR_ARRAY || type === BuildingType.WIND_TURBINE) return 'bg-emerald-600 border-emerald-900';
    if (def.stats.includes('Infrastructure') || type === BuildingType.ROAD || type === BuildingType.PIPE || type === BuildingType.FENCE) return 'bg-blue-700 border-blue-900';
    if (type === BuildingType.SECURITY_POST) return 'bg-rose-600 border-rose-900';
    if (type === BuildingType.CANTEEN || type === BuildingType.SOCIAL_HUB) return 'bg-purple-600 border-purple-900';
    if (type === BuildingType.RESERVOIR) return 'bg-blue-600 border-blue-900';
    return 'bg-slate-700 border-slate-900';
};

export const SupplySidebar: React.FC<SupplySidebarProps> = ({ isOpen, state, dispatch, onClose, playSfx }) => {
    const [inspecting, setInspecting] = useState<{ type: BuildingType, y: number } | null>(null);

    if (!isOpen) return null;

    const shopItems = [
        BuildingType.ROAD,
        BuildingType.PIPE,
        BuildingType.FENCE,
        BuildingType.STAFF_QUARTERS,
        BuildingType.CANTEEN,
        BuildingType.SOCIAL_HUB,
        BuildingType.SECURITY_POST,
        BuildingType.SOLAR_ARRAY,
        BuildingType.COMMUNITY_GARDEN,
        BuildingType.WASH_PLANT,
        BuildingType.RECYCLING_PLANT,
        BuildingType.WATER_WELL,
        BuildingType.POND,
        BuildingType.RESERVOIR,
        BuildingType.WIND_TURBINE,
        BuildingType.LOCAL_SCHOOL,
        BuildingType.SAFARI_LODGE,
        BuildingType.MINING_HEADFRAME,
        BuildingType.ORE_FOUNDRY,
        BuildingType.GREEN_TECH_LAB
    ];

    const handlePurchase = (type: BuildingType) => {
        const scaledCost = calculateBuildingCost(type, state.grid);
        if (state.cheatsEnabled || state.resources.agt >= scaledCost) {
            dispatch({ type: 'BUY_BUILDING', payload: { type, cost: state.cheatsEnabled ? 0 : scaledCost } });
            playSfx('SELL');
        } else {
            playSfx('ERROR');
        }
    };

    const handleBulldozer = () => {
        dispatch({ type: 'ACTIVATE_BULLDOZER' });
        playSfx('UI_CLICK');
        onClose();
    }

    return (
        <div className="absolute right-0 top-14 bottom-40 sm:bottom-28 w-20 z-40 flex flex-col items-center pointer-events-none">
            <div className="w-18 bg-slate-900 border-2 border-r-0 border-slate-700 rounded-l-[4px] shadow-[-4px_4px_0_0_rgba(0,0,0,0.5)] overflow-y-auto no-scrollbar pointer-events-auto py-3 px-2 flex flex-col gap-3 items-center h-full">
                <button
                    onClick={handleBulldozer}
                    className="w-12 h-12 rounded-[4px] flex items-center justify-center shrink-0 transition-all border-2 border-b-[4px] border-rose-900 bg-rose-700 hover:bg-rose-600 text-rose-100 active:border-b-2 active:translate-y-[2px]"
                    title="Bulldozer (Clear/Demolish)"
                >
                    <Eraser size={20} />
                </button>

                <div className="w-full h-0.5 bg-slate-700 shrink-0" />

                {shopItems.map((type) => {
                    const b = BUILDINGS[type];
                    const isEcoLocked = state.resources.eco < b.ecoReq;
                    let dependencyMet = true;
                    if (b.dependency) {
                        dependencyMet = state.grid.some(t => t.buildingType === b.dependency && !t.isUnderConstruction);
                    }
                    const isLocked = !state.cheatsEnabled && (isEcoLocked || !dependencyMet);
                    const cost = calculateBuildingCost(type, state.grid);
                    const canAfford = state.cheatsEnabled || state.resources.agt >= cost;
                    const isInspecting = inspecting?.type === type;

                    return (
                        <button
                            key={type}
                            onClick={(e) => {
                                if (state.cheatsEnabled) {
                                    handlePurchase(type);
                                } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setInspecting({ type, y: rect.top + (rect.height / 2) });
                                    playSfx('UI_CLICK');
                                }
                            }}
                            onMouseEnter={(e) => {
                                if (!inspecting) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setInspecting({ type, y: rect.top + (rect.height / 2) });
                                }
                            }}
                            className={`
                            relative w-12 h-12 rounded-[4px] flex items-center justify-center shrink-0 transition-all border-2 border-b-[4px]
                            ${getCategoryColor(type)}
                            ${isInspecting ? 'ring-2 ring-white scale-105 z-10' : ''}
                            ${isLocked
                                    ? 'opacity-40 grayscale border-slate-800'
                                    : canAfford
                                        ? 'hover:brightness-110 cursor-pointer active:border-b-2 active:translate-y-[2px]'
                                        : 'opacity-70 cursor-pointer border-slate-800'}
                        `}
                        >
                            {isLocked ? (
                                <Lock size={16} className="text-white/50" />
                            ) : (
                                <>
                                    <div className="text-white/90 drop-shadow-md">
                                        {getBuildingIcon(type)}
                                    </div>
                                    {canAfford && (
                                        <div className="absolute -top-1 -right-1 bg-amber-500 rounded-sm p-0.5 border border-black shadow-md">
                                            <Plus size={8} className="text-black stroke-[4]" />
                                        </div>
                                    )}
                                </>
                            )}
                        </button>
                    );
                })}
                <div className="h-4 shrink-0"></div>
            </div>

            {inspecting && (
                <div
                    className="fixed right-20 sm:right-24 w-64 sm:w-72 bg-slate-900 border-2 border-slate-600 rounded-[4px] shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] p-0 pointer-events-auto animate-in fade-in slide-in-from-right-4 z-50 transform -translate-y-1/2"
                    style={{ top: Math.max(100, Math.min(window.innerHeight - 200, inspecting.y)) }}
                >
                    {(() => {
                        const type = inspecting.type;
                        const b = BUILDINGS[type];
                        const scaledCost = calculateBuildingCost(type, state.grid);
                        const canAfford = state.cheatsEnabled || state.resources.agt >= scaledCost;
                        const isEcoLocked = state.resources.eco < b.ecoReq;
                        let dependencyMet = true;
                        if (b.dependency) {
                            dependencyMet = state.grid.some(t => t.buildingType === b.dependency && !t.isUnderConstruction);
                        }
                        const isLocked = !state.cheatsEnabled && (isEcoLocked || !dependencyMet);

                        return (
                            <div className="flex flex-col">
                                {/* Header */}
                                <div className="bg-slate-800 p-2 border-b-2 border-slate-700 flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-[4px] border border-black/20 ${getCategoryColor(type).replace('border-b-[4px]', '')} text-white`}>
                                            {getBuildingIcon(type)}
                                        </div>
                                        <h3 className="font-black text-white text-sm font-['Rajdhani'] tracking-wide uppercase">{b.name}</h3>
                                    </div>
                                    <button
                                        onClick={() => setInspecting(null)}
                                        className="p-1 text-slate-500 hover:text-white transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="p-3">
                                    <p className="text-xs text-slate-400 leading-relaxed font-mono mb-3 border-l-2 border-slate-700 pl-2">{b.desc}</p>

                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="bg-slate-950 border border-slate-800 p-2 rounded-[2px]">
                                            <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Status</span>
                                            <span className="text-emerald-400 font-mono text-xs font-bold">{b.stats}</span>
                                        </div>
                                        <div className="bg-slate-950 border border-slate-800 p-2 rounded-[2px]">
                                            <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Cost Scaling</span>
                                            <span className={state.cheatsEnabled ? "text-amber-400 font-mono text-xs font-bold line-through" : "text-amber-400 font-mono text-xs font-bold"}>{scaledCost} AGT</span>
                                            {state.cheatsEnabled && <span className="text-emerald-400 font-mono text-xs font-bold ml-1">FREE</span>}
                                        </div>
                                    </div>

                                    {!isLocked ? (
                                        <button
                                            onClick={() => handlePurchase(type)}
                                            disabled={!canAfford}
                                            className={`
                                            w-full py-2.5 rounded-[4px] font-black flex items-center justify-center gap-2 transition-all active:translate-y-1 border-b-4 active:border-b-0 uppercase tracking-wider text-xs
                                            ${canAfford
                                                    ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 border-amber-800'
                                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-950'}
                                        `}
                                        >
                                            <ShoppingCart size={14} />
                                            <span>BUY UNIT</span>
                                        </button>
                                    ) : (
                                        <div className="bg-rose-950/50 border border-rose-500/30 rounded-[4px] p-2 text-[10px] text-rose-300 text-center font-bold flex items-center justify-center gap-2 uppercase tracking-wide">
                                            <Lock size={12} />
                                            {isEcoLocked ? `Eco Level ${b.ecoReq} Required` : `Requires ${BUILDINGS[b.dependency!].name}`}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};
