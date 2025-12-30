
import React, { useState, useEffect } from 'react';
import { Play, Leaf, Mountain, Users, Hexagon, Volume2, VolumeX, Info, Terminal } from 'lucide-react';

interface HomePageProps {
    onStartGame: () => void;
    onContinueGame: () => void;
    hasSave: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({ onStartGame, onContinueGame, hasSave }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="relative h-full flex flex-col p-8 font-['Rajdhani'] selection:bg-amber-500 selection:text-black">
            {/* Top Bar Navigation */}
            <div className={`flex justify-between items-start transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
                {/* Brand / Sector Info */}
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#0c0c14] border-2 border-slate-700 shadow-[4px_4px_0_#000] flex items-center justify-center">
                        <Hexagon size={24} className="text-amber-500 fill-amber-500/10" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-white/60 text-[10px] font-black tracking-[0.3em] uppercase leading-none mb-1">Sector-7 // Zimbabwe</span>
                        <span className="text-white text-lg font-black italic tracking-wider leading-none">AUREUS COMMAND</span>
                    </div>
                </div>

                {/* System Controls */}
                <div className="flex gap-4">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="w-10 h-10 bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all rounded-md"
                    >
                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <button
                        className="px-6 h-10 bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2 text-white/60 hover:text-white transition-all rounded-md"
                    >
                        <Info size={16} />
                        <span className="font-bold text-xs uppercase tracking-widest">About</span>
                    </button>
                </div>
            </div>

            {/* Main Center Content */}
            <div className="flex-1 flex flex-col items-center justify-center -mt-12 text-center">
                {/* Secondary Title Badge */}
                <div className={`mb-4 transition-all duration-1000 delay-100 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="bg-amber-600 text-black px-4 py-1 text-[10px] font-black uppercase tracking-[0.4em] shadow-[3px_3px_0_#000]">
                        Eco Dominion
                    </div>
                </div>

                {/* Primary Title */}
                <div className={`mb-4 transition-all duration-1000 delay-200 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                    <h1
                        className="text-8xl md:text-[10rem] font-black text-white italic tracking-tighter leading-none select-none drop-shadow-2xl"
                        style={{
                            textShadow: '4px 4px 0px rgba(0,0,0,0.8), 8px 8px 20px rgba(0,0,0,0.5)'
                        }}
                    >
                        AUREUS
                    </h1>
                </div>

                {/* Pillars / Subheader */}
                <div className={`mb-12 transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                    <p className="text-white/80 font-black text-sm md:text-base uppercase tracking-[0.25em]">
                        Industrial Supremacy <span className="text-emerald-500 mx-2">//</span> Civil Stability <span className="text-amber-500 mx-2">//</span> Eco Integrity
                    </p>
                </div>

                {/* Finalize/Initialize Buttons */}
                <div className={`transition-all duration-1000 delay-400 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} flex flex-col sm:flex-row gap-4`}>
                    {hasSave && (
                        <button
                            onClick={onContinueGame}
                            className="group relative px-10 py-6 bg-blue-600 border-2 border-black shadow-[6px_6px_0_#000] hover:translate-y-[-2px] hover:shadow-[8px_8px_0_#000] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-4"
                        >
                            <Terminal size={28} className="text-white/80" />
                            <div className="text-left">
                                <span className="block text-2xl font-black text-white italic tracking-tighter leading-none mb-0.5 uppercase">Continue</span>
                                <span className="block text-[8px] font-black text-white/60 tracking-[0.3em] uppercase leading-none">Restore Session</span>
                            </div>
                        </button>
                    )}

                    <button
                        onClick={onStartGame}
                        className="group relative px-14 py-6 bg-emerald-500 border-2 border-black shadow-[6px_6px_0_#000] hover:translate-y-[-2px] hover:shadow-[8px_8px_0_#000] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-6"
                    >
                        <Play size={32} className="text-black/80 fill-black/60" />
                        <div className="text-left">
                            <span className="block text-4xl font-black text-black italic tracking-tighter leading-none mb-0.5">INITIALIZE</span>
                            <span className="block text-[10px] font-black text-black/60 tracking-[0.3em] uppercase leading-none">New Mission</span>
                        </div>
                    </button>
                </div>

                <p className={`mt-6 text-white/40 font-black uppercase tracking-[0.3em] text-[10px] transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                    Press Space to Start New mission
                </p>
            </div>

            {/* Bottom Category Chunks */}
            <div className={`grid grid-cols-3 gap-6 max-w-6xl w-full mx-auto transition-all duration-1000 delay-600 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                {/* Industry Card */}
                <div className="bg-[#0c0c14]/90 backdrop-blur-lg border-2 border-slate-800 p-6 flex flex-col gap-4 shadow-[6px_6px_0_rgba(0,0,0,0.4)] border-l-amber-500 border-l-4">
                    <Mountain size={28} className="text-white/60" />
                    <div>
                        <h4 className="text-white font-black text-xl tracking-widest mb-1 italic">INDUSTRY</h4>
                        <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest leading-none">Build Extraction Grids</p>
                    </div>
                </div>

                {/* Ecology Card */}
                <div className="bg-[#0c0c14]/90 backdrop-blur-lg border-2 border-slate-800 p-6 flex flex-col gap-4 shadow-[6px_6px_0_rgba(0,0,0,0.4)] border-l-emerald-500 border-l-4">
                    <Leaf size={28} className="text-white/60" />
                    <div>
                        <h4 className="text-white font-black text-xl tracking-widest mb-1 italic">ECOLOGY</h4>
                        <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest leading-none">Balance Atmosphere</p>
                    </div>
                </div>

                {/* Humanity Card */}
                <div className="bg-[#0c0c14]/90 backdrop-blur-lg border-2 border-slate-800 p-6 flex flex-col gap-4 shadow-[6px_6px_0_rgba(0,0,0,0.4)] border-l-blue-500 border-l-4">
                    <Users size={28} className="text-white/60" />
                    <div>
                        <h4 className="text-white font-black text-xl tracking-widest mb-1 italic">HUMANITY</h4>
                        <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest leading-none">Manage Colonist Needs</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
