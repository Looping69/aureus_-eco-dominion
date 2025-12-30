
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { BuildingType, Action, GameStep } from '../types';
import { getBuildingIcon } from './SupplySidebar';
import { BUILDINGS } from '../utils/voxelConstants';

interface InventoryHUDProps {
    inventory: Partial<Record<BuildingType, number>>;
    selectedBuilding: BuildingType | null;
    dispatch: React.Dispatch<Action>;
    playSfx: (type: any) => void;
    step: GameStep;
}

export const InventoryHUD: React.FC<InventoryHUDProps> = React.memo(({ inventory, selectedBuilding, dispatch, playSfx, step }) => {
    const items = Object.entries(inventory)
        .filter(([_, count]) => typeof count === 'number' && count > 0)
        .map(([type, count]) => ({ type: type as BuildingType, count: count as number }));

    if (items.length === 0) return null;

    const highlightInventory = step === GameStep.TUTORIAL_PLACE;

    return (
        <div className={`absolute bottom-36 sm:bottom-28 left-1/2 -translate-x-1/2 z-30 flex flex-wrap justify-center gap-3 max-w-[95vw] pointer-events-none p-3 rounded-xl transition-all ${highlightInventory ? 'bg-emerald-500/10 border-2 border-emerald-500/50 highlight-pulse pointer-events-auto' : ''}`}>
            {items.map(({ type, count }) => {
                const isSelected = selectedBuilding === type;
                return (
                    <div 
                        key={type} 
                        className="relative group pointer-events-auto"
                    >
                        <button
                            onClick={() => {
                                playSfx('UI_CLICK');
                                dispatch({ 
                                    type: 'SELECT_BUILDING_TO_PLACE', 
                                    payload: isSelected ? null : type 
                                });
                            }}
                            className={`
                                w-12 h-12 rounded-[6px] flex items-center justify-center transition-all duration-100 ease-out
                                border-2 border-b-[5px]
                                ${isSelected 
                                    ? 'bg-emerald-600 border-emerald-800 border-b-2 translate-y-[3px] shadow-inner' 
                                    : 'bg-slate-800 border-slate-950 hover:-translate-y-0.5 hover:border-b-[6px] shadow-xl'
                                }
                            `}
                        >
                            <div className={`${isSelected ? 'text-white' : 'text-slate-200'} drop-shadow-md`}>
                                {getBuildingIcon(type)}
                            </div>
                        </button>
                        
                        {/* Count Badge - Voxel Style */}
                        <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-[9px] font-black min-w-[18px] h-[18px] rounded-[4px] flex items-center justify-center border-2 border-rose-800 shadow-md z-10">
                            {count}
                        </div>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="bg-slate-900 border-2 border-slate-600 text-white px-2 py-1 rounded-[4px] shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] whitespace-nowrap">
                                <p className="text-[10px] font-bold uppercase tracking-wider font-['Rajdhani']">{BUILDINGS[type].name}</p>
                            </div>
                            {/* Little arrow */}
                            <div className="w-2 h-2 bg-slate-600 absolute left-1/2 -translate-x-1/2 -bottom-1 rotate-45 border-b-2 border-r-2 border-slate-900"></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
});
