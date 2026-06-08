import React from 'react';
import { Bot, Briefcase, Eye, Maximize2, Minimize2, Play, Shield, TrendingUp, Zap } from 'lucide-react';
import { GameState, SfxType } from '../types';

type OverseerMode = 'OBSERVE' | 'CONTRACTS' | 'STABILITY' | 'GROWTH' | 'AUTOPILOT';

type OverseerState = {
    enabled?: boolean;
    mode?: OverseerMode;
    autoAct?: boolean;
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

const MODES: Array<{ mode: OverseerMode; label: string; icon: React.ElementType; title: string }> = [
    { mode: 'OBSERVE', label: 'Watch', icon: Eye, title: 'Observe and explain without acting' },
    { mode: 'CONTRACTS', label: 'Cash', icon: Briefcase, title: 'Prioritize accepting and delivering safe contracts' },
    { mode: 'STABILITY', label: 'Stable', icon: Shield, title: 'Prioritize power, water, idle workers, and risk' },
    { mode: 'GROWTH', label: 'Grow', icon: TrendingUp, title: 'Push toward the next objective and cash loop' },
    { mode: 'AUTOPILOT', label: 'Pilot', icon: Bot, title: 'Autonomously support the full game through real game commands' },
];

const DEFAULT_OVERSEER: Required<Pick<OverseerState, 'enabled' | 'mode' | 'autoAct' | 'confidence' | 'currentFocus' | 'recommendation'>> = {
    enabled: true,
    mode: 'OBSERVE',
    autoAct: false,
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

function readInitialCollapsed(): boolean {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) !== 'false';
}

export const AIOverseerPanel: React.FC<AIOverseerPanelProps> = ({ state, world, playSfx }) => {
    const [, forceRefresh] = React.useState(0);
    const [collapsed, setCollapsed] = React.useState(readInitialCollapsed);
    const liveState = world?.getState?.() || state;
    const overseer = { ...DEFAULT_OVERSEER, ...((liveState as any).aiOverseer || {}) } as OverseerState & typeof DEFAULT_OVERSEER;
    const actionLog = Array.isArray(overseer.actionLog) ? overseer.actionLog.slice(0, 4) : [];
    const confidence = Math.round((overseer.confidence || 0) * 100);

    React.useEffect(() => {
        const timer = window.setInterval(() => forceRefresh(value => value + 1), 1000);
        return () => window.clearInterval(timer);
    }, []);

    React.useEffect(() => {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? 'true' : 'false');
    }, [collapsed]);

    const send = (payload: Partial<OverseerState>) => {
        if (queueOverseerCommand(world, payload)) {
            playSfx(SfxType.UI_CLICK);
            window.setTimeout(() => forceRefresh(value => value + 1), 80);
        } else {
            playSfx(SfxType.ERROR);
        }
    };

    const toggleCollapsed = () => {
        setCollapsed(value => !value);
        playSfx(SfxType.UI_CLICK);
    };

    if (collapsed) {
        return (
            <button
                onClick={toggleCollapsed}
                title={`AI Overseer: ${overseer.currentFocus}`}
                aria-label="Expand AI Overseer"
                className={`relative pointer-events-auto w-11 h-11 rounded-[6px] border shadow-[3px_3px_0_rgba(0,0,0,0.35)] backdrop-blur-md flex items-center justify-center transition-colors ${overseer.autoAct ? 'bg-cyan-950/90 border-cyan-600 hover:bg-cyan-900/90' : 'bg-slate-950/88 border-slate-800 hover:bg-slate-900/90'}`}
            >
                <Bot size={20} className={overseer.autoAct ? 'text-cyan-300' : 'text-slate-300'} />
                <Maximize2 size={9} className="absolute top-1 right-1 text-slate-500" />
                {overseer.autoAct && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-950 animate-pulse" />}
                <span className="absolute -bottom-1 left-1 rounded bg-slate-950 px-1 text-[7px] font-black uppercase tracking-wider text-cyan-300 border border-cyan-900/70">
                    {overseer.mode === 'AUTOPILOT' ? 'Pilot' : overseer.mode.slice(0, 4)}
                </span>
            </button>
        );
    }

    return (
        <div className="w-[22rem] max-w-[calc(100vw-1rem)] pointer-events-auto">
            <div className="bg-slate-950/88 backdrop-blur-md border border-cyan-900/70 shadow-[4px_4px_0_rgba(0,0,0,0.35)] rounded-[6px] overflow-hidden">
                <div className="w-full flex items-center justify-between gap-2 px-3 py-2 border-b border-cyan-950/80 bg-slate-900/80 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                        <Bot size={16} className={overseer.autoAct ? 'text-cyan-300' : 'text-slate-400'} />
                        <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-wider text-white">AI Overseer</div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-cyan-400/80 truncate">
                                {overseer.mode} / {overseer.autoAct ? 'Auto acting' : 'Advising'}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                                onClick={() => send({ enabled: true, mode })}
                                title={title}
                                className={`h-8 rounded-[4px] border text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-colors ${overseer.mode === mode ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'}`}
                            >
                                <Icon size={11} />
                                {label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => send({ enabled: true, autoAct: !overseer.autoAct })}
                        className={`w-full h-8 rounded-[4px] border text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${overseer.autoAct ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-emerald-700'}`}
                    >
                        {overseer.autoAct ? <Zap size={13} /> : <Play size={13} />}
                        {overseer.autoAct ? 'Auto Act Enabled' : 'Advise Only'}
                    </button>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-[5px] p-2">
                        <div className="text-[9px] font-black uppercase tracking-wider text-cyan-300 mb-1">Focus</div>
                        <div className="text-[11px] font-bold text-white leading-snug">{overseer.currentFocus}</div>
                        <div className="mt-1.5 text-[10px] font-semibold text-slate-300 leading-snug">{overseer.recommendation}</div>
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
};
