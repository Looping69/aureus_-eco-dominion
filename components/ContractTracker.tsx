import React from 'react';
import { Briefcase, CheckCircle2, Clock, Package, XCircle } from 'lucide-react';
import { Contract, GameState, SfxType } from '../types';

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
    AVAILABLE: 'border-cyan-800 bg-cyan-950/40 text-cyan-200',
    ACCEPTED: 'border-amber-800 bg-amber-950/40 text-amber-200',
    COMPLETED: 'border-emerald-800 bg-emerald-950/40 text-emerald-200',
    FAILED: 'border-rose-800 bg-rose-950/40 text-rose-200',
};

const getStatusIcon = (status: string) => {
    if (status === 'COMPLETED') return <CheckCircle2 size={12} />;
    if (status === 'FAILED') return <XCircle size={12} />;
    if (status === 'ACCEPTED') return <Package size={12} />;
    return <Briefcase size={12} />;
};

const formatTime = (seconds: number) => {
    const clamped = Math.max(0, Math.ceil(seconds));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const queueContractCommand = (world: any, type: 'ACCEPT_CONTRACT' | 'DELIVER_CONTRACT', contractId: string) => {
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

    React.useEffect(() => {
        const timer = window.setInterval(() => forceRefresh(value => value + 1), 500);
        return () => window.clearInterval(timer);
    }, []);

    const liveState = world?.getState?.() || state;
    const contracts = (liveState.contracts || [])
        .filter(contract => (contract.status || 'AVAILABLE') !== 'FAILED' || contract.timeLeft > 0)
        .slice(0, 3);

    if (contracts.length === 0) return null;

    const lastResult = liveState.ui?.lastCommandResult;
    const contractResult = lastResult && ['ACCEPT_CONTRACT', 'DELIVER_CONTRACT'].includes(lastResult.type)
        ? lastResult
        : null;

    return (
        <div className="w-[21rem] max-w-[calc(100vw-1rem)] pointer-events-auto">
            <div className="bg-slate-950/88 backdrop-blur-md border border-slate-800 shadow-[4px_4px_0_rgba(0,0,0,0.35)] rounded-[6px] overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/80">
                    <div className="flex items-center gap-2">
                        <Briefcase size={15} className="text-amber-300" />
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-white">Contracts</div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Accept, deliver, get paid</div>
                        </div>
                    </div>
                    <div className="text-[9px] font-mono text-slate-500">{contracts.length}/3</div>
                </div>

                <div className="p-2 space-y-2">
                    {contracts.map(contract => {
                        const status = contract.status || 'AVAILABLE';
                        const resourceKey = RESOURCE_KEY[contract.resource];
                        const available = Math.floor(liveState.resources[resourceKey] || 0);
                        const progress = status === 'COMPLETED'
                            ? 1
                            : Math.min(1, available / Math.max(1, contract.amount));
                        const canDeliver = status === 'ACCEPTED' && available >= contract.amount;
                        const timeRatio = Math.min(1, contract.timeLeft / (status === 'AVAILABLE' ? 180 : 300));

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

                        return (
                            <div key={contract.id} className="bg-slate-900/90 border border-slate-800 rounded-[5px] p-2">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0">
                                        <div className={`inline-flex items-center gap-1 border rounded-[3px] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${STATUS_TONE[status] || STATUS_TONE.AVAILABLE}`}>
                                            {getStatusIcon(status)}
                                            {status}
                                        </div>
                                        <div className="mt-1 text-[10px] font-bold text-slate-200 leading-snug">
                                            {contract.amount} {RESOURCE_LABEL[contract.resource]} for +{contract.reward} AGT
                                        </div>
                                    </div>
                                    <div className={`flex items-center gap-1 text-[10px] font-mono shrink-0 ${contract.timeLeft < 30 && status === 'ACCEPTED' ? 'text-rose-300 animate-pulse' : 'text-slate-400'}`}>
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
                                    <div className={status === 'FAILED' ? 'h-full bg-rose-500' : 'h-full bg-amber-500'} style={{ width: `${timeRatio * 100}%` }} />
                                </div>

                                {status === 'AVAILABLE' && (
                                    <button
                                        onClick={handleAccept}
                                        className="w-full bg-cyan-700 hover:bg-cyan-600 text-white rounded-[4px] py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors"
                                    >
                                        Accept Contract
                                    </button>
                                )}
                                {status === 'ACCEPTED' && (
                                    <button
                                        onClick={handleDeliver}
                                        disabled={!canDeliver}
                                        className={`w-full rounded-[4px] py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${canDeliver ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                    >
                                        {canDeliver ? 'Deliver And Claim Reward' : `Collect ${contract.amount - available} More ${RESOURCE_LABEL[contract.resource]}`}
                                    </button>
                                )}
                                {status === 'COMPLETED' && (
                                    <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Paid and logged</div>
                                )}
                                {status === 'FAILED' && (
                                    <div className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">Failed and penalized</div>
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
            </div>
        </div>
    );
};