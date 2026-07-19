import React, { useState, useEffect } from 'react';
import { Play, Leaf, Mountain, Users, Hexagon, Volume2, VolumeX, Info, Terminal, Radio, Shield, Zap, Factory, Satellite, Gauge, Crosshair, Orbit, Cpu } from 'lucide-react';

interface HomePageProps {
    onStartGame: () => void;
    onStartDemo: () => void;
    onContinueGame: () => void;
    hasSave: boolean;
}

const systemReadouts = [
    { label: 'Grid', value: 'Awake', icon: Zap, color: 'text-emerald-300' },
    { label: 'Perimeter', value: 'Tracking', icon: Shield, color: 'text-amber-300' },
    { label: 'Factory', value: 'Hot', icon: Factory, color: 'text-cyan-300' },
];

const colonyNodes = [
    { label: 'Minehead', className: 'left-[15%] top-[56%]', pulse: 'bg-amber-300', delay: '0s' },
    { label: 'Hab Ring', className: 'left-[38%] top-[39%]', pulse: 'bg-emerald-300', delay: '.45s' },
    { label: 'Command', className: 'left-[58%] top-[58%]', pulse: 'bg-cyan-300', delay: '.9s' },
    { label: 'Fence Line', className: 'left-[77%] top-[44%]', pulse: 'bg-rose-300', delay: '1.25s' },
];

const missionPillars = [
    { label: 'Industry', detail: 'Build extraction grids', icon: Mountain, color: 'text-amber-300' },
    { label: 'Ecology', detail: 'Heal the living map', icon: Leaf, color: 'text-emerald-300' },
    { label: 'Colony', detail: 'Command workers and defenses', icon: Users, color: 'text-cyan-300' },
];

const descentFrames = ['ORBITAL SCAN', 'ATMOSPHERE ENTRY', 'TERRAIN LOCK', 'COLONY LINK'];

