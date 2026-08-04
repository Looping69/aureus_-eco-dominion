import React from 'react';
import { ChevronDown } from 'lucide-react';

export type FPSAbility = 'SCAN' | 'HARVEST' | 'RESTORE' | 'DIG' | 'MOVE';

export const FPSAbilityHUD: React.FC<{ message: string | null; onAbility: (ability: FPSAbility) => void }> = ({ message, onAbility }) => {
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const abilities: Array<{ key: string; label: string; ability: FPSAbility }> = [
        { key: 'Q', label: 'Scan', ability: 'SCAN' },
        { key: 'E', label: 'Harvest', ability: 'HARVEST' },
        { key: 'R', label: 'Restore', ability: 'RESTORE' },
        { key: 'F', label: 'Dig', ability: 'DIG' },
        { key: 'G', label: 'Move Order', ability: 'MOVE' },
    ];

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto w-[min(46rem,calc(100vw-1rem))]">
            <div className="bg-slate-950/86 border-2 border-slate-700 rounded-[6px] shadow-[4px_4px_0_rgba(0,0,0,0.45)] backdrop-blur-md px-3 py-2">
                <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-controls="fps-ability-actions"
                    onClick={() => setIsCollapsed(value => !value)}
                    className="w-full flex items-center justify-between gap-3 rounded-[4px] px-1 py-1 text-left hover:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 transition-colors"
                    title={isCollapsed ? 'Expand FPS abilities' : 'Collapse FPS abilities'}
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <ChevronDown size={14} strokeWidth={3} className={`shrink-0 text-slate-500 transition-transform duration-300 ease-out ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-['Rajdhani']">Influence</span>
                        <span className="hidden font-mono text-[9px] font-bold uppercase text-emerald-300 sm:inline">{abilities.length} abilities</span>
                    </div>
                    <div className="min-w-0 text-right font-mono text-[9px] text-slate-500 truncate">
                        {message || 'LMB aim / RMB order'}
                    </div>
                </button>

                <div
                    id="fps-ability-actions"
                    className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${isCollapsed ? 'max-h-0 translate-y-1 opacity-0' : 'max-h-28 translate-y-0 opacity-100'}`}
                >
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        {abilities.map((item) => (
                            <button
                                key={item.ability}
                                type="button"
                                onClick={() => onAbility(item.ability)}
                                className="h-8 px-2.5 rounded-[4px] bg-slate-800 hover:bg-emerald-700 border border-slate-600 hover:border-emerald-400 text-slate-200 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors font-['Rajdhani']"
                            >
                                <span className="min-w-5 h-5 px-1 rounded-[3px] bg-black/45 border border-white/10 text-emerald-300 font-mono text-[10px] flex items-center justify-center">{item.key}</span>
                                {item.label}
                            </button>
                        ))}
                        <div className="text-[9px] font-mono text-slate-500 ml-1">LMB aim / RMB order</div>
                    </div>
                </div>

                {message && !isCollapsed && (
                    <div className="mt-2 text-center text-[11px] font-bold text-emerald-200 font-mono truncate">{message}</div>
                )}
            </div>
        </div>
    );
};
