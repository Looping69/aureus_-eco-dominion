import React from 'react';
import { Briefcase, CheckCircle2, ChevronDown, ChevronUp, Clock, Package, XCircle } from 'lucide-react';
import { Contract, GameState, SfxType } from '../types';
import { getContractLifecycleState } from '../engine/stateMachines/contractLifecycle';
import { useContractPanelStore } from './state/useContractPanelStore';

interface ContractTrackerProps {
    state: GameState;
    world: any;
    playSfx: (sfx: any) => void;
}

const RESOURCE_KEY: Record<Contract['resource'], 'minerals' | 'gems' | 'wood' | 'stone'> = {
    MINERALS: 'minerals',
    GEMS: 'gems',
    WOOD: 'wood',
    STONE: 'stone',
};

const RESOURCE_LABEL: Record<Contract['resource'], string> = {
    MINERALS: 'Minerals',
    GEMS: 'Gems',
    WOOD: 'Wood',
    STONE: 'Stone',
};

const STATUS_TONE: Record<string, string> = {
    available: 'border-cyan-800 bg-cyan-950/40 text-cyan-200',
    accepted: 'border-amber-800 bg-amber-950/40 text-amber-200',
    readyToDeliver: 'border-emerald-800 bg-emerald-950/40 text-emerald-200',
    completed: 'border-emerald-800 bg-emerald-950/40 text-emerald-200',
    failed: 'border-rose-800 bg-rose-950/40 text-rose-200',
};

const getStatusIcon = (status: Contract['status'] | undefined) => {
    const lifecycleState = getContractLifecycleState(status);
    if (lifecycleState === 'completed' || lifecycleState === 'readyToDeliver') return <CheckCircle2 size={12} />;
    if (lifecycleState === 'failed') return <XCircle size={12} />;
    if (lifecycleState === 'accepted') return <Package size={12} />;
    return <Briefcase size={12} />;
};

const getStatusLabel = (status: Contract['status'] | undefined) => {
    const lifecycleState = getContractLifecycleState(status);
    if (lifecycleState === 'readyToDeliver') return 'READY TO DELIVER';
    return lifecycleState.replace(/([A-Z])/g, ' $1').toUpperCase();
};

