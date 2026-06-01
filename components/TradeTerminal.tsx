
import React from 'react';
import {
    GameState,
    Action,
    FactoryResourceType,
    FactorySectorDirective,
    FactorySectorFlowMode,
    FactorySectorCongestionMode,
} from '../types';
import { TrendingUp, TrendingDown, Minus, Briefcase, RefreshCw, Map, RadioTower, Zap, Gauge, Activity, ClipboardList } from 'lucide-react';

interface TradeTerminalProps {
    isOpen: boolean;
    onClose: () => void;
    state: GameState;
    dispatch: React.Dispatch<Action>;
    playSfx: (sfx: any) => void;
}

const SECTOR_RESOURCE_LABELS: Record<FactoryResourceType, string> = {
    ORE: 'Ore',
    CONCENTRATE: 'Conc.',
    MINERALS: 'Minerals',
    WOOD: 'Wood',
    STONE: 'Stone',
    GEMS: 'Gems',
    REFINED_MATERIALS: 'Refined',
    ALLOYS: 'Alloys',
    MACHINE_PARTS: 'Parts',
    AUTOMATION_KITS: 'Kits',
};

const SECTOR_DIRECTIVES: FactorySectorDirective[] = ['BALANCED', 'EXPORT', 'IMPORT'];
const FLOW_MODES: FactorySectorFlowMode[] = ['STABLE', 'SURGE'];
const CONGESTION_POLICIES: FactorySectorCongestionMode[] = ['SAFE', 'BALANCED', 'AGGRESSIVE'];
const CONTRACT_TARGETS = [16, 24, 32, 48, 64, 96];
const PRIORITY_RESOURCE_ORDER: FactoryResourceType[] = [
    'MINERALS',
    'WOOD',
    'STONE',
    'GEMS',
    'REFINED_MATERIALS',
    'ALLOYS',
    'MACHINE_PARTS',
    'AUTOMATION_KITS',
];

const getSectorBadge = (name: string) =>
    name
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 3)
        .toUpperCase();

const toPercent = (value: number) => `${Math.round(value * 100)}%`;

const getSatisfactionTone = (value: number) => {
    if (value >= 0.75) return 'text-emerald-300';
    if (value >= 0.45) return 'text-amber-300';
    return 'text-rose-300';
};

const formatPressureReason = (reason?: string) => {
    if (reason === 'ROUTE_DEBT') return 'Route debt';
    if (reason === 'UNDERFED') return 'Underfed';
    return 'Congestion';
};

const getNextDirective = (directive?: FactorySectorDirective): FactorySectorDirective => {
    const current = directive || 'BALANCED';
    const index = SECTOR_DIRECTIVES.indexOf(current);
    return SECTOR_DIRECTIVES[(index + 1) % SECTOR_DIRECTIVES.length];
};

const getNextFlowMode = (mode?: FactorySectorFlowMode): FactorySectorFlowMode => {
    const current = mode || 'STABLE';
    const index = FLOW_MODES.indexOf(current);
    return FLOW_MODES[(index + 1) % FLOW_MODES.length];
};

const getNextCongestionPolicy = (policy?: FactorySectorCongestionMode): FactorySectorCongestionMode => {
    const current = policy || 'BALANCED';
    const index = CONGESTION_POLICIES.indexOf(current);
    return CONGESTION_POLICIES[(index + 1) % CONGESTION_POLICIES.length];
};

const getNextPriorityResource = (resource?: FactoryResourceType): FactoryResourceType => {
    const current = resource || PRIORITY_RESOURCE_ORDER[0];
    const index = PRIORITY_RESOURCE_ORDER.indexOf(current);
    return PRIORITY_RESOURCE_ORDER[(index + 1) % PRIORITY_RESOURCE_ORDER.length];
};

const getNextContractTarget = (target?: number): number => {
    const current = target || CONTRACT_TARGETS[1];
    const index = CONTRACT_TARGETS.indexOf(current);
    return CONTRACT_TARGETS[(index + 1 + CONTRACT_TARGETS.length) % CONTRACT_TARGETS.length];
};