export const HomePage: React.FC<HomePageProps> = ({ onStartGame, onStartDemo, onContinueGame, hasSave }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [descentFrame, setDescentFrame] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => setDescentFrame((frame) => (frame + 1) % descentFrames.length), 1800);
        return () => window.clearInterval(timer);
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
        <div className="relative h-full overflow-hidden font-['Rajdhani'] selection:bg-emerald-300 selection:text-black bg-[#030607] text-white">
            <style>{`
                @keyframes aureus-scan { 0% { transform: translateX(-20%) rotate(-8deg); opacity: 0; } 18% { opacity: .78; } 70% { opacity: .32; } 100% { transform: translateX(120%) rotate(-8deg); opacity: 0; } }
                @keyframes aureus-drift { 0%, 100% { transform: translate3d(0, 0, 0) scale(1); } 50% { transform: translate3d(0, -12px, 0) scale(1.012); } }
                @keyframes aureus-pulse { 0%, 100% { opacity: .42; transform: scale(.9); } 50% { opacity: 1; transform: scale(1.12); } }
                @keyframes aureus-runner { 0% { transform: translateX(-18%); opacity: 0; } 12% { opacity: .95; } 82% { opacity: .55; } 100% { transform: translateX(116%); opacity: 0; } }
                @keyframes aureus-flicker { 0%, 100% { opacity: .78; } 45% { opacity: .24; } 52% { opacity: 1; } 67% { opacity: .45; } }
                @keyframes aureus-drop { 0% { transform: translate3d(0,-42px,0) scale(.72) rotateX(62deg) rotateZ(-10deg); filter: blur(2px); opacity: .44; } 42% { filter: blur(.8px); opacity: .88; } 100% { transform: translate3d(0,18px,0) scale(1.08) rotateX(58deg) rotateZ(-10deg); filter: blur(0); opacity: 1; } }
                @keyframes aureus-cloud { 0% { transform: translate3d(-18%,0,0); opacity: 0; } 18% { opacity: .3; } 72% { opacity: .16; } 100% { transform: translate3d(24%,0,0); opacity: 0; } }
                @keyframes aureus-orbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes aureus-agent-a { 0% { transform: translate3d(0,0,0); } 45% { transform: translate3d(150px,-42px,0); } 100% { transform: translate3d(310px,-12px,0); } }
                @keyframes aureus-agent-b { 0% { transform: translate3d(0,0,0); } 48% { transform: translate3d(92px,38px,0); } 100% { transform: translate3d(180px,76px,0); } }
                @media (prefers-reduced-motion: reduce) { .aureus-motion { animation: none !important; transition: none !important; } }
            `}</style>

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(16,185,129,0.24),transparent_29%),radial-gradient(circle_at_82%_14%,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_62%_72%,rgba(245,158,11,0.20),transparent_30%),linear-gradient(135deg,#030607_0%,#0b1117_46%,#030405_100%)]" />
            <div className="absolute inset-0 opacity-[0.13] bg-[linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:40px_40px]" />
            <div className="aureus-motion absolute -inset-y-16 left-[-20%] w-1/2 bg-gradient-to-r from-transparent via-emerald-300/18 to-transparent blur-sm" style={{ animation: 'aureus-scan 6.6s ease-in-out infinite' }} />
            <div className="aureus-motion absolute left-0 top-[18%] h-24 w-full bg-gradient-to-r from-transparent via-white/10 to-transparent blur-xl" style={{ animation: 'aureus-cloud 9s ease-in-out infinite' }} />
            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/72 to-transparent" />

            <div className={`relative z-10 flex h-full flex-col px-5 py-4 sm:px-8 sm:py-6 transition-all duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                <header className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center border border-emerald-300/65 bg-black/45 shadow-[0_0_34px_rgba(16,185,129,0.28)]">
                            <Hexagon size={25} className="text-emerald-300 fill-emerald-300/15" />
                            <span className="aureus-motion absolute inset-[-6px] border border-amber-300/25" style={{ animation: 'aureus-pulse 2.8s ease-in-out infinite' }} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase text-emerald-200/70">Live descent // colony command link</div>
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

                <main className="grid min-h-0 flex-1 items-center gap-5 py-4 lg:grid-cols-[minmax(0,0.86fr)_minmax(26rem,1.14fr)] lg:py-0">
                    <section className={`max-w-3xl transition-all duration-700 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase text-white/70">
                            <span className="border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-emerald-200">Engine online</span>
                            <span className="border border-amber-300/35 bg-amber-300/10 px-3 py-1 text-amber-200">Drop sequence armed</span>
                            <span className="border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 text-cyan-100">Qwen pilot ready</span>
                        </div>

                        <h1 className="max-w-[11ch] text-6xl font-black uppercase leading-[0.78] tracking-normal text-white sm:text-8xl lg:text-[8.6rem]" style={{ textShadow: '0 10px 36px rgba(0,0,0,.88), 0 0 38px rgba(16,185,129,.22)' }}>
                            AUREUS
                        </h1>
                        <p className="mt-4 max-w-xl text-lg font-black uppercase leading-tight text-white/86 sm:text-2xl">
                            Drop into a living colony sim where every tile, worker, weapon, and perimeter line is part of the machine.
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
                                className="group relative flex min-h-16 items-center gap-4 overflow-hidden bg-emerald-300 px-6 py-3 text-left text-black shadow-[0_0_38px_rgba(16,185,129,0.38)] transition hover:-translate-y-0.5 hover:bg-emerald-200 active:translate-y-0"
                            >
                                <span className="aureus-motion absolute inset-y-0 left-0 w-16 bg-white/35" style={{ animation: 'aureus-runner 2.8s ease-in-out infinite' }} />
                                <Play size={30} className="relative fill-black/70 text-black/80" />
                                <span className="relative">
                                    <span className="block text-3xl font-black uppercase leading-none sm:text-4xl">Drop In</span>
                                    <span className="block text-[10px] font-black uppercase text-black/60">New dominion run</span>
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={onStartDemo}
                                className="group flex min-h-16 items-center gap-3 border border-amber-300/60 bg-amber-300/16 px-5 py-3 text-left transition hover:-translate-y-0.5 hover:bg-amber-300/25 active:translate-y-0"
                            >
                                <Radio size={23} className="aureus-motion text-amber-200" style={{ animation: 'aureus-flicker 1.8s linear infinite' }} />
                                <span>
                                    <span className="block text-xl font-black uppercase leading-none text-white">Guided demo</span>
                                    <span className="block text-[10px] font-black uppercase text-amber-100/70">Five-minute ignition</span>
                                </span>
                            </button>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-black uppercase text-white/45">
                            <span>Space starts a new mission</span>
                            <span>Hover the world for live intel</span>
                            <span>Combat stance system online</span>
                        </div>
                    </section>

                    <section className={`relative min-h-[21rem] overflow-hidden border-y border-white/10 py-5 transition-all delay-150 duration-700 sm:min-h-[27rem] lg:min-h-[34rem] lg:border-y-0 lg:border-l lg:pl-8 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(16,185,129,0.20),transparent_34%)]" />
                        <div className="relative mx-auto h-[20rem] max-w-[42rem] sm:h-[26rem] lg:h-[32rem]">
                            <div className="absolute left-[4%] top-[3%] flex items-center gap-2 text-[10px] font-black uppercase text-cyan-100/70">
                                <Satellite size={16} /> {descentFrames[descentFrame]}
                            </div>
                            <div className="absolute right-[6%] top-[7%] h-24 w-24 rounded-full border border-cyan-200/20">
                                <span className="aureus-motion absolute inset-2 rounded-full border border-emerald-300/25" style={{ animation: 'aureus-orbit 7s linear infinite' }} />
                                <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(34,211,238,.85)]" />
                            </div>

                            <div className="aureus-motion absolute inset-x-[8%] bottom-[5%] top-[12%]" style={{ animation: 'aureus-drop 5.8s cubic-bezier(.18,.72,.2,1) infinite alternate' }}>
                                <div className="absolute left-[8%] top-[30%] h-[48%] w-[80%] -skew-y-6 rotate-[-7deg] overflow-hidden border border-emerald-300/20 bg-emerald-950/30 shadow-[0_46px_92px_rgba(0,0,0,0.48)]">
                                    <div className="absolute inset-0 opacity-[0.35] bg-[linear-gradient(90deg,rgba(16,185,129,.28)_1px,transparent_1px),linear-gradient(rgba(245,158,11,.18)_1px,transparent_1px)] bg-[size:13%_22%]" />
                                    <div className="absolute left-[5%] top-[52%] h-[25%] w-[32%] bg-amber-500/28 shadow-[0_0_32px_rgba(245,158,11,0.25)]" />
                                    <div className="absolute left-[35%] top-[26%] h-[32%] w-[31%] bg-emerald-400/21 shadow-[0_0_35px_rgba(16,185,129,0.3)]" />
                                    <div className="absolute left-[62%] top-[45%] h-[28%] w-[28%] bg-cyan-400/18 shadow-[0_0_34px_rgba(34,211,238,0.25)]" />
                                    <div className="absolute left-[72%] top-[28%] h-[38%] w-[5%] bg-rose-300/22 shadow-[0_0_28px_rgba(251,113,133,0.26)]" />
                                </div>

                                <div className="absolute left-[30%] top-[22%] h-[44%] w-[1px] rotate-[22deg] bg-amber-200/35" />
                                <div className="absolute left-[55%] top-[28%] h-[48%] w-[1px] rotate-[62deg] bg-emerald-200/30" />
                                <div className="absolute left-[70%] top-[31%] h-[40%] w-[1px] rotate-[-24deg] bg-cyan-200/28" />

                                {colonyNodes.map((node) => (
                                    <div key={node.label} className={`absolute ${node.className}`}>
                                        <span className={`aureus-motion absolute -left-2 -top-2 h-4 w-4 rounded-full ${node.pulse} blur-[1px]`} style={{ animation: 'aureus-pulse 1.9s ease-in-out infinite', animationDelay: node.delay }} />
                                        <span className="absolute left-3 top-2 whitespace-nowrap text-[9px] font-black uppercase text-white/64">{node.label}</span>
                                        <span className="block h-10 w-10 -skew-y-6 rotate-[-7deg] border border-white/18 bg-black/58 shadow-[0_0_28px_rgba(255,255,255,0.12)]" />
                                    </div>
                                ))}

                                <div className="absolute left-[24%] top-[68%] h-2 w-[58%] overflow-hidden bg-black/45">
                                    <span className="aureus-motion block h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-200 to-transparent" style={{ animation: 'aureus-runner 3.4s linear infinite' }} />
                                </div>
                                <span className="aureus-motion absolute left-[25%] top-[66%] h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(34,211,238,.9)]" style={{ animation: 'aureus-agent-a 7s linear infinite' }} />
                                <span className="aureus-motion absolute left-[42%] top-[39%] h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(245,158,11,.9)]" style={{ animation: 'aureus-agent-b 6.2s linear infinite alternate' }} />
                            </div>

                            <div className="absolute left-[7%] bottom-[9%] flex items-center gap-2 text-[10px] font-black uppercase text-amber-100/70">
                                <Gauge size={16} /> sim pressure rising
                            </div>
                            <div className="absolute right-[8%] bottom-[14%] flex items-center gap-2 text-[10px] font-black uppercase text-emerald-100/70">
                                <Crosshair size={16} /> landing vector locked
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

                <footer className="grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    {missionPillars.map(({ label, detail, icon: Icon, color }) => (
                        <div key={label} className="flex items-center gap-3 min-w-0">
                            <Icon size={22} className={`${color} shrink-0`} />
                            <div className="min-w-0">
                                <div className="text-sm font-black uppercase leading-none text-white">{label}</div>
                                <div className="truncate text-[10px] font-black uppercase text-white/45">{detail}</div>
                            </div>
                        </div>
                    ))}
                    <div className="hidden items-center gap-2 text-[10px] font-black uppercase text-white/40 sm:flex">
                        <Orbit size={16} className="text-cyan-300" /> drop camera active <Cpu size={16} className="text-emerald-300" /> deterministic sim
                    </div>
                </footer>
            </div>
        </div>
    );
};
