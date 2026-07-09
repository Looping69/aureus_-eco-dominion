/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Menu, Layers, Hammer, X, Activity, TrendingUp, ArrowUp, ArrowDown, Eye, Pickaxe, Palette, Volume2, VolumeX, Users, Shield, RotateCcw } from 'lucide-react';
import { BuildingType, Action, GameStep, SidebarMode, LogisticsOverlayMode, SfxType } from '../types';
import { BUILDINGS } from '../engine/data/VoxelConstants';
import { useAureusAudio } from '../game/audio/useAureusAudio';
import '../components/ViewSwitchButton.css';

type LayerToolMode = 'DIG' | 'DUMP_RUBBLE' | 'FILL_RUBBLE';

interface ControlsProps {
    selectedBuilding: BuildingType | null;
    dispatch: React.Dispatch<Action>;
    setSidebarOpen: (mode: SidebarMode) => void;
    playSfx: (type: any) => void;
    step: GameStep;
    debugMode: boolean;
    interactionMode: 'BUILD' | 'BULLDOZE' | 'INSPECT' | 'TEST_DESTRUCT' | LayerToolMode;
    undergroundUnlocked: boolean;
    activeView: 'SURFACE' | 'DUNGEON';
    overlayMode: LogisticsOverlayMode;
    onToggleView: () => void;
    selectedAgentId: string | null;
    activeLayer: number;
    minLayer: number;
    maxLayer: number;
}

const OVERLAY_SEQUENCE: LogisticsOverlayMode[] = ['OFF', 'FLOW', 'CONGESTION', 'JUNCTIONS'];
const SURFACE_LAYER = 0;