const PriceSparkline: React.FC<{ history: number[]; color: string }> = ({ history, color }) => {
    if (!history || history.length < 2) return null;
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;

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
    const [walletAddress, setWalletAddress] = React.useState('');
    const sectors = [...(state.factory?.sectors || [])].sort((a, b) => {
        if ((b.contractTarget || 0) !== (a.contractTarget || 0)) return (b.contractTarget || 0) - (a.contractTarget || 0);
        if (b.throughput !== a.throughput) return b.throughput - a.throughput;
        return b.stationCount - a.stationCount;
    });
    const pressure = state.factory?.pressure;
    const bottlenecks = pressure?.bottlenecks || [];

    if (!market || !state.contracts) return null;

    return (
        <div
            className={`fixed top-0 right-0 h-full w-96 bg-slate-950 border-l border-slate-700 shadow-2xl z-50 transform transition-transform duration-300 pointer-events-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            onClick={(e) => e.stopPropagation()}
        >
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
                    <div className="bg-slate-900 border border-cyan-900/60 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Map className="text-cyan-400" size={16} />
                                    <h3 className="text-cyan-300 text-xs font-bold uppercase tracking-wider">Sector Market</h3>
                                </div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Regional export, congestion, and quota control</p>
                            </div>
                            <div className="text-right text-[10px] font-mono text-slate-400">
                                <div>{sectors.length} sectors</div>
                                <div>{Math.floor(state.factory?.regionalThroughput || 0)} rail</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-3 text-[10px] font-mono">
                            <div className="bg-slate-950/80 border border-slate-800 rounded px-2 py-2">
                                <div className="text-slate-500 font-bold uppercase tracking-wider">Route debt</div>
                                <div className="text-rose-300 font-bold">{Math.round(pressure?.routeDebt || 0)}</div>
                            </div>
                            <div className="bg-slate-950/80 border border-slate-800 rounded px-2 py-2">
                                <div className="text-slate-500 font-bold uppercase tracking-wider">Underfed</div>
                                <div className="text-amber-300 font-bold">{pressure?.underfedProcessors || 0}</div>
                            </div>
                            <div className="bg-slate-950/80 border border-slate-800 rounded px-2 py-2">
                                <div className="text-slate-500 font-bold uppercase tracking-wider">Hotspots</div>
                                <div className="text-cyan-300 font-bold">{pressure?.hotspots || 0}</div>
                            </div>
                        </div>

                        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 mb-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div>
                                    <div className="text-slate-300 text-xs font-bold uppercase tracking-wider">Megafactory Planning</div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Whole-network bottlenecks, route debt, and starved processors</div>
                                </div>
                            </div>
                            {bottlenecks.length === 0 ? (
                                <div className="text-[10px] text-slate-500 font-mono">No active bottlenecks yet. Scale the network to start reading pressure.</div>
                            ) : (
                                <div className="space-y-2">
                                    {bottlenecks.slice(0, 4).map((point) => (
                                        <div key={`${point.key}-${point.reason}-${point.resource || 'none'}`} className="flex items-start justify-between gap-2 border border-slate-800 rounded px-2 py-2 bg-slate-900/70">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[9px] font-black text-rose-300 bg-rose-950/70 border border-rose-900 rounded-[3px] px-1.5 py-0.5 shrink-0">{formatPressureReason(point.reason)}</span>
                                                    <span className="text-[10px] text-white font-bold truncate">{point.sectorName || point.key}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono truncate">{point.detail}</div>
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-mono shrink-0">{Math.round(point.severity)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {sectors.length === 0 ? (
                            <div className="text-center p-4 bg-slate-950/80 rounded-lg border border-dashed border-slate-800">
                                <RadioTower className="mx-auto text-slate-600 mb-2" size={20} />
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">No active sectors</p>
                                <p className="text-slate-600 text-[10px] mt-1">Build train stations to open regional trade lanes.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sectors.map((sector) => {
                                    const directive = sector.directive || 'BALANCED';
                                    const flowMode = sector.flowMode || 'STABLE';
                                    const congestionPolicy = sector.congestionPolicy || 'BALANCED';
                                    const priorityResource = sector.priorityResource || (directive === 'IMPORT' ? sector.importFocus : sector.exportFocus);
                                    const contractResource = sector.contractResource || (directive === 'EXPORT' ? sector.exportFocus : sector.importFocus);
                                    const contractTarget = sector.contractTarget || 24;
                                    const contractProgress = Math.min(contractTarget, sector.contractProgress || 0);
                                    const quotaCompletion = contractTarget > 0 ? Math.min(1, contractProgress / contractTarget) : 0;
                                    const congestionLevel = sector.congestionLevel || 0;
                                    const satisfaction = sector.satisfaction ?? 0.72;
                                    const bonusChain = sector.bonusChain ?? 0;

                                    const updatePolicy = (payload: Record<string, unknown>) => {
                                        dispatch({
                                            type: 'UPDATE_SECTOR_POLICY',
                                            payload: {
                                                sectorName: sector.name,
                                                directive,
                                                priorityResource,
                                                flowMode,
                                                congestionPolicy,
                                                contractResource,
                                                contractTarget,
                                                ...payload,
                                            },
                                        });
                                        playSfx('UI_CLICK');
                                    };

                                    return (
                                        <div key={sector.name} className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
                                            <div className="flex items-center justify-between gap-3 mb-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-[9px] font-black text-cyan-300 bg-cyan-950/80 border border-cyan-800 rounded-[3px] px-1.5 py-1 shrink-0">
                                                        {getSectorBadge(sector.name)}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-white truncate">{sector.name}</div>
                                                        <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{sector.stationCount} hubs · {Math.round(sector.throughput)} flow</div>
                                                    </div>
                                                </div>
                                                <div className="text-right text-[10px] font-mono text-slate-400 shrink-0">
                                                    <div className="flex items-center justify-end gap-1"><Zap size={10} className="text-emerald-400" />{toPercent(sector.demandBonus)}</div>
                                                    <div>{directive.toLowerCase()}</div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                                <div className="bg-emerald-950/30 border border-emerald-900/40 rounded px-2 py-2">
                                                    <div className="text-emerald-400 font-bold uppercase tracking-wider mb-1">Exports</div>
                                                    <div className="text-white font-bold">{SECTOR_RESOURCE_LABELS[sector.exportFocus]}</div>
                                                    <div className="text-emerald-300">+{toPercent(sector.exportBonus)} price</div>
                                                </div>
                                                <div className="bg-violet-950/30 border border-violet-900/40 rounded px-2 py-2">
                                                    <div className="text-violet-400 font-bold uppercase tracking-wider mb-1">Imports</div>
                                                    <div className="text-white font-bold">{SECTOR_RESOURCE_LABELS[sector.importFocus]}</div>
                                                    <div className="text-violet-300">-{toPercent(sector.importDiscount)} cost</div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] font-mono">
                                                <div className="bg-slate-900 border border-slate-800 rounded px-2 py-2">
                                                    <div className="text-slate-500 font-bold uppercase tracking-wider mb-1">Satisfaction</div>
                                                    <div className={`font-bold ${getSatisfactionTone(satisfaction)}`}>{toPercent(satisfaction)}</div>
                                                </div>
                                                <div className="bg-slate-900 border border-slate-800 rounded px-2 py-2">
                                                    <div className="text-slate-500 font-bold uppercase tracking-wider mb-1">Chain</div>
                                                    <div className="text-lime-300 font-bold">x{bonusChain}</div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 mt-3 text-[10px] font-mono">
                                                <div className="bg-slate-900 border border-slate-800 rounded px-2 py-2">
                                                    <div className="text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Gauge size={10} />Flow</div>
                                                    <div className="text-cyan-300 font-bold">{flowMode}</div>
                                                    <div className="text-slate-400">{Math.round(sector.throughput)} / tick</div>
                                                </div>
                                                <div className="bg-slate-900 border border-slate-800 rounded px-2 py-2">
                                                    <div className="text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Activity size={10} />Congest</div>
                                                    <div className="text-amber-300 font-bold">{congestionPolicy}</div>
                                                    <div className="text-slate-400">{toPercent(congestionLevel)}</div>
                                                </div>
                                                <div className="bg-slate-900 border border-slate-800 rounded px-2 py-2">
                                                    <div className="text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ClipboardList size={10} />Quota</div>
                                                    <div className="text-orange-300 font-bold">{SECTOR_RESOURCE_LABELS[contractResource]}</div>
                                                    <div className="text-slate-400">{Math.round(contractProgress)} / {contractTarget}</div>
                                                </div>
                                            </div>
                                            <div className="mt-3">
                                                <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                                                    <span>Demand contract</span>
                                                    <span>{Math.round(quotaCompletion * 100)}% · +{sector.contractReward || 0} AGT</span>
                                                </div>
                                                <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${quotaCompletion * 100}%` }} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-3">
                                                <button
                                                    onClick={() => updatePolicy({ directive: getNextDirective(directive) })}
                                                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded px-2 py-2 text-left transition-colors"
                                                >
                                                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Dispatch</div>
                                                    <div className="text-xs font-bold text-cyan-300">{directive}</div>
                                                </button>
                                                <button
                                                    onClick={() => updatePolicy({ priorityResource: getNextPriorityResource(priorityResource) })}
                                                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded px-2 py-2 text-left transition-colors"
                                                >
                                                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Priority</div>
                                                    <div className="text-xs font-bold text-amber-300">{SECTOR_RESOURCE_LABELS[priorityResource]}</div>
                                                </button>
                                                <button
                                                    onClick={() => updatePolicy({ flowMode: getNextFlowMode(flowMode) })}
                                                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded px-2 py-2 text-left transition-colors"
                                                >
                                                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Throughput</div>
                                                    <div className="text-xs font-bold text-sky-300">{flowMode}</div>
                                                </button>
                                                <button
                                                    onClick={() => updatePolicy({ congestionPolicy: getNextCongestionPolicy(congestionPolicy) })}
                                                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded px-2 py-2 text-left transition-colors"
                                                >
                                                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Congestion</div>
                                                    <div className="text-xs font-bold text-rose-300">{congestionPolicy}</div>
                                                </button>
                                                <button
                                                    onClick={() => updatePolicy({ contractResource: getNextPriorityResource(contractResource) })}
                                                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded px-2 py-2 text-left transition-colors"
                                                >
                                                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Contract</div>
                                                    <div className="text-xs font-bold text-orange-300">{SECTOR_RESOURCE_LABELS[contractResource]}</div>
                                                </button>
                                                <button
                                                    onClick={() => updatePolicy({ contractTarget: getNextContractTarget(contractTarget) })}
                                                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded px-2 py-2 text-left transition-colors"
                                                >
                                                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Quota</div>
                                                    <div className="text-xs font-bold text-lime-300">{contractTarget}</div>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

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
                                onClick={() => { dispatch({ type: 'SELL_MINERALS' }); playSfx('UI_COIN'); }}
                                disabled={resources.minerals <= 0}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1"
                            >
                                SELL ({Math.floor(resources.minerals)})
                            </button>
                            <button
                                onClick={() => { dispatch({ type: 'BUY_RESOURCE', payload: { resource: 'minerals', amount: 100 } }); }}
                                disabled={resources.agt < Math.floor(market.minerals.currentPrice * 1.25 * 100)}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-blue-400 font-bold py-2 rounded-lg text-xs border border-blue-500/30"
                            >
                                BUY 100 ({(market.minerals.currentPrice * 1.25 * 100).toFixed(0)})
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Thundergems Index</h3>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-mono text-white">{market.gems.currentPrice.toFixed(1)}</span>
                                    <span className="text-xs font-bold text-slate-500 mb-1">AGT / Gem</span>
                                </div>
                            </div>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${market.gems.trend === 'RISING' ? 'bg-emerald-500/20 text-emerald-400' :
                                market.gems.trend === 'FALLING' ? 'bg-rose-500/20 text-rose-400' :
                                    'bg-slate-800 text-slate-400'
                                }`}>
                                {market.gems.trend === 'RISING' && <TrendingUp size={12} />}
                                {market.gems.trend === 'FALLING' && <TrendingDown size={12} />}
                                {market.gems.trend}
                            </div>
                        </div>
                        <PriceSparkline history={market.gems.history} color="#a78bfa" />
                        <div className="mt-4 space-y-3">
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 block">Recipient Wallet Address</label>
                                <input
                                    type="text"
                                    placeholder="Enter 0x..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-mono focus:border-purple-500 focus:outline-none placeholder-slate-600"
                                    value={walletAddress}
                                    onChange={(e) => setWalletAddress(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        dispatch({ type: 'SELL_GEMS', payload: { address: walletAddress } });
                                        playSfx('UI_COIN');
                                        setWalletAddress('');
                                    }}
                                    disabled={resources.gems <= 0 || !walletAddress.trim()}
                                    className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg text-xs"
                                >
                                    DEPOSIT ({Math.floor(resources.gems)})
                                </button>
                                <button
                                    onClick={() => { dispatch({ type: 'BUY_RESOURCE', payload: { resource: 'gems', amount: 10 } }); }}
                                    disabled={resources.agt < Math.floor(market.gems.currentPrice * 1.25 * 10)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-purple-400 font-bold py-2 rounded-lg text-xs border border-purple-500/30"
                                >
                                    BUY 10 ({(market.gems.currentPrice * 1.25 * 10).toFixed(0)})
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Wood Market</h3>
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-2xl font-mono text-white">{market.wood.currentPrice.toFixed(1)} <span className="text-xs text-slate-500">AGT</span></span>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{market.wood.trend}</div>
                            </div>
                            <PriceSparkline history={market.wood.history} color="#92400e" />
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => { dispatch({ type: 'SELL_WOOD' }); playSfx('UI_COIN'); }}
                                    disabled={resources.wood <= 0}
                                    className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-[10px]"
                                >
                                    SELL
                                </button>
                                <button
                                    onClick={() => { dispatch({ type: 'BUY_RESOURCE', payload: { resource: 'wood', amount: 50 } }); }}
                                    disabled={resources.agt < Math.floor(market.wood.currentPrice * 1.25 * 50)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-500 font-bold py-2 rounded-lg text-[10px] border border-amber-500/30"
                                >
                                    BUY 50 ({(market.wood.currentPrice * 1.25 * 50).toFixed(0)})
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Stone Market</h3>
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-2xl font-mono text-white">{market.stone.currentPrice.toFixed(1)} <span className="text-xs text-slate-500">AGT</span></span>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{market.stone.trend}</div>
                            </div>
                            <PriceSparkline history={market.stone.history} color="#64748b" />
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => { dispatch({ type: 'SELL_STONE' }); playSfx('UI_COIN'); }}
                                    disabled={resources.stone <= 0}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-[10px]"
                                >
                                    SELL
                                </button>
                                <button
                                    onClick={() => { dispatch({ type: 'BUY_RESOURCE', payload: { resource: 'stone', amount: 50 } }); }}
                                    disabled={resources.agt < Math.floor(market.stone.currentPrice * 1.25 * 50)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-400 font-bold py-2 rounded-lg text-[10px] border border-slate-500/30"
                                >
                                    BUY 50 ({(market.stone.currentPrice * 1.25 * 50).toFixed(0)})
                                </button>
                            </div>
                        </div>
                    </div>

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
                                    const resType = contract.resource.toLowerCase() as 'minerals' | 'gems' | 'wood' | 'stone';
                                    const canAfford = resources[resType] >= contract.amount;

                                    return (
                                        <div key={contract.id} className="bg-slate-900 border border-slate-700 rounded-lg p-3 relative overflow-hidden group">
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
                                                        dispatch({ type: 'DELIVER_CONTRACT', payload: contract.id });
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
        </div >
    );
};
