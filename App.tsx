
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useReducer, useState, useCallback } from 'react';
import { VoxelEngine } from './services/VoxelEngine';
import { AudioEngine, SfxType } from './services/AudioEngine';
import { BuildingType, GameStep, Agent, GameState } from './types';
import { BUILDINGS } from './utils/voxelConstants';
import { calculateBuildingCost, GRID_SIZE, getEcoMultiplier } from './utils/gameUtils';
import { gameReducer, initialState } from './store/gameReducer';
import {
    Zap, Utensils, Smile, Briefcase, Info, X,
    Hammer, Pickaxe, Bed, Move, Eye, Wrench, FlaskConical,
    ChevronDown, ChevronUp, User, Activity, Check, MapPin, TrendingUp
} from 'lucide-react';
import { DiffBus } from './services/DiffBus';

// Components
import { HUD } from './components/HUD';
import { OpsDrawer } from './components/OpsDrawer';
import { SupplySidebar } from './components/SupplySidebar';
import { TutorialOverlay, GameOverScreen, ConstructionModal, UndergroundOverlay } from './components/Modals';
import { Controls } from './components/Controls';
import { NewsTicker } from './components/NewsTicker';
import { GoalWidget } from './components/GoalWidget';
import { InventoryHUD } from './components/InventoryHUD';
import { DebugMenu } from './components/DebugMenu';
import { Minimap } from './components/Minimap';
import { WorldMap } from './components/WorldMap';
import { HomePage } from './components/HomePage';
import { TradeTerminal } from './components/TradeTerminal';
import { WeatherOverlay } from './components/WeatherOverlay';