const formatTime = (seconds: number) => {
    const clamped = Math.max(0, Math.ceil(seconds));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const queueContractCommand = (world: any, type: 'ACCEPT_CONTRACT' | 'DELIVER_CONTRACT' | 'ABANDON_CONTRACT', contractId: string) => {
    const gameState = world?.getState?.();
    if (!gameState?.commandQueue) return false;
    gameState.commandQueue.push({
        id: `ui_${type.toLowerCase()}_${Date.now()}`,
        type: type as any,
        payload: { contractId },
        issuedAtTick: gameState.tickCount,
    });
    return true;
};

export const ContractTracker: React.FC<ContractTrackerProps> = ({ state, world, playSfx }) => {
    const [, forceRefresh] = React.useState(0);
    const isCollapsed = useContractPanelStore((store) => store.isCollapsed);
    const hasAttention = useContractPanelStore((store) => store.hasAttention);
    const toggleCollapsed = useContractPanelStore((store) => store.toggleCollapsed);
    const markAttention = useContractPanelStore((store) => store.markAttention);

    React.useEffect(() => {
        const timer = window.setInterval(() => forceRefresh(value => value + 1), 500);
        return () => window.clearInterval(timer);
    }, []);

    const liveState = world?.getState?.() || state;
    const contracts = (liveState.contracts || [])
        .filter(contract => (contract.status || 'AVAILABLE') !== 'FAILED' || contract.timeLeft > 0)
        .slice(0, 3);

    const readyCount = contracts.filter(contract => getContractLifecycleState(contract.status) === 'readyToDeliver').length;
    const acceptedCount = contracts.filter(contract => getContractLifecycleState(contract.status) === 'accepted').length;

    React.useEffect(() => {
        if (isCollapsed && readyCount > 0) {
            markAttention();
        }
    }, [isCollapsed, markAttention, readyCount]);

    if (contracts.length === 0) return null;

    const lastResult = liveState.ui?.lastCommandResult;
    const contractResult = lastResult && ['ACCEPT_CONTRACT', 'DELIVER_CONTRACT', 'ABANDON_CONTRACT'].includes(lastResult.type)
        ? lastResult
        : null;

    const handleToggle = () => {
        toggleCollapsed();
        playSfx(SfxType.UI_CLICK);
    };

    return (
        <div className="w-[21rem] max-w-[calc(100vw-1rem)] pointer-events-auto">
            <div className="bg-slate-950/88 backdrop-blur-md border border-slate-800 shadow-[4px_4px_0_rgba(0,0,0,0.35)] rounded-[6px] overflow-hidden">
                <button
                    onClick={handleToggle}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/80 hover:bg-slate-800/80 transition-colors text-left"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="relative">
                            <Briefcase size={15} className="text-amber-300" />
                            {hasAttention && isCollapsed && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950 animate-pulse" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-wider text-white">Contracts</div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
                                {readyCount > 0 ? `${readyCount} ready to deliver` : acceptedCount > 0 ? `${acceptedCount} in progress` : 'Accept, deliver, get paid'}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="text-[9px] font-mono text-slate-500">{contracts.length}/3</div>
                        {isCollapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
                    </div>
                </button>

                {isCollapsed ? (
                    <div className="px-3 py-2 bg-slate-950/70 text-[10px] font-mono text-slate-400 flex items-center justify-between gap-2">
                        <span>{readyCount > 0 ? 'Delivery waiting' : 'Panel collapsed'}</span>
                        <span className={readyCount > 0 ? 'text-emerald-300 font-bold' : 'text-slate-500'}>{readyCount > 0 ? 'Open to deliver' : 'Click to open'}</span>
                    </div>
                ) : (
                    <div className="p-2 space-y-2">
                        {contracts.map(contract => {
                            const status = contract.status || 'AVAILABLE';
                            const lifecycleState = getContractLifecycleState(status);
                            const resourceKey = RESOURCE_KEY[contract.resource];
                            const available = Math.floor(liveState.resources[resourceKey] || 0);
                            const progress = lifecycleState === 'completed' || lifecycleState === 'readyToDeliver'
                                ? 1
                                : Math.min(1, available / Math.max(1, contract.amount));
                            const canDeliver = (lifecycleState === 'accepted' || lifecycleState === 'readyToDeliver') && available >= contract.amount;
                            const timeRatio = Math.min(1, contract.timeLeft / (lifecycleState === 'available' ? 180 : 300));
                            const trustReward = contract.trustReward ?? 2;
                            const trustPenalty = contract.trustPenalty ?? 3;

                            const handleAccept = () => {
                                if (queueContractCommand(world, 'ACCEPT_CONTRACT', contract.id)) {
                                    playSfx(SfxType.UI_CLICK);
                                    window.setTimeout(() => forceRefresh(value => value + 1), 80);
                                } else {
                                    playSfx(SfxType.ERROR);
                                }
                            };

                            const handleDeliver = () => {
                                if (queueContractCommand(world, 'DELIVER_CONTRACT', contract.id)) {
                                    playSfx(canDeliver ? SfxType.UI_COIN : SfxType.ERROR);
                                    window.setTimeout(() => forceRefresh(value => value + 1), 80);
                                } else {
                                    playSfx(SfxType.ERROR);
                                }
                            };

                            const handleAbandon = () => {
                                if (queueContractCommand(world, 'ABANDON_CONTRACT', contract.id)) {
                                    playSfx(SfxType.ERROR);
                                    window.setTimeout(() => forceRefresh(value => value + 1), 80);
                                } else {
                                    playSfx(SfxType.ERROR);
                                }
                            };

                            return (
                                <div key={contract.id} className="bg-slate-900/90 border border-slate-800 rounded-[5px] p-2">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="min-w-0">
                                            <div className={`inline-flex items-center gap-1 border rounded-[3px] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${STATUS_TONE[lifecycleState] || STATUS_TONE.available}`}>
                                                {getStatusIcon(status)}
                                                {getStatusLabel(status)}
                                            </div>
                                            <div className="mt-1 text-[10px] font-bold text-slate-200 leading-snug">
                                                Deliver {contract.amount} {RESOURCE_LABEL[contract.resource]} for {contract.reward.toLocaleString()} AGT
                                            </div>
                                        </div>
                                        <div className={`flex items-center gap-1 text-[10px] font-mono shrink-0 ${contract.timeLeft < 30 && (lifecycleState === 'accepted' || lifecycleState === 'readyToDeliver') ? 'text-rose-300 animate-pulse' : 'text-slate-400'}`}>
                                            <Clock size={11} />
                                            {formatTime(contract.timeLeft)}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-1 text-[9px] font-mono mb-2">
                                        <div className="bg-slate-950/80 border border-slate-800 rounded px-1.5 py-1">
                                            <div className="text-slate-500 uppercase font-bold">Have</div>
                                            <div className={available >= contract.amount ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>{available}</div>
                                        </div>
                                        <div className="bg-slate-950/80 border border-slate-800 rounded px-1.5 py-1">
                                            <div className="text-slate-500 uppercase font-bold">Need</div>
                                            <div className="text-white font-bold">{contract.amount}</div>
                                        </div>
                                        <div className="bg-slate-950/80 border border-slate-800 rounded px-1.5 py-1">
                                            <div className="text-slate-500 uppercase font-bold">Fail</div>
                                            <div className="text-rose-300 font-bold">-{contract.penalty}</div>
                                        </div>
                                    </div>

                                    <div className="h-1.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden mb-1.5">
                                        <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400" style={{ width: `${progress * 100}%` }} />
                                    </div>
                                    <div className="h-1 bg-slate-950 rounded-full overflow-hidden mb-2">
                                        <div className={lifecycleState === 'failed' ? 'h-full bg-rose-500' : 'h-full bg-amber-500'} style={{ width: `${timeRatio * 100}%` }} />
                                    </div>

                                    {lifecycleState === 'available' && (
                                        <button
                                            onClick={handleAccept}
                                            className="w-full bg-cyan-700 hover:bg-cyan-600 text-white rounded-[4px] py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors"
                                        >
                                            Accept Contract
                                        </button>
                                    )}
                                    {lifecycleState === 'accepted' && (
                                        <div className="space-y-1">
                                            <button
                                                onClick={handleDeliver}
                                                disabled={!canDeliver}
                                                className={`w-full rounded-[4px] py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${canDeliver ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                            >
                                                {canDeliver ? 'Deliver And Claim Reward' : `Collect ${contract.amount - available} More ${RESOURCE_LABEL[contract.resource]}`}
                                            </button>
                                            <button
                                                onClick={handleAbandon}
                                                className="w-full bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-200 rounded-[4px] py-1 text-[9px] font-black uppercase tracking-wider transition-colors"
                                            >
                                                Abandon: -{contract.penalty} AGT / -{trustPenalty} Trust
                                            </button>
                                        </div>
                                    )}
                                    {lifecycleState === 'readyToDeliver' && (
                                        <div className="space-y-1">
                                            <button
                                                onClick={handleDeliver}
                                                className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-[4px] py-2 text-[11px] font-black uppercase tracking-wider transition-colors animate-pulse"
                                            >
                                                Deliver Now: +{contract.reward.toLocaleString()} AGT / +{trustReward} Trust
                                            </button>
                                            <button
                                                onClick={handleAbandon}
                                                className="w-full bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-200 rounded-[4px] py-1 text-[9px] font-black uppercase tracking-wider transition-colors"
                                            >
                                                Abandon Contract
                                            </button>
                                        </div>
                                    )}
                                    {lifecycleState === 'completed' && (
                                        <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Paid: +{contract.reward.toLocaleString()} AGT / +{trustReward} Trust</div>
                                    )}
                                    {lifecycleState === 'failed' && (
                                        <div className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">Failed: -{contract.penalty} AGT / -{trustPenalty} Trust{contract.failureReason ? ` - ${contract.failureReason}` : ''}</div>
                                    )}
                                </div>
                            );
                        })}

                        {contractResult && !contractResult.ok && (
                            <div className="bg-rose-950/70 border border-rose-800 text-rose-200 rounded-[4px] px-2 py-1.5 text-[10px] font-bold">
                                {contractResult.reason || 'Contract action failed.'}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
