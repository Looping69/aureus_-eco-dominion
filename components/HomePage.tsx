import React, { useState, useEffect } from 'react';
import { Play, Leaf, Mountain, Users, Hexagon, Volume2, VolumeX, Info, Terminal, Radio, Shield, Zap, Factory, Satellite, Gauge } from 'lucide-react';

interface HomePageProps {
    onStartGame: () => void;
    onStartDemo: () => void;
    onContinueGame: () => void;
    hasSave: boolean;
}

const systemReadouts = [
    { label: 'Grid', value: 'Surging', icon: Zap, color: 'text-emerald-300' },
    { label: 'Perimeter', value: 'Armed', icon: Shield, color: 'text-amber-300' },
    { label: 'Factory', value: 'Primed', icon: Factory, color: 'text-cyan-300' },
];

const colonyNodes = [
    { label: 'Minehead', className: 'left-[17%] top-[49%]', pulse: 'bg-amber-300' },
    { label: 'Hab Ring', className: 'left-[44%] top-[35%]', pulse: 'bg-emerald-300' },
    { label: 'Command', className: 'left-[61%] top-[57%]', pulse: 'bg-cyan-300' },
    { label: 'Perimeter', className: 'left-[78%] top-[42%]', pulse: 'bg-rose-300' },
];

const missionPillars = [
    { label: 'Industry', detail: 'Build extraction grids', icon: Mountain, color: 'text-amber-300' },
    { label: 'Ecology', detail: 'Heal the living map', icon: Leaf, color: 'text-emerald-300' },
    { label: 'Colony', detail: 'Keep people alive', icon: Users, color: 'text-cyan-300' },
];

