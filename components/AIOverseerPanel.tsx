import React from 'react';
import { Bot, Briefcase, Cpu, Eye, Maximize2, Minimize2, Play, Shield, TrendingUp, Zap } from 'lucide-react';
import { GameCommand, GameState, SfxType } from '../types';
import { NarrativePanel } from './NarrativePanel';
import {
    generateOverseerLocalInsight,
    generateOverseerPilotDirective,
    getOverseerLocalModelStatus,
    isExecutablePilotAction,
    OVERSEER_LOCAL_QWEN_CONFIG,
    type OverseerLocalInsight,
    type OverseerLocalModelStatus,
    validateOverseerPilotAction,
} from '../services/overseerLocalQwen';
import { getActiveGameDefinition } from '../game-definitions/activeGameDefinition';

type OverseerMode = 'OBSERVE' | 'CONTRACTS' | 'STABILITY' | 'GROWTH' | 'AUTOPILOT';
type OverseerPilotProvider = 'HEURISTIC' | 'LOCAL_QWEN';
type PilotQueueResult = { queued: boolean; reason?: string };

type OverseerState = {
    enabled?: boolean;
    mode?: OverseerMode;
    autoAct?: boolean;
    pilotProvider?: OverseerPilotProvider;
    confidence?: number;
    currentFocus?: string;
    recommendation?: string;
    lastAction?: string | null;
    actionLog?: Array<{ tick: number; label: string }>;
};

interface AIOverseerPanelProps {
    state: GameState;
    world: any;
    playSfx: (sfx: any) => void;
}

const COLLAPSE_STORAGE_KEY = 'aureus_ai_overseer_collapsed';
const QWEN_PILOT_INTERVAL_MS = 30000;

const MODES: Array<{ mode: OverseerMode; label: string; icon: React.ElementType; title: string }> = [
    { mode: 'OBSERVE', label: 'Watch', icon: Eye, title: 'Observe and explain without acting' },
    { mode: 'CONTRACTS', label: 'Cash', icon: Briefcase, title: 'Prioritize accepting and delivering safe contracts' },
    { mode: 'STABILITY', label: 'Stable', icon: Shield, title: 'Prioritize power, water, idle workers, and risk' },
    { mode: 'GROWTH', label: 'Grow', icon: TrendingUp, title: 'Push toward the next objective and cash loop' },
    { mode: 'AUTOPILOT', label: 'Pilot', icon: Bot, title: 'Local Qwen pilots the game through approved commands' },
];

const DEFAULT_OVERSEER: Required<Pick<OverseerState, 'enabled' | 'mode' | 'autoAct' | 'pilotProvider' | 'confidence' | 'currentFocus' | 'recommendation'>> = {
    enabled: true,
    mode: 'OBSERVE',
    autoAct: false,
    pilotProvider: 'HEURISTIC',
    confidence: 0.55,
    currentFocus: 'Reading the colony state',
    recommendation: 'Watching contracts, utilities, workforce, and progression before acting.',
};

function queueOverseerCommand(world: any, payload: Partial<OverseerState>): boolean {
    const gameState = world?.getState?.();
    if (!gameState?.commandQueue) return false;
    gameState.commandQueue.push({
        id: `ui_ai_overseer_${Date.now()}`,
        type: 'SET_AI_OVERSEER' as any,
        payload,
        issuedAtTick: gameState.tickCount,
    });
    return true;
}

function queuePilotGameCommand(world: any, insight: OverseerLocalInsight): PilotQueueResult {
    const gameState = world?.getState?.();
    const action = insight.action;
    if (!gameState?.commandQueue) return { queued: false, reason: 'Game command queue is not ready.' };
    if (!isExecutablePilotAction(action) || action.type === 'NONE') return { queued: false, reason: action?.reason || 'Qwen did not choose an executable action.' };
    const validation = validateOverseerPilotAction(action, gameState, getActiveGameDefinition());
    if (!validation.ok) return { queued: false, reason: validation.reason || 'Qwen action was rejected by the active game rules.' };
    gameState.commandQueue.push({
        id: `qwen_pilot_${Date.now()}_${action.type.toLowerCase()}`,
        type: action.type as GameCommand['type'],
        payload: action.payload || {},
        issuedAtTick: gameState.tickCount,
    });
    return { queued: true };
}

function readInitialCollapsed(): boolean {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) !== 'false';
}