const ColonistInspector: React.FC<{ agent: Agent; onClose: () => void; playSfx: (t: any) => void }> = ({ agent, onClose, playSfx }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const NeedsBar = ({ icon: Icon, value, baseColor, label }: any) => {
        const isLow = value < 30;
        return (
            <div className="flex flex-col gap-0.5 flex-1">
                <div className="flex justify-between items-center px-0.5">
                    <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                        <Icon size={8} /> {label}
                    </div>
                    <span className={`text-[8px] font-mono font-bold ${isLow ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>
                        {Math.floor(value)}%
                    </span>
                </div>
                <div className="h-2 bg-slate-950 border border-slate-700 p-[1px]">
                    <div
                        className={`h-full ${isLow ? 'bg-rose-500' : baseColor} transition-all duration-700`}
                        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                    />
                </div>
            </div>
        );
    };

    const getTaskIcon = (jobId: string | null, state: string) => {
        if (state === 'SLEEPING' || (jobId && jobId.includes('sleep'))) return <Bed size={12} />;
        if (state === 'MOVING' || (jobId && (jobId.includes('move') || jobId.includes('wander')))) return <Move size={12} />;

        if (jobId) {
            const type = jobId.split('_')[1]?.toLowerCase() || '';
            if (type === 'mine' || jobId.includes('mine')) return <Pickaxe size={12} />;
            if (type === 'build' || jobId.includes('j_b_')) return <Hammer size={12} />;
            if (type === 'repair') return <Wrench size={12} />;
            if (type === 'research') return <FlaskConical size={12} />;
            if (type === 'rehabilitate') return <FlaskConical size={12} />;
        }

        return state === 'WORKING' ? <Briefcase size={12} /> : <Eye size={12} />;
    };

    if (isCollapsed) {
        return (
            <div className="pointer-events-auto animate-in slide-in-from-left-4 duration-300">
                <button
                    onClick={() => { setIsCollapsed(false); playSfx('UI_CLICK'); }}
                    className="w-10 h-10 bg-slate-900 border-2 border-slate-600 flex items-center justify-center hover:bg-slate-800 transition-colors shadow-lg group relative"
                >
                    <div className={`w-6 h-6 ${agent.type === 'ILLEGAL_MINER' ? 'bg-slate-700' : 'bg-amber-600'} flex items-center justify-center text-slate-900 font-black text-[10px] shadow-sm`}>
                        {agent.name[0]}
                    </div>
                    {/* Active Indicator */}
                    <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-slate-900" />
                </button>
            </div>
        );
    }

    return (
        <div className="pointer-events-auto w-56 sm:w-64 animate-in slide-in-from-left-4 duration-300">
            {/* Voxel Card Container */}
            <div className="bg-slate-900 border-2 border-slate-600 shadow-[4px_4px_0_0_rgba(0,0,0,0.5)]">

                {/* Header */}
                <div
                    className="p-2 flex justify-between items-center cursor-pointer bg-slate-800 border-b-2 border-slate-700 hover:bg-slate-750 transition-colors"
                    onClick={() => {
                        setIsCollapsed(true);
                        playSfx('UI_CLICK');
                    }}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-amber-600 border border-amber-400 flex items-center justify-center text-slate-900 font-black text-[10px] shadow-sm">
                            {agent.name[0]}
                        </div>
                        <div className="flex flex-col">
                            <h3 className="font-bold text-white text-[10px] uppercase font-['Rajdhani'] tracking-wider leading-none mb-0.5">{agent.name}</h3>
                            <div className="flex items-center gap-1">
                                <span className="text-slate-400">{getTaskIcon(null, agent.state)}</span>
                                <span className="text-[8px] text-amber-400 font-bold font-mono">{agent.type}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); playSfx('UI_CLICK'); }}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-2 space-y-3 bg-slate-900">
                    {/* Status Readout */}
                    <div className="flex items-center justify-between bg-slate-950 p-2 border border-slate-800 font-mono">
                        <div className="flex flex-col">
                            <span className="text-[7px] text-slate-500 uppercase font-bold tracking-widest">Current Protocol</span>
                            <span className="text-[9px] text-emerald-400 font-bold truncate max-w-[120px]">
                                {agent.currentJobId ? agent.currentJobId.split('_')[1].toUpperCase() : "IDLE_ROUTINE"}
                            </span>
                        </div>
                        <div className="text-slate-900 bg-emerald-500 px-1.5 py-0.5 text-[8px] font-bold uppercase">
                            {agent.state}
                        </div>
                    </div>

                    {/* Needs */}
                    <div className="space-y-1.5">
                        <NeedsBar icon={Zap} value={agent.energy} baseColor="bg-blue-500" label="PWR" />
                        <NeedsBar icon={Utensils} value={agent.hunger} baseColor="bg-amber-500" label="HGR" />
                        <NeedsBar icon={Smile} value={agent.mood} baseColor="bg-emerald-500" label="MOR" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<VoxelEngine | null>(null);
    const audioRef = useRef<AudioEngine>(new AudioEngine());
    const lastSfxTime = useRef<number>(0);

    const [state, dispatch] = useReducer(gameReducer, initialState);
    const stateRef = useRef(state);

    useEffect(() => {
        stateRef.current = state;
        // console.log("Current Step:", state.step);
    }, [state]);

    const [sidebarOpen, setSidebarOpen] = useState<'NONE' | 'OPS' | 'SHOP' | 'TRADE'>('NONE');
    const [selectedTileForAction, setSelectedTileForAction] = useState<number | null>(null);
    const [isIntroAnim, setIsIntroAnim] = useState(true);
    const [pendingPlacementIndex, setPendingPlacementIndex] = useState<number | null>(null);
    const [showWorldMap, setShowWorldMap] = useState(false);
    const [showHomePage, setShowHomePage] = useState(true);
    const [hasSave, setHasSave] = useState(false);
    const showHomePageRef = useRef(true);

    useEffect(() => {
        showHomePageRef.current = showHomePage;
    }, [showHomePage]);

    // Initial check for save file
    useEffect(() => {
        const saved = localStorage.getItem('aureus_save_v1');
        if (saved) setHasSave(true);
    }, []);

    const saveGame = useCallback((currentState: GameState) => {
        localStorage.setItem('aureus_save_v1', JSON.stringify(currentState));
        setHasSave(true);
    }, []);

    const selectedAgent = state.agents.find(a => a.id === state.selectedAgentId);
    const [hoverTile, setHoverTile] = useState<number | null>(null);

    // Memoize SFX play to pass to memoized components
    const playSfx = useCallback((type: SfxType) => {
        audioRef.current.play(type);
    }, []);

    // --- Side Effects Processing ---
    useEffect(() => {
        if (state.pendingEffects.length > 0) {
            state.pendingEffects.forEach(effect => {
                if (effect.type === 'AUDIO') {
                    // Debounce high frequency SFX
                    if (effect.sfx === 'MINING_HIT') {
                        const now = Date.now();
                        if (now - lastSfxTime.current < 50) return;
                        lastSfxTime.current = now;
                    }
                    audioRef.current.play(effect.sfx);
                } else if (effect.type === 'GRID_UPDATE' || effect.type === 'FX') {
                    // Forward visuals to DiffBus which VoxelEngine listens to
                    DiffBus.publish(effect);
                }
            });
        }
    }, [state.pendingEffects]);

    const closeSidebars = useCallback(() => {
        setSidebarOpen(prev => prev !== 'NONE' ? 'NONE' : prev);
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;
        const engine = new VoxelEngine(
            containerRef.current,
            (index) => {
                const currentState = stateRef.current;
                audioRef.current.init();
                closeSidebars();

                if (currentState.selectedBuilding) {
                    setPendingPlacementIndex(index);
                    audioRef.current.play('UI_CLICK');
                    return;
                }

                if (currentState.interactionMode === 'BULLDOZE') {
                    dispatch({ type: 'BULLDOZE_TILE', payload: { index } });
                    audioRef.current.play('CAMP_RUSTLE');
                    return;
                }

                setSelectedTileForAction(index);
            },
            (index) => {
                const currentState = stateRef.current;
                closeSidebars();
                if (currentState.selectedAgentId) {
                    dispatch({ type: 'COMMAND_AGENT', payload: { agentId: currentState.selectedAgentId, tileId: index } });
                    playSfx('UI_CLICK');
                }
            },
            (agentId) => {
                closeSidebars();
                dispatch({ type: 'SELECT_AGENT', payload: agentId });
                if (agentId) playSfx('UI_CLICK');
            },
            (index) => {
                setHoverTile(index);
            },
            GRID_SIZE
        );
        engineRef.current = engine;

        // Use initialSync instead of updateTerrain for the first load
        engine.initialSync(state.grid);
        engine.playIntroAnimation(() => {
            setIsIntroAnim(false);
        });

        let tickCount = 0;
        const timer = setInterval(() => {
            if (stateRef.current.step !== GameStep.GAME_OVER && !showHomePageRef.current) {
                dispatch({ type: 'TICK' });

                // Auto-save every ~30 seconds (150 ticks at 200ms)
                tickCount++;
                if (tickCount >= 150) {
                    saveGame(stateRef.current);
                    tickCount = 0;
                }
            }
        }, 300); // 3.3 ticks/sec for performance

        return () => {
            clearInterval(timer);
            engine.cleanup();
        };
    }, []);

    useEffect(() => {
        engineRef.current?.setSelectedAgent(state.selectedAgentId);
    }, [state.selectedAgentId]);

    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.setInteractionMode(state.interactionMode);
        }
    }, [state.interactionMode]);

    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.updateAgents(state.agents);
        }
    }, [state.agents]);

    // Sync Global Events to Visual Engine
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.syncEvents(state.activeEvents);
        }
    }, [state.activeEvents]);

    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.setGhostBuilding(state.selectedBuilding);
            // Clear pending if selection changed
            setPendingPlacementIndex(null);
        }
    }, [state.selectedBuilding]);

    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.setPinnedGhost(pendingPlacementIndex);
        }
    }, [pendingPlacementIndex]);

    const ecoMult = getEcoMultiplier(state.resources.eco);
    const trustMult = 1 + (state.resources.trust / 200);
    const globalMult = ecoMult * trustMult;
    let income = 0;
    let cost = 0;
    state.grid.forEach(tile => {
        if (tile.foliage === 'ILLEGAL_CAMP') income -= 5;
        if (tile.locked || tile.buildingType === BuildingType.EMPTY || tile.isUnderConstruction) return;
        const def = BUILDINGS[tile.buildingType];
        if (def) {
            cost += def.maintenance;
            if (def.productionType === 'AGT') income += (def.production || 0) * globalMult;
        }
    });
    const net = income - cost;

    const handleSidebarOpen = useCallback((mode: 'NONE' | 'OPS' | 'SHOP') => {
        if (mode !== 'NONE') playSfx('UI_OPEN');
        setSidebarOpen(mode);
    }, [playSfx]);

    const handleConfirmPlacement = useCallback(() => {
        if (pendingPlacementIndex !== null && state.selectedBuilding) {
            dispatch({ type: 'PLACE_BUILDING', payload: { index: pendingPlacementIndex } });
            audioRef.current.play('BUILD');
            setPendingPlacementIndex(null);
        }
    }, [pendingPlacementIndex, state.selectedBuilding]);

    // Keyboard listener for starting game from home page
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showHomePage && e.code === 'Space') {
                e.preventDefault();
                setShowHomePage(false);
                audioRef.current.init();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showHomePage]);

    const handleStartGame = useCallback(() => {
        setShowHomePage(false);
        audioRef.current.init();
    }, []);

    const handleContinueGame = useCallback(() => {
        const saved = localStorage.getItem('aureus_save_v1');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                dispatch({ type: 'LOAD_GAME', payload: parsed });
                setShowHomePage(false);
                audioRef.current.init();
                // Sync engine with loaded grid
                setTimeout(() => engineRef.current?.initialSync(parsed.grid), 100);
            } catch (e) {
                console.error("Failed to load save", e);
            }
        }
    }, []);

    // Show home page first
    return (
        <div className="relative w-full h-screen overflow-hidden bg-slate-900 select-none">
            {/* Voxel World Container - Always in DOM for engine stability */}
            <div
                ref={containerRef}
                className={`absolute inset-0 z-0 transition-opacity duration-1000 ${showHomePage ? 'brightness-[0.9]' : 'brightness-100'}`}
            />

            {showHomePage && (
                <div className="absolute inset-0 z-50 bg-gradient-to-b from-black/30 via-transparent to-black/50">
                    <HomePage
                        onStartGame={handleStartGame}
                        onContinueGame={handleContinueGame}
                        hasSave={hasSave}
                    />
                </div>
            )}

            {!showHomePage && !isIntroAnim && (
                <>
                    <WeatherOverlay weather={state.weather} />
                    <HUD resources={state.resources} financials={{ net }} population={state.agents.filter(a => a.type !== 'ILLEGAL_MINER').length} />
                    <Minimap
                        grid={state.grid}
                        agents={state.agents}
                        viewMode={state.viewMode}
                        onOpenMap={() => { setShowWorldMap(true); playSfx('UI_OPEN'); }}
                    />

                    <WorldMap
                        isOpen={showWorldMap}
                        onClose={() => setShowWorldMap(false)}
                        grid={state.grid}
                        agents={state.agents}
                        playSfx={playSfx}
                    />

                    <div className="absolute top-14 left-2 sm:left-4 z-40 flex flex-col gap-2 items-start pointer-events-none">
                        <TutorialOverlay
                            step={state.step}
                            dispatch={dispatch}
                            setSidebarOpen={handleSidebarOpen}
                            playSfx={playSfx}
                        />

                        {selectedAgent && (
                            <ColonistInspector
                                agent={selectedAgent}
                                onClose={() => dispatch({ type: 'SELECT_AGENT', payload: null })}
                                playSfx={playSfx}
                            />
                        )}

                        <GoalWidget
                            goal={state.activeGoal}
                            dispatch={dispatch}
                            playSfx={playSfx}
                        />

                        <NewsTicker
                            news={state.newsFeed}
                            onDismiss={(id) => dispatch({ type: 'DISMISS_NEWS', payload: id })}
                            playSfx={playSfx}
                        />
                    </div>

                    <InventoryHUD
                        inventory={state.inventory}
                        selectedBuilding={state.selectedBuilding}
                        dispatch={dispatch}
                        playSfx={playSfx}
                        step={state.step}
                    />

                    {/* Validator UI Over Controls */}
                    {pendingPlacementIndex !== null && state.selectedBuilding && (
                        <div className="absolute bottom-40 sm:bottom-12 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-2 duration-300 pointer-events-auto">
                            <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-4 flex flex-col items-center gap-3 min-w-[280px]">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                                        <MapPin size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">Validator</span>
                                        <h3 className="text-white font-bold text-sm">Confirm {BUILDINGS[state.selectedBuilding].name} location?</h3>
                                    </div>
                                </div>

                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={() => { setPendingPlacementIndex(null); playSfx('UI_CLICK'); }}
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-2.5 rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <X size={16} /> REPOSITION
                                    </button>
                                    <button
                                        onClick={handleConfirmPlacement}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <Check size={16} /> BUILD HERE
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <Controls
                        selectedBuilding={state.selectedBuilding}
                        dispatch={dispatch}
                        setSidebarOpen={handleSidebarOpen}
                        viewMode={state.viewMode}
                        playSfx={playSfx}
                        step={state.step}
                        debugMode={state.debugMode}
                    />

                    <OpsDrawer
                        isOpen={sidebarOpen === 'OPS'}
                        onClose={() => setSidebarOpen('NONE')}
                        state={state}
                        dispatch={dispatch}
                        financials={{ income, cost, net }}
                        ecoMult={ecoMult}
                        trustMult={trustMult}
                        playSfx={playSfx}
                    />

                    <SupplySidebar
                        isOpen={sidebarOpen === 'SHOP'}
                        onClose={() => setSidebarOpen('NONE')}
                        state={state}
                        dispatch={dispatch}
                        playSfx={playSfx}
                    />

                    <TradeTerminal
                        isOpen={sidebarOpen === 'TRADE'}
                        onClose={() => setSidebarOpen('NONE')}
                        state={state}
                        dispatch={dispatch}
                        playSfx={playSfx}
                    />

                    <UndergroundOverlay
                        viewMode={state.viewMode}
                        trust={state.resources.trust}
                        dispatch={dispatch}
                        playSfx={playSfx}
                    />

                    <ConstructionModal
                        selectedTile={selectedTileForAction}
                        grid={state.grid}
                        gems={state.resources.gems}
                        dispatch={dispatch}
                        onClose={() => setSelectedTileForAction(null)}
                        playSfx={playSfx}
                    />

                    {state.debugMode && (
                        <DebugMenu
                            engine={engineRef.current}
                            state={state}
                            onClose={() => dispatch({ type: 'TOGGLE_DEBUG' })}
                            dispatch={dispatch}
                        />
                    )}
                </>
            )}

            <GameOverScreen step={state.step} resources={state.resources} dispatch={dispatch} />
        </div>
    );
};

export default App;