export const HomePage: React.FC<HomePageProps> = ({ onStartGame, onStartDemo, onContinueGame, hasSave }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                event.preventDefault();
                onStartGame();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onStartGame]);

    return (
        <div className="relative h-full overflow-hidden font-['Rajdhani'] selection:bg-amber-400 selection:text-black bg-[#050709] text-white">
            <style>{`
                @keyframes aureus-scan { 0% { transform: translateX(-18%) rotate(-7deg); opacity: 0; } 18% { opacity: .75; } 70% { opacity: .28; } 100% { transform: translateX(118%) rotate(-7deg); opacity: 0; } }
                @keyframes aureus-drift { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(0, -14px, 0); } }
                @keyframes aureus-pulse { 0%, 100% { opacity: .42; transform: scale(.92); } 50% { opacity: 1; transform: scale(1.08); } }
                @keyframes aureus-runner { 0% { transform: translateX(-12%); opacity: 0; } 12% { opacity: .9; } 82% { opacity: .55; } 100% { transform: translateX(112%); opacity: 0; } }
                @keyframes aureus-flicker { 0%, 100% { opacity: .78; } 45% { opacity: .25; } 52% { opacity: 1; } 67% { opacity: .45; } }
            `}</style>

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(245,158,11,0.28),transparent_28%),radial-gradient(circle_at_76%_12%,rgba(34,211,238,0.22),transparent_25%),radial-gradient(circle_at_58%_72%,rgba(16,185,129,0.24),transparent_30%),linear-gradient(135deg,#06080b_0%,#111827_46%,#05070a_100%)]" />
            <div className="absolute inset-0 opacity-[0.16] bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:42px_42px]" />
            <div className="absolute -inset-y-16 left-[-20%] w-1/2 bg-gradient-to-r from-transparent via-emerald-300/18 to-transparent blur-sm" style={{ animation: 'aureus-scan 7s ease-in-out infinite' }} />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/70 to-transparent" />

            <div className={`relative z-10 flex h-full flex-col px-5 py-4 sm:px-8 sm:py-6 transition-all duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                <header className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center border border-amber-300/60 bg-black/45 shadow-[0_0_32px_rgba(245,158,11,0.24)]">
                            <Hexagon size={25} className="text-amber-300 fill-amber-300/15" />
                            <span className="absolute inset-[-6px] border border-emerald-300/20" style={{ animation: 'aureus-pulse 2.8s ease-in-out infinite' }} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase text-emerald-200/70">Sector-7 // live colony command</div>
                            <div className="text-xl font-black uppercase leading-none text-white sm:text-2xl">Aureus Command</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsMuted(!isMuted)}
                            className="grid h-10 w-10 place-items-center border border-white/15 bg-black/35 text-white/70 transition hover:border-emerald-300/60 hover:text-white active:scale-95"
                            title={isMuted ? 'Unmute command ambience' : 'Mute command ambience'}
                        >
                            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                        <button
                            type="button"
                            className="hidden h-10 items-center gap-2 border border-white/15 bg-black/35 px-4 text-[10px] font-black uppercase text-white/70 transition hover:border-amber-300/60 hover:text-white sm:flex"
                            title="Aureus mission briefing"
                        >
                            <Info size={16} /> Briefing
                        </button>
                    </div>
                </header>

                <main className="grid min-h-0 flex-1 items-center gap-5 py-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(25rem,1.08fr)] lg:py-0">
                    <section className={`max-w-3xl transition-all duration-700 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase text-white/70">
                            <span className="border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-emerald-200">Engine online</span>
                            <span className="border border-amber-300/35 bg-amber-300/10 px-3 py-1 text-amber-200">Eco Dominion</span>
                            <span className="border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 text-cyan-100">Combat ready</span>
                        </div>

                        <h1 className="max-w-[11ch] text-6xl font-black uppercase leading-[0.78] tracking-normal text-white sm:text-8xl lg:text-[8.4rem]" style={{ textShadow: '0 10px 36px rgba(0,0,0,.85), 0 0 38px rgba(16,185,129,.2)' }}>
                            AUREUS
                        </h1>
                        <p className="mt-4 max-w-xl text-lg font-black uppercase leading-tight text-white/86 sm:text-2xl">
                            Build the colony. Arm the perimeter. Bend the wild planet without breaking it.
                        </p>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                            {hasSave && (
                                <button
                                    type="button"
                                    onClick={onContinueGame}
                                    className="group flex min-h-16 items-center gap-4 border border-cyan-300/50 bg-cyan-300/12 px-5 py-3 text-left shadow-[0_0_28px_rgba(34,211,238,0.16)] transition hover:-translate-y-0.5 hover:bg-cyan-300/18 active:translate-y-0"
                                >
                                    <Terminal size={25} className="text-cyan-200" />
                                    <span>
                                        <span className="block text-2xl font-black uppercase leading-none text-white">Continue</span>
                                        <span className="block text-[10px] font-black uppercase text-cyan-100/70">Restore session</span>
                                    </span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={onStartGame}
                                className="group relative flex min-h-16 items-center gap-4 overflow-hidden bg-emerald-300 px-6 py-3 text-left text-black shadow-[0_0_36px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5 hover:bg-emerald-200 active:translate-y-0"
                            >
                                <span className="absolute inset-y-0 left-0 w-16 bg-white/35" style={{ animation: 'aureus-runner 2.8s ease-in-out infinite' }} />
                                <Play size={30} className="relative fill-black/70 text-black/80" />
                                <span className="relative">
                                    <span className="block text-3xl font-black uppercase leading-none sm:text-4xl">Initialize</span>
                                    <span className="block text-[10px] font-black uppercase text-black/60">New dominion run</span>
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={onStartDemo}
                                className="group flex min-h-16 items-center gap-3 border border-amber-300/60 bg-amber-300/16 px-5 py-3 text-left transition hover:-translate-y-0.5 hover:bg-amber-300/25 active:translate-y-0"
                            >
                                <Radio size={23} className="text-amber-200" style={{ animation: 'aureus-flicker 1.8s linear infinite' }} />
                                <span>
                                    <span className="block text-xl font-black uppercase leading-none text-white">Guided demo</span>
                                    <span className="block text-[10px] font-black uppercase text-amber-100/70">Five-minute ignition</span>
                                </span>
                            </button>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-black uppercase text-white/45">
                            <span>Space starts a new mission</span>
                            <span>Mouse over the world for live intel</span>
                            <span>Qwen pilot ready</span>
                        </div>
                    </section>

                    <section className={`relative min-h-[20rem] overflow-hidden border-y border-white/10 py-5 transition-all delay-150 duration-700 sm:min-h-[25rem] lg:min-h-[31rem] lg:border-y-0 lg:border-l lg:pl-8 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(16,185,129,0.20),transparent_34%)]" />
                        <div className="relative mx-auto h-[19rem] max-w-[40rem] sm:h-[24rem] lg:h-[29rem]" style={{ animation: 'aureus-drift 8s ease-in-out infinite' }}>
                            <div className="absolute left-[8%] top-[30%] h-[46%] w-[78%] -skew-y-6 rotate-[-7deg] border border-emerald-300/20 bg-emerald-950/30 shadow-[0_40px_80px_rgba(0,0,0,0.45)]" />
                            <div className="absolute left-[16%] top-[50%] h-[18%] w-[24%] -skew-y-6 rotate-[-7deg] bg-amber-500/25 shadow-[0_0_30px_rgba(245,158,11,0.25)]" />
                            <div className="absolute left-[38%] top-[37%] h-[26%] w-[28%] -skew-y-6 rotate-[-7deg] bg-emerald-400/20 shadow-[0_0_35px_rgba(16,185,129,0.3)]" />
                            <div className="absolute left-[61%] top-[49%] h-[20%] w-[22%] -skew-y-6 rotate-[-7deg] bg-cyan-400/18 shadow-[0_0_34px_rgba(34,211,238,0.25)]" />

                            <div className="absolute left-[30%] top-[22%] h-[42%] w-[1px] rotate-[22deg] bg-amber-200/35" />
                            <div className="absolute left-[55%] top-[28%] h-[46%] w-[1px] rotate-[62deg] bg-emerald-200/30" />
                            <div className="absolute left-[70%] top-[31%] h-[38%] w-[1px] rotate-[-24deg] bg-cyan-200/28" />

                            {colonyNodes.map((node) => (
                                <div key={node.label} className={`absolute ${node.className}`}>
                                    <span className={`absolute -left-2 -top-2 h-4 w-4 rounded-full ${node.pulse} blur-[1px]`} style={{ animation: 'aureus-pulse 1.9s ease-in-out infinite' }} />
                                    <span className="absolute left-3 top-2 whitespace-nowrap text-[9px] font-black uppercase text-white/60">{node.label}</span>
                                    <span className="block h-10 w-10 -skew-y-6 rotate-[-7deg] border border-white/18 bg-black/55 shadow-[0_0_28px_rgba(255,255,255,0.12)]" />
                                </div>
                            ))}

                            <div className="absolute left-[24%] top-[67%] h-2 w-[58%] overflow-hidden bg-black/45">
                                <span className="block h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-200 to-transparent" style={{ animation: 'aureus-runner 3.4s linear infinite' }} />
                            </div>
                            <div className="absolute right-[12%] top-[15%] flex items-center gap-2 text-[10px] font-black uppercase text-cyan-100/70">
                                <Satellite size={16} /> orbital survey linked
                            </div>
                            <div className="absolute bottom-[8%] left-[8%] flex items-center gap-2 text-[10px] font-black uppercase text-amber-100/70">
                                <Gauge size={16} /> sim pressure rising
                            </div>
                        </div>

                        <div className="relative grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
                            {systemReadouts.map(({ label, value, icon: Icon, color }) => (
                                <div key={label} className="min-w-0">
                                    <div className={`mb-1 flex items-center gap-1 ${color}`}><Icon size={14} /><span className="text-[10px] font-black uppercase">{label}</span></div>
                                    <div className="truncate text-sm font-black uppercase text-white sm:text-lg">{value}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>

                <footer className="grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-3">
                    {missionPillars.map(({ label, detail, icon: Icon, color }) => (
                        <div key={label} className="flex items-center gap-3 min-w-0">
                            <Icon size={22} className={`${color} shrink-0`} />
                            <div className="min-w-0">
                                <div className="text-sm font-black uppercase leading-none text-white">{label}</div>
                                <div className="truncate text-[10px] font-black uppercase text-white/45">{detail}</div>
                            </div>
                        </div>
                    ))}
                </footer>
            </div>
        </div>
    );
};
