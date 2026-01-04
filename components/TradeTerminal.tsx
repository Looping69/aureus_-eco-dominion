
import React from 'react';
import { GameState, Action } from '../types';
import { TrendingUp, TrendingDown, Minus, Briefcase, RefreshCw, DollarSign } from 'lucide-react';

interface TradeTerminalProps {
    isOpen: boolean;
    onClose: () => void;
    state: GameState;
    dispatch: React.Dispatch<Action>;
    playSfx: (sfx: any) => void;
}

const PriceSparkline: React.FC<{ history: number[]; color: string }> = ({ history, color }) => {
    if (!history || history.length < 2) return null;
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;

    // SVG points
    const points = history.map((val, i) => {
        const x = (i / (history.length - 1)) * 100;
        const y = 100 - ((val - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="w-full h-16 bg-slate-900/50 rounded-lg border border-slate-700 relative overflow-hidden">
            <svg className="w-full h-full p-1" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    points={points}
                    vectorEffect="non-scaling-stroke"
                />
            </svg>
        </div>
    );
};

export const TradeTerminal: React.FC<TradeTerminalProps> = ({ isOpen, onClose, state, dispatch, playSfx }) => {
    const { market, resources } = state;

    if (!market || !state.contracts) return null;

    return (
        <div className={`fixed top-0 right-0 h-full w-96 bg-slate-950 border-l border-slate-700 shadow-2xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-6 h-full flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <TrendingUp className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-wide uppercase italic">Global Market Exchange</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Trade Network</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                        <Minus className="text-slate-500" size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6">
                    {/* MINERALS MARKET */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Raw Minerals Index</h3>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-mono text-white">{market.minerals.currentPrice.toFixed(1)}</span>
                                    <span className="text-xs font-bold text-slate-500 mb-1">AGT / ton</span>
                                </div>
                            </div>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${market.minerals.trend === 'RISING' ? 'bg-emerald-500/20 text-emerald-400' :
                                market.minerals.trend === 'FALLING' ? 'bg-rose-500/20 text-rose-400' :
                                    'bg-slate-800 text-slate-400'
                                }`}>
                                {market.minerals.trend === 'RISING' && <TrendingUp size={12} />}
                                {market.minerals.trend === 'FALLING' && <TrendingDown size={12} />}
                                {market.minerals.trend}
                            </div>
                        </div>

                        <PriceSparkline history={market.minerals.history} color={market.minerals.trend === 'FALLING' ? '#fb7185' : '#34d399'} />

                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={() => { dispatch({ type: 'SELL_MINERALS' }); }}
                                disabled={resources.minerals <= 0}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <DollarSign size={16} /> SELL ALL ({Math.floor(resources.minerals)})
                            </button>
                        </div>
                    </div>

                    {/* GEMS MARKET */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 opacity-50 relative">
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="bg-black/80 px-4 py-2 rounded border border-slate-700 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Market Offline (Alpha)
                            </div>
                        </div>
                        <div className="flex justify-between items-start mb-4 blur-sm">
                            <div>
                                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Precious Gems Index</h3>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-mono text-white">{market.gems.currentPrice.toFixed(1)}</span>
                                    <span className="text-xs font-bold text-slate-500 mb-1">AGT / ct</span>
                                </div>
                            </div>
                        </div>
                        <div className="blur-sm">
                            <PriceSparkline history={market.gems.history} color="#a78bfa" />
                        </div>
                    </div>

                    {/* CONTRACTS (Placeholder for now) */}
                    <div className="border-t border-slate-800 pt-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Briefcase className="text-amber-500" size={18} />
                            <h3 className="text-white font-bold uppercase tracking-widest text-sm">Active Contracts</h3>
                        </div>

                        {state.contracts.length === 0 ? (
                            <div className="text-center p-8 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                                <RefreshCw className="mx-auto text-slate-600 mb-2 animate-spin-slow" size={24} />
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">No Contracts Available</p>
                                <p className="text-slate-600 text-[10px] mt-1">Check back next cycle</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {state.contracts.map(contract => {
                                    const resType = contract.resource.toLowerCase() as 'minerals' | 'gems';
                                    const canAfford = resources[resType] >= contract.amount;

                                    return (
                                        <div key={contract.id} className="bg-slate-900 border border-slate-700 rounded-lg p-3 relative overflow-hidden group">
                                            {/* Progress Bar Background for Timer */}
                                            <div
                                                className="absolute bottom-0 left-0 h-1 bg-amber-500 transition-all duration-1000"
                                                style={{ width: `${(contract.timeLeft / 120) * 100}%` }}
                                            />

                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide max-w-[70%]">{contract.description}</h4>
                                                <span className={`text-[10px] font-mono font-bold ${contract.timeLeft < 30 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`}>
                                                    {contract.timeLeft}s
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between mt-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-500 uppercase font-bold">Requires</span>
                                                    <span className={`text-sm font-bold ${canAfford ? 'text-white' : 'text-rose-400'}`}>
                                                        {contract.amount} {contract.resource}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] text-slate-500 uppercase font-bold">Reward</span>
                                                    <span className="text-sm font-bold text-emerald-400">
                                                        +{contract.reward} AGT
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    if (canAfford) {
                                                        dispatch({ type: 'COMPLETE_CONTRACT', payload: contract.id });
                                                        playSfx('UI_COIN');
                                                    } else {
                                                        playSfx('UI_ERROR');
                                                    }
                                                }}
                                                disabled={!canAfford}
                                                className={`mt-3 w-full py-2 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all
                                                    ${canAfford
                                                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20 active:translate-y-0.5'
                                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                                                    }
                                                `}
                                            >
                                                {canAfford ? 'Deliver Goods' : 'Insufficient Resources'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
