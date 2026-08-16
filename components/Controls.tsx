/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Menu, Layers, Hammer, X, Activity, TrendingUp, ArrowUp, ArrowDown, Eye, Pickaxe, Palette, Volume2, VolumeX } from 'lucide-react';
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
const TOOL_SUMMARY_LABEL: Record<ControlsProps['interactionMode'], string> = {
    BUILD: 'Build',
    BULLDOZE: 'Bulldoze',
    INSPECT: 'Inspect',
    TEST_DESTRUCT: 'Test',
    DIG: 'Dig',
    DUMP_RUBBLE: 'Dump',
    FILL_RUBBLE: 'Fill',
};

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
            <div className="absolute bottom-20 sm:bottom-12 left-3 right-3 z-[120] pointer-events-none flex justify-center">
                <div className="pointer-events-auto flex w-full max-w-xl animate-in slide-in-from-bottom-4 items-center justify-between gap-3 rounded-[6px] border-2 border-b-[6px] border-amber-900 bg-slate-950/92 px-3 py-2.5 text-amber-50 shadow-[4px_4px_0_0_rgba(0,0,0,0.36)] backdrop-blur-sm sm:px-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border-2 border-amber-800 bg-amber-500 text-amber-950 shadow-[2px_2px_0_0_rgba(0,0,0,0.25)]">
                            <Hammer size={18} className="animate-pulse" />
                        </span>
                        <div className="min-w-0">
                            <div className="font-['Rajdhani'] text-[10px] font-black uppercase tracking-widest text-amber-300">Placement</div>
                            <div className="truncate font-['Rajdhani'] text-sm font-black uppercase tracking-wide text-white sm:text-base">
                                {BUILDINGS[selectedBuilding].name}
                            </div>
                        </div>
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
                        className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-[4px] border-2 border-b-[4px] border-slate-950 bg-slate-800 px-3 text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-slate-700 active:translate-y-0.5 active:border-b-2"
                    >
                        <X size={16} />
                        <span className="hidden sm:inline">Cancel</span>
                    </button>
                </div>
            </div>
        );
    }

    const highlightOps = step === GameStep.TUTORIAL_SELL;
    const highlightBuild = step === GameStep.TUTORIAL_MINE || step === GameStep.TUTORIAL_BUY;
    const normalizedOverlayMode = overlayMode === 'WATER' ? 'OFF' : overlayMode;
    const nextOverlayMode = OVERLAY_SEQUENCE[(OVERLAY_SEQUENCE.indexOf(normalizedOverlayMode) + 1) % OVERLAY_SEQUENCE.length];
    const canUseLayerTools = activeView === 'SURFACE' && (undergroundUnlocked || debugMode);
    const isBelowSurface = activeLayer < SURFACE_LAYER;
    const commandContextLabel = selectedAgentId ? 'Agent' : isBelowSurface || activeView === 'DUNGEON' ? 'Dungeon' : 'Surface';
    const overlaySummaryLabel = overlayMode === 'WATER' ? 'Water' : normalizedOverlayMode === 'OFF' ? 'No overlay' : normalizedOverlayMode;
    const layerSummaryLabel = canUseLayerTools ? `L${activeLayer}` : 'L0';
    const activeToolLabel = TOOL_SUMMARY_LABEL[interactionMode];
    const activeToolClassName = interactionMode === 'DIG' || interactionMode === 'DUMP_RUBBLE' || interactionMode === 'FILL_RUBBLE'
        ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
        : interactionMode === 'BULLDOZE' || interactionMode === 'TEST_DESTRUCT'
            ? 'border-rose-400/60 bg-rose-500/15 text-rose-100'
            : interactionMode === 'BUILD'
                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                : 'border-slate-500/50 bg-slate-700/40 text-slate-200';
    const lowerLayer = Math.max(minLayer, activeLayer - 1);
    const upperLayer = Math.min(maxLayer, activeLayer + 1);
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

            <details className="group pointer-events-auto self-end pb-1 max-w-[calc(100vw-8.5rem)] sm:max-w-[min(72vw,820px)]" open>
                <summary
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    className="mx-auto mb-2 flex h-10 w-fit cursor-pointer select-none list-none items-center justify-center gap-2 rounded-[5px] border-2 border-b-[5px] border-slate-950 bg-slate-900/90 px-3 text-[10px] font-black uppercase tracking-widest text-slate-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:border-b-2 active:translate-y-[3px] [&::-webkit-details-marker]:hidden"
                    aria-controls="command-rail-panel"
                >
                    <Menu size={15} className="text-emerald-300 transition-transform duration-200 group-open:rotate-90" />
                    <span className="hidden sm:inline font-['Rajdhani']">Commands</span>
                    <span className={`inline-flex h-5 items-center rounded-[3px] border px-1.5 font-mono text-[9px] ${selectedAgentId ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-100' : isBelowSurface || activeView === 'DUNGEON' ? 'border-amber-400/60 bg-amber-500/15 text-amber-100' : 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'}`}>{commandContextLabel}</span>
                    <span className={`inline-flex h-5 items-center rounded-[3px] border px-1.5 font-mono text-[9px] ${activeToolClassName}`}>{activeToolLabel}</span>
                    <span className="hidden h-5 items-center rounded-[3px] border border-cyan-400/40 bg-cyan-500/10 px-1.5 font-mono text-[9px] text-cyan-100 md:inline-flex">{overlaySummaryLabel}</span>
                    <span className="hidden h-5 items-center rounded-[3px] border border-slate-500/50 bg-slate-700/40 px-1.5 font-mono text-[9px] text-slate-200 lg:inline-flex">{layerSummaryLabel}</span>
                </summary>
                <div
                    id="command-rail-panel"
                    className="grid grid-rows-[0fr] overflow-hidden opacity-0 translate-y-1 transition-[grid-template-rows,opacity,transform] duration-200 ease-out group-open:grid-rows-[1fr] group-open:opacity-100 group-open:translate-y-0"
                >
                    <div className="min-h-0 overflow-hidden">
                        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 rounded-[6px] border-2 border-b-[6px] border-slate-950 bg-slate-900/90 p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.28)] backdrop-blur-sm">
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
                                    className="h-9 min-w-12 rounded-[3px] px-2 bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-1.5 text-[10px] font-black font-mono uppercase text-emerald-300"
                                    title="Select all colony agents"
                                    aria-label="Select all colony agents"
                                >
                                    <Menu size={14} /> All
                                </button>
                                {selectedAgentId && (
                                    <>
                                        <button
                                            type="button"
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                dispatch({ type: 'COMBAT_ATTACK_TARGET' });
                                                playSfx('UI_CLICK');
                                            }}
                                            className="h-9 min-w-14 rounded-[3px] px-2 bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-1.5 text-[10px] font-black font-mono uppercase text-rose-300"
                                            title="Toggle aggression stance"
                                            aria-label="Toggle aggression stance"
                                        >
                                            <Hammer size={14} /> Aggro
                                        </button>
                                        <button
                                            type="button"
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                dispatch({ type: 'COMBAT_HOLD_POSITION' });
                                                playSfx('UI_CLICK');
                                            }}
                                            className="h-9 min-w-12 rounded-[3px] px-2 bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-1.5 text-[10px] font-black font-mono uppercase text-amber-300"
                                            title="Hold combat position"
                                            aria-label="Hold combat position"
                                        >
                                            <Activity size={14} /> Hold
                                        </button>
                                        <button
                                            type="button"
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                dispatch({ type: 'COMBAT_CLEAR_ORDERS' });
                                                playSfx('UI_CLICK');
                                            }}
                                            className="h-9 min-w-12 rounded-[3px] px-2 bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-1.5 text-[10px] font-black font-mono uppercase text-cyan-300"
                                            title="Clear combat stance"
                                            aria-label="Clear combat stance"
                                        >
                                            <X size={14} /> Auto
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
                    </div>
                </div>
            </details>

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