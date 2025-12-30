
import React, { useEffect, useState } from 'react';
import { WeatherState } from '../types';

export const WeatherOverlay: React.FC<{ weather: WeatherState }> = ({ weather }) => {
    const [particles, setParticles] = useState<any[]>([]);

    if (!weather) return null;

    useEffect(() => {
        if (weather.current === 'CLEAR') {
            setParticles([]);
            return;
        }

        // Generate particles based on weather type
        const count = weather.current === 'ACID_RAIN' ? 100 : 50;
        const newParticles = Array.from({ length: count }).map((_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 2,
            duration: 0.5 + Math.random() * 1
        }));
        setParticles(newParticles);
    }, [weather.current]);

    if (weather.current === 'CLEAR') return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            {/* Color Grading */}
            <div className={`absolute inset-0 transition-all duration-1000 ${weather.current === 'DUST_STORM' ? 'bg-orange-600/20 mix-blend-hard-light backdrop-sepia-[0.5]' :
                weather.current === 'ACID_RAIN' ? 'bg-lime-900/30 mix-blend-overlay backdrop-contrast-125' : ''
                }`} />

            {/* Fog / Grain */}
            {weather.current === 'DUST_STORM' && (
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 animate-pulse mix-blend-overlay" />
            )}

            {/* Particles */}
            {weather.current === 'ACID_RAIN' && particles.map(p => (
                <div
                    key={p.id}
                    className="absolute top-0 w-[2px] bg-lime-400/60 blur-[1px]"
                    style={{
                        left: `${p.left}%`,
                        height: '100px',
                        animation: `fall ${p.duration}s linear infinite`,
                        animationDelay: `-${p.delay}s`
                    }}
                />
            ))}

            {weather.current === 'DUST_STORM' && particles.map(p => (
                <div
                    key={p.id}
                    className="absolute bg-orange-300/40 rounded-full blur-md"
                    style={{
                        left: `${p.left}%`,
                        top: `${Math.random() * 100}%`,
                        width: '100px',
                        height: '100px',
                        animation: `drift 3s linear infinite`,
                        animationDelay: `-${p.delay}s`
                    }}
                />
            ))}

            <style>{`
                @keyframes fall {
                    0% { transform: translateY(-120px) translateX(0); opacity: 0; }
                    20% { opacity: 1; }
                    100% { transform: translateY(110vh) translateX(-20px); opacity: 0; }
                }
                @keyframes drift {
                    0% { transform: translateX(-100px) scale(1); opacity: 0; }
                    50% { opacity: 0.5; }
                    100% { transform: translateX(110vw) scale(1.5); opacity: 0; }
                }
            `}</style>

            {/* Warning Text */}
            <div className="absolute top-32 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div className={`px-4 py-1 rounded border ${weather.current === 'DUST_STORM' ? 'bg-orange-950/80 border-orange-500 text-orange-400' :
                    'bg-lime-950/80 border-lime-500 text-lime-400'
                    } text-xs font-bold uppercase tracking-[0.2em] shadow-lg animate-bounce`}>
                    WARNING: {weather.current.replace('_', ' ')}
                </div>
                <div className="text-[10px] text-white/70 font-mono mt-1 bg-black/50 px-2 rounded">
                    Maintenance Costs +{weather.current === 'ACID_RAIN' ? '100' : '50'}%
                </div>
            </div>
        </div>
    );
};
