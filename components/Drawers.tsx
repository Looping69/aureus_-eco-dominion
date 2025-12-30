/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Menu, ArrowLeft, TrendingUp } from 'lucide-react';
import { GameState, Action } from '../types';

interface OpsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  state: GameState;
  dispatch: React.Dispatch<Action>;
  financials: { income: number; cost: number; net: number };
  ecoMult: number;
  trustMult: number;
}

export const OpsDrawer: React.FC<OpsDrawerProps> = ({ isOpen, onClose, state, dispatch, financials, ecoMult, trustMult }) => {
  return (
    <div 
      className={`absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-slate-900/95 backdrop-blur-xl border-r border-slate-700 shadow-2xl transform transition-transform duration-300 z-40 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
         <h2 className="text-xl font-bold text-white flex items-center gap-2"><Menu size={20}/> Operations</h2>
         <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg"><ArrowLeft size={20}/></button>
      </div>
      <div className="p-5 flex-1 overflow-y-auto space-y-4">
         
         {/* Logistics / Trade Terminal */}
         <div className="bg-slate-800/50 rounded-xl p-4 border border-blue-500/30">
            <h3 className="text-blue-400 text-xs font-bold uppercase mb-2 flex items-center gap-2"><TrendingUp size={14}/> Trade Terminal</h3>
            <div className="flex items-center justify-between mb-4">
                <span className="text-slate-300 text-sm">Auto-Sell Minerals</span>
                <button 
                  onClick={() => dispatch({ type: 'UPDATE_LOGISTICS', payload: { autoSell: !state.logistics.autoSell } })}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${state.logistics.autoSell ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${state.logistics.autoSell ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                    <span>Threshold: {state.logistics.sellThreshold}</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="500" 
                  step="10"
                  value={state.logistics.sellThreshold}
                  onChange={(e) => dispatch({ type: 'UPDATE_LOGISTICS', payload: { sellThreshold: parseInt(e.target.value) } })}
                  className="w-full accent-blue-500"
                />
                <p className="text-[10px] text-slate-500">
                    When Ore stock exceeds {state.logistics.sellThreshold}, it will automatically be sold at market price.
                </p>
            </div>
         </div>

         <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Manual Override</h3>
            <div className="text-3xl font-mono text-white mb-4">{Math.floor(state.resources.minerals)} <span className="text-sm text-slate-500">tons</span></div>
            <button 
                onClick={() => dispatch({ type: 'SELL_MINERALS' })}
                disabled={state.resources.minerals < 1}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-amber-950 py-3 rounded-lg font-bold shadow-lg shadow-amber-900/20 transition-all active:scale-95"
              >
                  SELL ALL ({Math.floor(state.resources.minerals * 10 * ecoMult * trustMult)} AGT)
              </button>
         </div>
         
         <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
             <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Empire Stats</h3>
             <div className="space-y-2 text-sm text-slate-300">
                 <div className="flex justify-between">
                     <span>Net Income:</span> 
                     <span className={financials.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                         {financials.net >= 0 ? '+' : ''}{Math.floor(financials.net)}/s
                     </span>
                 </div>
                 <div className="flex justify-between text-xs text-slate-500 pl-2">
                     <span>Rev: +{Math.floor(financials.income)}</span>
                     <span>Cost: -{Math.floor(financials.cost)}</span>
                 </div>
                 <div className="h-px bg-slate-700 my-2"></div>
                 <div className="flex justify-between"><span>Eco Multiplier:</span> <span className="text-emerald-400">x{ecoMult.toFixed(2)}</span></div>
                 <div className="flex justify-between"><span>Trust Multiplier:</span> <span className="text-rose-400">x{trustMult.toFixed(2)}</span></div>
             </div>
         </div>
      </div>
    </div>
  );
};