function getQwenIndicator(status: OverseerLocalModelStatus, working: boolean, isPilot: boolean, autoAct: boolean, hasError: boolean) {
    if (hasError || status === 'error') {
        return { label: 'Qwen Error', detail: 'Local model needs attention.', dot: 'bg-rose-400', pill: 'border-rose-700 bg-rose-950/70 text-rose-200' };
    }
    if (working || status === 'loading') {
        return { label: 'Qwen Thinking', detail: 'Local model is loading or choosing a move.', dot: 'bg-amber-300 animate-pulse', pill: 'border-amber-700 bg-amber-950/70 text-amber-200' };
    }
    if (isPilot && autoAct) {
        return { label: 'Qwen Piloting', detail: 'Local model is active and will choose the next move.', dot: 'bg-emerald-300 animate-pulse', pill: 'border-emerald-700 bg-emerald-950/70 text-emerald-200' };
    }
    if (status === 'ready') {
        return { label: 'Qwen Ready', detail: 'Local model is loaded and ready.', dot: 'bg-cyan-300', pill: 'border-cyan-800 bg-cyan-950/70 text-cyan-200' };
    }
    return { label: 'Qwen Idle', detail: 'Local model has not started yet.', dot: 'bg-slate-500', pill: 'border-slate-700 bg-slate-950/70 text-slate-300' };
}