export const Controls: React.FC<ControlsProps> = React.memo(({
    selectedBuilding, dispatch, setSidebarOpen, playSfx, step,
    debugMode, interactionMode, undergroundUnlocked, activeView, overlayMode, onToggleView,
    selectedAgentId, activeLayer, minLayer, maxLayer
}) => {
    const audioBelowSurface = activeLayer < SURFACE_LAYER || activeView === 'DUNGEON';
    const { audioEnabled, toggleAudio, playAudioSfx } = useAureusAudio({
        activeView: audioBelowSurface ? 'DUNGEON' : 'SURFACE',
        paused: false,
    });

    if (selectedBuilding) {
        return (
            <div className="absolute bottom-20 sm:bottom-12 left-4 right-4 z-[120] animate-in slide-in-from-bottom-4 pointer-events-auto flex flex-col gap-2 max-w-sm mx-auto items-center">
                <div className="px-4 py-2.5 rounded-[4px] border-2 shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] font-bold flex items-center justify-center gap-2 text-xs bg-amber-500 text-amber-950 border-amber-800">
                    <Hammer size={16} className="animate-pulse" />
                    <span className="font-['Rajdhani'] uppercase tracking-wider">
                        {`Deploy: ${BUILDINGS[selectedBuilding].name}`}
                    </span>
                </div>
                <button
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        dispatch({ type: 'SELECT_BUILDING_TO_PLACE', payload: null });
                        playSfx('UI_CLICK');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-[4px] border-2 border-b-4 border-slate-950 font-bold text-xs flex items-center justify-center gap-2 active:border-b-2 active:translate-y-0.5 transition-all shadow-lg"
                >
                    <X size={16} /> CANCEL
                </button>
            </div>
        );
    }

    const highlightOps = step === GameStep.TUTORIAL_SELL;
    const highlightBuild = step === GameStep.TUTORIAL_MINE || step === GameStep.TUTORIAL_BUY;
    const normalizedOverlayMode = overlayMode === 'WATER' ? 'OFF' : overlayMode;
    const nextOverlayMode = OVERLAY_SEQUENCE[(OVERLAY_SEQUENCE.indexOf(normalizedOverlayMode) + 1) % OVERLAY_SEQUENCE.length];
    const canUseLayerTools = activeView === 'SURFACE' && (undergroundUnlocked || debugMode);
    const isBelowSurface = activeLayer < SURFACE_LAYER;
    const lowerLayer = Math.max(minLayer, activeLayer - 1);
    const upperLayer = Math.min(maxLayer, activeLayer + 1);
    const selectedAgentIds = selectedAgentId ? [selectedAgentId] : [];
    const setLayerTool = (mode: LayerToolMode) => {
        dispatch({ type: 'SET_INTERACTION_MODE', payload: interactionMode === mode ? 'INSPECT' : mode });
        playSfx('UI_CLICK');
    };
    const toggleWaterView = () => {
        dispatch({ type: 'UPDATE_LOGISTICS', payload: { overlayMode: overlayMode === 'WATER' ? 'OFF' : 'WATER' } });
        playSfx('UI_CLICK');
    };

    return (
        <div className="absolute bottom-16 sm:bottom-6 left-3 right-3 sm:left-6 sm:right-6 z-[120] flex justify-between pointer-events-none gap-4">
            <button
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSidebarOpen('OPS');
                }}
                className={`
                pointer-events-auto 
                bg-slate-800 hover:bg-slate-750 text-white 
                h-14 px-5
                rounded-[6px] 
                border-2 border-b-[6px] border-slate-950 
                shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]
                flex items-center gap-3 transition-all 
                active:border-b-2 active:translate-y-[4px] active:shadow-none
                ${highlightOps ? 'animate-bounce border-emerald-400 z-50' : ''}
            `}
            >
                <Menu size={24} className="text-slate-300" />
                <span className="hidden sm:inline font-black text-sm uppercase tracking-widest font-['Rajdhani']">Ops</span>
            </button>

            <div className="flex gap-3 pointer-events-auto items-end pb-1">
                <button
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        dispatch({ type: 'TOGGLE_DEBUG' });
                        playSfx('UI_CLICK');
                    }}
                    className={`
                    w-10 h-10 rounded-[4px] flex items-center justify-center transition-all
                    border-2 border-b-[4px] 
                    ${debugMode
                            ? 'bg-emerald-600 border-emerald-900 border-b-2 translate-y-[2px]'
                            : 'bg-slate-800 border-slate-950 hover:-translate-y-0.5'
                        }
                    `}
                    title="System Monitor"
                >
                    <Activity size={18} className={debugMode ? 'text-white' : 'text-slate-400'} />
                </button>

                <button
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        dispatch({ type: 'UPDATE_LOGISTICS', payload: { overlayMode: nextOverlayMode } });
                        playSfx('UI_CLICK');
                    }}
                    className="w-12 h-12 rounded-[4px] flex items-center justify-center transition-all bg-slate-800 border-slate-950 hover:-translate-y-0.5 border-2 border-b-[4px]"
                    title={`Logistics Overlay: ${overlayMode}`}
                >
                    <Layers size={20} className={overlayMode === 'OFF' || overlayMode === 'WATER' ? 'text-slate-500' : 'text-cyan-400'} />
                </button>

                <button
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleWaterView();
                    }}
                    className={`w-12 h-12 rounded-[4px] flex items-center justify-center transition-all border-2 border-b-[4px] ${overlayMode === 'WATER' ? 'bg-cyan-500 border-cyan-900 text-cyan-950 border-b-2 translate-y-[2px]' : 'bg-slate-800 border-slate-950 text-cyan-300 hover:-translate-y-0.5'}`}
                    title={overlayMode === 'WATER' ? 'Hide Water View' : 'Show Water View'}
                    aria-label={overlayMode === 'WATER' ? 'Hide Water View' : 'Show Water View'}
                >
                    <Layers size={20} />
                </button>

                <button
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleAudio();
                        playAudioSfx(SfxType.UI_CLICK);
                    }}
                    className={`w-12 h-12 rounded-[4px] flex items-center justify-center transition-all border-2 border-b-[4px] ${audioEnabled ? 'bg-cyan-700 border-cyan-950 text-cyan-50' : 'bg-slate-800 border-slate-950 text-slate-500 hover:-translate-y-0.5'}`}
                    title={audioEnabled ? 'Mute Soundscape' : 'Start Soundscape'}
                    aria-label={audioEnabled ? 'Mute Soundscape' : 'Start Soundscape'}
                >
                    {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>

                {canUseLayerTools && (
                    <div className="flex items-center gap-1 bg-slate-950/80 border-2 border-b-[4px] border-slate-950 rounded-[4px] p-1 shadow-[4px_4px_0_rgba(0,0,0,0.25)]">
                        <button
                            type="button"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                dispatch({ type: 'SET_LAYERED_ACTIVE_Y', payload: lowerLayer });
                                playSfx('UI_CLICK');
                            }}
                            disabled={activeLayer <= minLayer}
                            className="w-9 h-9 rounded-[3px] bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:hover:bg-slate-800 flex items-center justify-center text-slate-300"
                            title="Lower subsurface layer"
                        >
                            <ArrowDown size={16} />
                        </button>
                        <button
                            type="button"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setLayerTool('DIG');
                            }}
                            className={`h-9 min-w-14 rounded-[3px] px-2 flex items-center justify-center gap-1.5 text-[10px] font-black font-mono uppercase transition-all ${interactionMode === 'DIG' ? 'bg-amber-500 text-amber-950' : 'bg-slate-800 text-amber-300 hover:bg-slate-700'}`}
                            title="Dig or clear rubble on selected subsurface layer"
                        >
                            <Pickaxe size={15} /> L{activeLayer}
                        </button>
                        <button
                            type="button"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setLayerTool('DUMP_RUBBLE');
                            }}
                            className={`h-9 min-w-12 rounded-[3px] px-2 text-[10px] font-black font-mono uppercase transition-all ${interactionMode === 'DUMP_RUBBLE' ? 'bg-cyan-400 text-cyan-950' : 'bg-slate-800 text-cyan-300 hover:bg-slate-700'}`}
                            title="Designate an open underground cell as a rubble dump"
                        >
                            Dump
                        </button>
                        <button
                            type="button"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setLayerTool('FILL_RUBBLE');
                            }}
                            className={`h-9 min-w-10 rounded-[3px] px-2 text-[10px] font-black font-mono uppercase transition-all ${interactionMode === 'FILL_RUBBLE' ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-800 text-emerald-300 hover:bg-slate-700'}`}
                            title="Fill an open underground cell using stored rubble"
                        >
                            Fill
                        </button>
                        <button
                            type="button"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                dispatch({ type: 'SET_LAYERED_ACTIVE_Y', payload: upperLayer });
                                playSfx('UI_CLICK');
                            }}
                            disabled={activeLayer >= maxLayer}
                            className="w-9 h-9 rounded-[3px] bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:hover:bg-slate-800 flex items-center justify-center text-slate-300"
                            title="Raise subsurface layer"
                        >
                            <ArrowUp size={16} />
                        </button>
                    </div>
                )}

                <a
                    href="/design-studio"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        playSfx('UI_CLICK');
                    }}
                    className="w-12 h-12 rounded-[4px] flex items-center justify-center transition-all bg-slate-800 border-slate-950 hover:-translate-y-0.5 border-2 border-b-[4px]"
                    title="Design Studio"
                >
                    <Palette size={20} className="text-fuchsia-300" />
                </a>

                <button
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSidebarOpen('TRADE');
                        playSfx('UI_CLICK');
                    }}
                    className="w-12 h-12 rounded-[4px] flex items-center justify-center transition-all bg-slate-800 border-slate-950 hover:-translate-y-0.5 border-2 border-b-[4px]"
                >
                    <TrendingUp size={20} className="text-blue-400" />
                </button>

                <div className="flex items-center gap-1 bg-slate-950/80 border-2 border-b-[4px] border-slate-950 rounded-[4px] p-1 shadow-[4px_4px_0_rgba(0,0,0,0.25)]">
                    <button
                        type="button"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            dispatch({ type: 'SELECT_ALL_COLONY_AGENTS' });
                            playSfx('UI_CLICK');
                        }}
                        className="w-9 h-9 rounded-[3px] bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-emerald-300"
                        title="Select all colony agents"
                        aria-label="Select all colony agents"
                    >
                        <Users size={16} />
                    </button>
                    {selectedAgentId && (
                        <>
                            <button
                                type="button"
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    dispatch({ type: 'COMBAT_HOLD_POSITION', payload: { agentIds: selectedAgentIds } });
                                    playSfx('UI_CLICK');
                                }}
                                className="w-9 h-9 rounded-[3px] bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-amber-300"
                                title="Hold combat position"
                                aria-label="Hold combat position"
                            >
                                <Shield size={16} />
                            </button>
                            <button
                                type="button"
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    dispatch({ type: 'COMBAT_CLEAR_ORDERS', payload: { agentIds: selectedAgentIds } });
                                    playSfx('UI_CLICK');
                                }}
                                className="w-9 h-9 rounded-[3px] bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-cyan-300"
                                title="Return selected agent to automatic combat"
                                aria-label="Return selected agent to automatic combat"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </>
                    )}
                </div>

                {selectedAgentId && (
                    <button
                        type="button"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            dispatch({ type: 'ENTER_FPS', payload: selectedAgentId });
                            playSfx('UI_CLICK');
                        }}
                        className="w-12 h-12 rounded-[4px] flex items-center justify-center transition-all bg-indigo-600 border-indigo-900 hover:-translate-y-0.5 border-2 border-b-[4px]"
                        title="First Person View"
                    >
                        <Eye size={20} className="text-white" />
                    </button>
                )}

                {undergroundUnlocked && (
                    <button
                        type="button"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onToggleView();
                        }}
                        className={`view-switch-button ${isBelowSurface ? 'is-dungeon' : 'is-surface'} w-12 h-12 !p-0`}
                        title={isBelowSurface ? 'Return to Surface (U)' : 'Open Subsurface Cut (U)'}
                    >
                        {isBelowSurface ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
                    </button>
                )}
            </div>

            <button
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSidebarOpen('SHOP');
                }}
                className={`
                pointer-events-auto
                bg-emerald-600 hover:bg-emerald-500 text-white
                h-14 px-5
                rounded-[6px]
                border-2 border-b-[6px] border-emerald-900
                shadow-[4px_4px_0px_0px_rgba(0, 0, 0, 0.3)]
                flex items-center gap-3 transition-all
                active:border-b-2 active:translate-y-[4px] active:shadow-none
                ${highlightBuild ? 'highlight-pulse z-50 ring-4 ring-emerald-400' : ''}
                `}
            >
                <Hammer size={24} />
                <span className="hidden sm:inline font-black text-sm uppercase tracking-widest font-['Rajdhani']">Build</span>
            </button>
        </div>
    );
});