export const AIOverseerPanel: React.FC<AIOverseerPanelProps> = ({ state, world, playSfx }) => {
    const [, forceRefresh] = React.useState(0);
    const [collapsed, setCollapsed] = React.useState(readInitialCollapsed);
    const [qwenStatus, setQwenStatus] = React.useState<OverseerLocalModelStatus>(getOverseerLocalModelStatus);
    const [qwenWorking, setQwenWorking] = React.useState(false);
    const [qwenInsight, setQwenInsight] = React.useState<OverseerLocalInsight | null>(null);
    const [qwenError, setQwenError] = React.useState<string | null>(null);
    const [qwenPilotBlocked, setQwenPilotBlocked] = React.useState<string | null>(null);
    const qwenPilotBusyRef = React.useRef(false);
    const latestStateRef = React.useRef(state);
    const latestWorldRef = React.useRef(world);
    latestStateRef.current = state;
    latestWorldRef.current = world;
    const liveState = world?.getState?.() || state;
    const overseer = { ...DEFAULT_OVERSEER, ...((liveState as any).aiOverseer || {}) } as OverseerState & typeof DEFAULT_OVERSEER;
    const actionLog = Array.isArray(overseer.actionLog) ? overseer.actionLog.slice(0, 4) : [];
    const confidence = Math.round((overseer.confidence || 0) * 100);
    const isQwenPilot = overseer.mode === 'AUTOPILOT' && overseer.pilotProvider === 'LOCAL_QWEN';
    const qwenIndicator = getQwenIndicator(qwenStatus, qwenWorking, isQwenPilot, overseer.autoAct, Boolean(qwenError));

    React.useEffect(() => {
        const timer = window.setInterval(() => forceRefresh(value => value + 1), 1000);
        return () => window.clearInterval(timer);
    }, []);

    React.useEffect(() => {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? 'true' : 'false');
    }, [collapsed]);

    const send = (payload: Partial<OverseerState>) => {
        if (queueOverseerCommand(latestWorldRef.current, payload)) {
            playSfx(SfxType.UI_CLICK);
            window.setTimeout(() => forceRefresh(value => value + 1), 80);
        } else {
            playSfx(SfxType.ERROR);
        }
    };

    const selectMode = (mode: OverseerMode) => {
        send({
            enabled: true,
            mode,
            autoAct: mode === 'AUTOPILOT' ? overseer.autoAct : false,
            pilotProvider: mode === 'AUTOPILOT' ? 'LOCAL_QWEN' : 'HEURISTIC',
        });
    };

    const toggleAutoAct = () => {
        if (overseer.autoAct) {
            send({ enabled: true, autoAct: false });
            return;
        }
        send({
            enabled: true,
            mode: 'AUTOPILOT',
            autoAct: true,
            pilotProvider: 'LOCAL_QWEN',
        });
    };

    const runLocalQwen = React.useCallback(async (executePilotAction = false) => {
        if (qwenPilotBusyRef.current) return;
        qwenPilotBusyRef.current = true;
        setQwenWorking(true);
        setQwenError(null);
        setQwenPilotBlocked(null);
        setQwenStatus('loading');
        if (!executePilotAction) playSfx(SfxType.UI_CLICK);
        try {
            const currentWorld = latestWorldRef.current;
            const currentState = currentWorld?.getState?.() || latestStateRef.current;
            const insight = isQwenPilot
                ? await generateOverseerPilotDirective(currentState)
                : await generateOverseerLocalInsight(currentState);
            setQwenInsight(insight);
            setQwenStatus(getOverseerLocalModelStatus());
            if (executePilotAction) {
                const result = queuePilotGameCommand(currentWorld, insight);
                if (result.queued) {
                    playSfx(SfxType.UI_COIN);
                } else if (result.reason) {
                    setQwenPilotBlocked(result.reason);
                }
            }
        } catch (error) {
            setQwenInsight(null);
            setQwenStatus('error');
            setQwenError(error instanceof Error ? error.message : 'Local model failed to load.');
            playSfx(SfxType.ERROR);
        } finally {
            qwenPilotBusyRef.current = false;
            setQwenWorking(false);
        }
    }, [isQwenPilot, playSfx]);

    React.useEffect(() => {
        if (!isQwenPilot || !overseer.autoAct) return;
        void runLocalQwen(true);
        const timer = window.setInterval(() => void runLocalQwen(true), QWEN_PILOT_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [isQwenPilot, overseer.autoAct, runLocalQwen]);

    const toggleCollapsed = () => {
        setCollapsed(value => !value);
        playSfx(SfxType.UI_CLICK);
    };

    const overseerPanel = collapsed ? (
        <button
            onClick={toggleCollapsed}
            title={`AI Overseer: ${overseer.currentFocus}. ${qwenIndicator.label}`}
            aria-label="Expand AI Overseer"
            className={`relative pointer-events-auto w-11 h-11 rounded-[6px] border shadow-[3px_3px_0_rgba(0,0,0,0.35)] backdrop-blur-md flex items-center justify-center transition-colors ${overseer.autoAct ? 'bg-cyan-950/90 border-cyan-600 hover:bg-cyan-900/90' : 'bg-slate-950/88 border-slate-800 hover:bg-slate-900/90'}`}
        >
            <Bot size={20} className={overseer.autoAct ? 'text-cyan-300' : 'text-slate-300'} />
            <Maximize2 size={9} className="absolute top-1 right-1 text-slate-500" />
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${qwenIndicator.dot}`} />
            <span className="absolute -bottom-1 left-1 rounded bg-slate-950 px-1 text-[7px] font-black uppercase tracking-wider text-cyan-300 border border-cyan-900/70">
                {overseer.mode === 'AUTOPILOT' ? 'Pilot' : overseer.mode.slice(0, 4)}
            </span>
        </button>
    ) : (
        <div className="w-[22rem] max-w-[calc(100vw-1rem)] pointer-events-auto">
            <div className="bg-slate-950/88 backdrop-blur-md border border-cyan-900/70 shadow-[4px_4px_0_rgba(0,0,0,0.35)] rounded-[6px] overflow-hidden">
                <div className="w-full flex items-center justify-between gap-2 px-3 py-2 border-b border-cyan-950/80 bg-slate-900/80 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                        <Bot size={16} className={overseer.autoAct ? 'text-cyan-300' : 'text-slate-400'} />
                        <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-wider text-white">AI Overseer</div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-cyan-400/80 truncate">
                                {overseer.mode} / {isQwenPilot ? 'Local Qwen' : 'Advising'}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`h-6 px-2 rounded-[4px] border text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 ${qwenIndicator.pill}`} title={qwenIndicator.detail}>
                            <span className={`w-2 h-2 rounded-full ${qwenIndicator.dot}`} />
                            {qwenIndicator.label}
                        </div>
                        <div className="text-[9px] font-mono text-slate-500">{confidence}%</div>
                        <button
                            onClick={toggleCollapsed}
                            title="Collapse AI Overseer"
                            aria-label="Collapse AI Overseer"
                            className="w-7 h-7 rounded-[4px] border border-slate-700 bg-slate-950/80 text-slate-400 hover:text-white hover:border-cyan-700 flex items-center justify-center transition-colors"
                        >
                            <Minimize2 size={12} />
                        </button>
                    </div>
                </div>

                <div className="p-2 space-y-2">
                    <div className="grid grid-cols-5 gap-1">
                        {MODES.map(({ mode, label, icon: Icon, title }) => (
                            <button
                                key={mode}
                                onClick={() => selectMode(mode)}
                                title={title}
                                className={`h-8 rounded-[4px] border text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-colors ${overseer.mode === mode ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'}`}
                            >
                                <Icon size={11} />
                                {label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={toggleAutoAct}
                        className={`w-full h-8 rounded-[4px] border text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${overseer.autoAct ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-emerald-700'}`}
                    >
                        {overseer.autoAct ? <Zap size={13} /> : <Play size={13} />}
                        {overseer.autoAct ? 'Qwen Pilot Enabled' : 'Enable Qwen Auto Act'}
                    </button>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-[5px] p-2">
                        <div className="text-[9px] font-black uppercase tracking-wider text-cyan-300 mb-1">Focus</div>
                        <div className="text-[11px] font-bold text-white leading-snug">{overseer.currentFocus}</div>
                        <div className="mt-1.5 text-[10px] font-semibold text-slate-300 leading-snug">{overseer.recommendation}</div>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-[5px] p-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="text-[9px] font-black uppercase tracking-wider text-violet-300 truncate">Local Qwen</div>
                                <div className="text-[8px] font-bold uppercase tracking-wider text-slate-500 truncate">{OVERSEER_LOCAL_QWEN_CONFIG.displayName}</div>
                            </div>
                            <button
                                onClick={() => void runLocalQwen(false)}
                                disabled={qwenStatus === 'loading' || qwenWorking}
                                title={isQwenPilot ? 'Ask Local Qwen for its next pilot move' : 'Ask local Qwen for an overseer recommendation'}
                                className="h-7 px-2 rounded-[4px] border border-violet-800 bg-violet-950/70 text-violet-200 hover:border-violet-500 hover:text-white disabled:opacity-60 disabled:cursor-wait text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                            >
                                <Cpu size={11} />
                                {qwenStatus === 'loading' || qwenWorking ? 'Working' : isQwenPilot ? 'Move' : 'Ask'}
                            </button>
                        </div>
                        <div className={`rounded-[4px] border px-2 py-1 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 ${qwenIndicator.pill}`}>
                            <span className={`w-2 h-2 rounded-full ${qwenIndicator.dot}`} />
                            <span>{qwenIndicator.label}</span>
                            <span className="normal-case tracking-normal font-semibold opacity-80 truncate">{qwenIndicator.detail}</span>
                        </div>
                        {qwenInsight && (
                            <div className="text-[10px] font-semibold text-slate-300 leading-snug">
                                <span className="text-violet-200 font-black">{qwenInsight.focus}</span>
                                <span className="block mt-1">{qwenInsight.recommendation}</span>
                                {qwenInsight.action && qwenInsight.action.type !== 'NONE' && (
                                    <span className="block mt-1 text-[8px] font-mono uppercase tracking-wider text-emerald-300">Next: {qwenInsight.action.type}</span>
                                )}
                                <span className="block mt-1 text-[8px] font-mono uppercase tracking-wider text-slate-500">{qwenInsight.device} / local browser model</span>
                            </div>
                        )}
                        {qwenPilotBlocked && (
                            <div className="rounded-[4px] border border-amber-800 bg-amber-950/50 px-2 py-1 text-[9px] font-bold text-amber-200 leading-snug">
                                Pilot action blocked: {qwenPilotBlocked}
                            </div>
                        )}
                        {!qwenInsight && !qwenError && (
                            <div className="text-[10px] font-semibold text-slate-500 leading-snug">{isQwenPilot ? 'Pilot mode is ready for Local Qwen.' : 'Ready for an on-device recommendation.'}</div>
                        )}
                        {qwenError && <div className="text-[10px] font-bold text-rose-300 leading-snug">{qwenError}</div>}
                    </div>

                    {actionLog.length > 0 && (
                        <div className="space-y-1">
                            {actionLog.map((entry, index) => (
                                <div key={`${entry.tick}_${index}`} className="text-[9px] font-mono text-slate-400 bg-slate-950/70 border border-slate-800 rounded px-2 py-1 truncate">
                                    T{entry.tick}: {entry.label}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            <NarrativePanel state={liveState} playSfx={playSfx} />
            {overseerPanel}
        </>
    );
};
