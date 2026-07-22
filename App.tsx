import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Activity, X } from 'lucide-react';
import { useAureusEngine } from './game/useAureusEngine';
import { BuildingType, SfxType, SidebarMode } from './types';
import { HUD } from './components/HUD';
import { Controls } from './components/Controls';
import { SupplySidebar } from './components/SupplySidebar';
import { OpsDrawer } from './components/OpsDrawer';
import { TradeTerminal } from './components/TradeTerminal';
import { InventoryHUD } from './components/InventoryHUD';
import { NewsTicker } from './components/NewsTicker';
import { GoalWidget } from './components/GoalWidget';
import { ContractTracker } from './components/ContractTracker';
import { AIOverseerPanel } from './components/AIOverseerPanel';
import { WorldHoverTooltip } from './components/WorldHoverTooltip';
import {
    TutorialOverlay,
    ConstructionModal,
    BuildingInspectorModal,
    GameOverScreen
} from './components/Modals';
import { EraUnlockedModal } from './components/EraUnlockedModal';
import { HomePage } from './components/HomePage';
import { WorldMap } from './components/WorldMap';
import { Minimap } from './components/Minimap';
import { WeatherOverlay } from './components/WeatherOverlay';
import { UndergroundHUD } from './components/UndergroundHUD';
import { DialogueOverlay } from './components/DialogueOverlay';
import { MobileBuildingConfirmation } from './components/MobileBuildingConfirmation';
import { DebugMenu } from './components/DebugMenu';
import { AgentDebugOverlay } from './components/AgentDebugOverlay';
import { LoadingOverlay } from './components/LoadingOverlay';
import { FPSAbilityHUD, type FPSAbility } from './components/FPSAbilityHUD';
import { canTileAtPositionOpenModal, isLinePlacementType } from './game/ui/tileSelection';
import { getEscapeKeyAction } from './game/ui/escapeKeyAction';
import { getClosedPanelTransition, getSidebarOpenTransition, getTileInteractionPanelReset, getWorldMapOpenTransition, type AppPanelOpenTransition } from './game/ui/appPanelTransitions';
import { getPlacementPromptReset } from './game/ui/appPlacementReset';
import {
    FPS_ABILITY_BY_KEY,
    createFPSAimTarget,
    enqueueFPSQueuedCommand,
    resolveFPSAbilityIntent,
} from './game/ui/fpsAbilityLogic';

const CommandFailureToast: React.FC<{ result?: any }> = ({ result }) => {
    if (!result || result.ok) return null;

    const commandName = String(result.type || 'COMMAND').replace(/_/g, ' ').toLowerCase();
    const reason = result.reason || 'The command could not be completed.';

    return (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[80] pointer-events-none max-w-[calc(100vw-2rem)]">
            <div className="bg-rose-950/92 border border-rose-700 text-rose-100 shadow-[4px_4px_0_rgba(0,0,0,0.45)] rounded-[6px] px-4 py-3 w-[22rem] max-w-full">
                <div className="text-[9px] font-black uppercase tracking-wider text-rose-300 mb-1">Cannot {commandName}</div>
                <div className="text-xs font-bold leading-snug">{reason}</div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const [container, setContainer] = useState<HTMLElement | null>(null);
    const [pendingPlacementPos, setPendingPlacementPos] = useState<{ x: number, z: number } | null>(null);
    const [selectedTilePos, setSelectedTilePos] = useState<{ x: number, z: number } | null>(null);
    const [pinnedTilePos, setPinnedTilePos] = useState<{ x: number, z: number } | null>(null);
    const [linePlacementStart, setLinePlacementStart] = useState<{ x: number, z: number, type: BuildingType } | null>(null);
    const [hoverTilePos, setHoverTilePos] = useState<{ x: number, z: number } | null>(null);
    const [hoverCursor, setHoverCursor] = useState<{ x: number, y: number } | null>(null);

    const [worldInstance, setWorldInstance] = useState<any>(null);
    const [sidebarOpen, setSidebarOpen] = useState<SidebarMode>('NONE');
    const [showHomePage, setShowHomePage] = useState(true);
    const [isIntroAnim, setIsIntroAnim] = useState(false);
    const [showWorldMap, setShowWorldMap] = useState(false);
    const [activeHUDBlock, setActiveHUDBlock] = useState<string | null>(null);
    const [dismissedEraPopup, setDismissedEraPopup] = useState<string | null>(null);
    const [fpsAbilityMessage, setFpsAbilityMessage] = useState<string | null>(null);
    const stateRef = useRef<any>(null);
    const fpsMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearLinePlacement = useCallback(() => {
        worldInstance?.clearInfrastructureLinePreview?.();
        setLinePlacementStart(null);
    }, [worldInstance]);

    const clearPlacementPrompt = useCallback(() => {
        worldInstance?.clearPinnedBuilding?.();
        worldInstance?.clearInfrastructureLinePreview?.();
        const reset = getPlacementPromptReset();
        setPendingPlacementPos(reset.pendingPlacementPos);
        setPinnedTilePos(reset.pinnedTilePos);
        setLinePlacementStart(reset.linePlacementStart);
    }, [worldInstance]);

    const applyTileInteractionPanelReset = useCallback(() => {
        const reset = getTileInteractionPanelReset();
        setShowWorldMap(reset.showWorldMap);
        setSidebarOpen(reset.sidebarOpen);
        setSelectedTilePos(reset.selectedTilePos);
    }, []);

    const showFPSAbilityMessage = useCallback((message: string) => {
        setFpsAbilityMessage(message);
        if (fpsMessageTimerRef.current) clearTimeout(fpsMessageTimerRef.current);
        fpsMessageTimerRef.current = setTimeout(() => setFpsAbilityMessage(null), 2600);
    }, []);

    const handleTileClick = useCallback((x: number, z: number, isTouch?: boolean) => {
        const currentState = stateRef.current;
        if (!currentState) return;

        if (currentState.interactionMode === 'BUILD' && currentState.selectedBuilding) {
            const selectedBuilding = currentState.selectedBuilding as BuildingType;

            if (isLinePlacementType(selectedBuilding)) {
                applyTileInteractionPanelReset();

                if (!linePlacementStart || linePlacementStart.type !== selectedBuilding) {
                    setLinePlacementStart({ x, z, type: selectedBuilding });
                    setPendingPlacementPos(null);
                    setPinnedTilePos({ x, z });
                    worldInstance?.pinBuildingForConfirmation(x, z);
                    worldInstance?.previewInfrastructureLine?.(x, z, x, z, selectedBuilding);
                    return;
                }

                worldInstance?.placeInfrastructureLine(
                    linePlacementStart.x,
                    linePlacementStart.z,
                    x,
                    z,
                    selectedBuilding
                );
                worldInstance?.selectBuilding(null);
                worldInstance?.clearPinnedBuilding();
                worldInstance?.clearInfrastructureLinePreview?.();
                setLinePlacementStart(null);
                setPendingPlacementPos(null);
                setPinnedTilePos(null);
                return;
            }

            clearLinePlacement();
            applyTileInteractionPanelReset();
            setPendingPlacementPos({ x, z });
            worldInstance?.pinBuildingForConfirmation(x, z);
        } else if (currentState.interactionMode === 'INSPECT' || (currentState.interactionMode === 'BUILD' && !currentState.selectedBuilding)) {
            clearLinePlacement();
            applyTileInteractionPanelReset();
            setPendingPlacementPos(null);
            setPinnedTilePos(null);
            setSelectedTilePos({ x, z });
        }
    }, [applyTileInteractionPanelReset, clearLinePlacement, linePlacementStart, worldInstance]);

    const handleTileHover = useCallback((x: number | null, z: number | null) => {
        setHoverTilePos(x === null || z === null ? null : { x, z });
        if (!linePlacementStart || x === null || z === null) {
            if (!linePlacementStart) worldInstance?.clearInfrastructureLinePreview?.();
            return;
        }

        worldInstance?.previewInfrastructureLine?.(
            linePlacementStart.x,
            linePlacementStart.z,
            x,
            z,
            linePlacementStart.type
        );
    }, [linePlacementStart, worldInstance]);

    const { world, state, dispatch, getDebugStats, loading } = useAureusEngine({
        container,
        paused: showHomePage || isIntroAnim,
        onTileClick: handleTileClick,
        onTileHover: handleTileHover,
        onAgentClick: (id) => dispatch({ type: 'SELECT_AGENT', payload: id }),
        onSfx: (type) => console.log(`[Engine SFX] ${type}`)
    });

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            setHoverCursor({ x: event.clientX, y: event.clientY });
        };
        const handlePointerLeave = () => {
            setHoverCursor(null);
            setHoverTilePos(null);
        };
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerleave', handlePointerLeave);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerleave', handlePointerLeave);
        };
    }, []);

    useEffect(() => {
        if (!state?.eraUnlockedPopup) {
            setDismissedEraPopup(null);
        }
    }, [state?.eraUnlockedPopup]);

    useEffect(() => {
        if (world) setWorldInstance(world);
    }, [world]);

    useEffect(() => {
        if (!state?.selectedBuilding || !isLinePlacementType(state.selectedBuilding)) {
            clearLinePlacement();
        }
    }, [clearLinePlacement, state?.selectedBuilding]);

    useEffect(() => {
        if (!state?.isFPS) {
            setFpsAbilityMessage(null);
        }
    }, [state?.isFPS]);

    useEffect(() => {
        return () => {
            if (fpsMessageTimerRef.current) clearTimeout(fpsMessageTimerRef.current);
        };
    }, []);

    const financials = useMemo(() => {
        if (!state) return { income: 0, cost: 0, net: 0, ecoMult: 1, trustMult: 1 };
        return {
            income: state.resources.income,
            cost: state.resources.maintenance,
            net: state.resources.income - state.resources.maintenance,
            ecoMult: 1,
            trustMult: 1
        };
    }, [state?.resources.income, state?.resources.maintenance]);

    const playSfx = useCallback((type: SfxType) => {
        console.log(`[SFX] ${type}`);
    }, []);

    const selectedTileCanOpenModal = useMemo(() => {
        return Boolean(
            selectedTilePos
            && state?.chunks
            && canTileAtPositionOpenModal(state.chunks, selectedTilePos.x, selectedTilePos.z)
        );
    }, [selectedTilePos?.x, selectedTilePos?.z, state?.chunks]);

    const eraModalOpen = Boolean(!showHomePage && !isIntroAnim && state?.eraUnlockedPopup && state.eraUnlockedPopup !== dismissedEraPopup);
    const placementModalOpen = Boolean(!eraModalOpen && !showWorldMap && !state?.isFPS && pendingPlacementPos && state?.selectedBuilding && !isLinePlacementType(state.selectedBuilding));
    const tileModalOpen = Boolean(!eraModalOpen && !showWorldMap && !placementModalOpen && !state?.isFPS && selectedTilePos && selectedTileCanOpenModal);
    const blockingModalOpen = eraModalOpen || showWorldMap || placementModalOpen || tileModalOpen;
    const floatingHudVisible = !blockingModalOpen && !state?.isFPS;
    const sidebarsVisible = !blockingModalOpen && !state?.isFPS;
    const debugVisible = Boolean(state?.debugMode && !eraModalOpen && !showWorldMap && !placementModalOpen && !tileModalOpen);
    const hoverTooltipHidden = Boolean(showHomePage || isIntroAnim || blockingModalOpen || state?.isFPS || linePlacementStart || sidebarOpen !== 'NONE');

    const getFPSAim = useCallback(() => {
        const hit = worldInstance?.getFPSIntersection?.();
        if (!hit) {
            showFPSAbilityMessage('No target in sight. Aim lower at the terrain.');
            return null;
        }
        const aim = createFPSAimTarget(hit, stateRef.current?.chunks);
        if (!aim) {
            showFPSAbilityMessage('That target is outside the generated world.');
            return null;
        }
        return aim;
    }, [showFPSAbilityMessage, worldInstance]);

    const enqueueFPSCommand = useCallback((type: string, payload: any) => {
        const currentState = worldInstance?.getState?.() || stateRef.current;
        if (!currentState?.commandQueue) {
            showFPSAbilityMessage('Command bridge is not ready yet.');
            return false;
        }
        return enqueueFPSQueuedCommand(currentState.commandQueue, type, payload, currentState.tickCount);
    }, [showFPSAbilityMessage, worldInstance]);

    const handleFPSAbility = useCallback((ability: FPSAbility) => {
        const currentState = stateRef.current;
        if (!currentState?.isFPS) return;
        const aim = getFPSAim();
        if (!aim) return;

        const intent = resolveFPSAbilityIntent(ability, currentState, aim);
        if (!intent) return;

        if (intent.command && !enqueueFPSCommand(intent.command.type, intent.command.payload)) {
            return;
        }
        if (intent.dispatchAction) {
            dispatch(intent.dispatchAction);
        }

        showFPSAbilityMessage(intent.message);
        playSfx(intent.sfx);
    }, [dispatch, enqueueFPSCommand, getFPSAim, playSfx, showFPSAbilityMessage]);

    const handleEraModalClose = useCallback(() => {
        const era = stateRef.current?.eraUnlockedPopup;
        if (era) {
            setDismissedEraPopup(era);
        }
        world?.dismissEraPopup?.();
    }, [world]);

    const handleExitFPS = useCallback(() => {
        world?.exitFPS?.();
        dispatch({ type: 'EXIT_FPS' });
        playSfx(SfxType.UI_CLICK);
    }, [dispatch, playSfx, world]);

    const handleToggleDebug = useCallback(() => {
        dispatch({ type: 'TOGGLE_DEBUG' });
        playSfx(SfxType.UI_CLICK);
    }, [dispatch, playSfx]);

    const applyPanelOpenTransition = useCallback((transition: AppPanelOpenTransition) => {
        setShowWorldMap(transition.showWorldMap);
        setSidebarOpen(transition.sidebarOpen);
        setSelectedTilePos(transition.selectedTilePos);
        setActiveHUDBlock(transition.activeHUDBlock);
    }, []);

    const handleSidebarOpen = useCallback((mode: SidebarMode) => {
        clearPlacementPrompt();
        applyPanelOpenTransition(getSidebarOpenTransition(mode));
    }, [applyPanelOpenTransition, clearPlacementPrompt]);

    const handleOpenMap = useCallback(() => {
        clearPlacementPrompt();
        applyPanelOpenTransition(getWorldMapOpenTransition());
        playSfx(SfxType.UI_OPEN);
    }, [applyPanelOpenTransition, clearPlacementPrompt, playSfx]);

    const handleNewGame = () => {
        setDismissedEraPopup(null);
        world?.dismissEraPopup?.();
        applyPanelOpenTransition(getClosedPanelTransition());
        clearPlacementPrompt();
        setShowHomePage(false);
        setIsIntroAnim(true);
        setTimeout(() => setIsIntroAnim(false), 2000);
    };

    const onContinue = () => {
        if (world?.hasSave()) {
            setDismissedEraPopup(null);
            world?.dismissEraPopup?.();
            applyPanelOpenTransition(getClosedPanelTransition());
            clearPlacementPrompt();
            setShowHomePage(false);
            playSfx(SfxType.UI_CLICK);
        }
    };

    const handleHUDToggle = (id: string | null) => setActiveHUDBlock(id);

    const handleToggleView = useCallback(() => {
        dispatch({ type: 'TOGGLE_VIEW' });
        playSfx(SfxType.UI_CLICK);
    }, [dispatch, playSfx]);

    useEffect(() => {
        if (eraModalOpen || showWorldMap || placementModalOpen || tileModalOpen || state?.isFPS) {
            if (sidebarOpen !== 'NONE') setSidebarOpen('NONE');
            if (activeHUDBlock !== null) setActiveHUDBlock(null);
        }
    }, [activeHUDBlock, eraModalOpen, placementModalOpen, showWorldMap, sidebarOpen, state?.isFPS, tileModalOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showHomePage) return;

            if (e.code === 'Escape') {
                e.preventDefault();

                const escapeAction = getEscapeKeyAction({
                    showHomePage,
                    isFPS: Boolean(stateRef.current?.isFPS),
                    eraModalOpen,
                    showWorldMap,
                    hasPendingPlacement: Boolean(pendingPlacementPos),
                    hasSelectedTile: Boolean(selectedTilePos),
                    sidebarOpen,
                });

                if (escapeAction === 'EXIT_FPS') {
                    handleExitFPS();
                    return;
                }

                if (escapeAction === 'DISMISS_ERA') {
                    handleEraModalClose();
                    return;
                }

                if (escapeAction === 'CLOSE_WORLD_MAP') {
                    setShowWorldMap(false);
                    return;
                }

                if (escapeAction === 'CLEAR_PLACEMENT') {
                    clearPlacementPrompt();
                    return;
                }

                if (escapeAction === 'CLEAR_SELECTED_TILE') {
                    setSelectedTilePos(null);
                    return;
                }

                if (escapeAction === 'CLOSE_SIDEBAR') {
                    setSidebarOpen('NONE');
                    return;
                }
            }

            if (stateRef.current?.isFPS) {
                const ability = FPS_ABILITY_BY_KEY[e.code];
                if (ability) {
                    e.preventDefault();
                    handleFPSAbility(ability);
                    return;
                }
            }

            if (e.code === 'KeyU') {
                e.preventDefault();
                handleToggleView();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [clearPlacementPrompt, eraModalOpen, handleEraModalClose, handleExitFPS, handleFPSAbility, handleToggleView, pendingPlacementPos, selectedTilePos, showHomePage, showWorldMap, sidebarOpen]);

    return (
        <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none font-['Inter']">
            <div ref={setContainer} className="absolute inset-0 z-0" />

            {(!world || !state) && (
                <div className="absolute inset-0 z-[1000] bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                    <div className="text-blue-400 text-2xl font-bold mb-4 tracking-tighter">AUREUS ENGINE</div>
                    <div className="relative w-64 h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                        <div className="absolute h-full bg-blue-500 transition-all duration-500" style={{ width: `${loading.percent}%` }} />
                    </div>
                    <div className="text-white/70 text-sm font-mono mb-2">{loading.stage}</div>
                    {loading.error ? (
                        <div className="mt-4 p-4 bg-red-900/40 border border-red-500/50 rounded-lg max-w-md text-red-200 text-sm">
                            <div className="font-bold mb-1">Initialization Failed</div>
                            {loading.error}
                        </div>
                    ) : (
                        <div className="text-white/20 text-xs animate-pulse">Bootstrapping systems...</div>
                    )}
                </div>
            )}

            {world && state && (
                <Routes>
                    <Route path="/" element={
                        <div className="absolute inset-0 pointer-events-none">
                            {showHomePage && (
                                <div className="absolute inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
                                    <HomePage
                                        onStartGame={handleNewGame}
                                        onStartDemo={() => {
                                            setDismissedEraPopup(null);
                                            world?.dismissEraPopup?.();
                                            clearPlacementPrompt();
                                            applyPanelOpenTransition(getClosedPanelTransition());
                                            dispatch({ type: 'START_DEMO' });
                                            setShowHomePage(false);
                                        }}
                                        onContinueGame={onContinue}
                                        hasSave={world.hasSave()}
                                    />
                                </div>
                            )}

                            {eraModalOpen && (
                                <EraUnlockedModal era={state.eraUnlockedPopup} onClose={handleEraModalClose} playSfx={playSfx} />
                            )}

                            {!showHomePage && !isIntroAnim && (
                                <div className="absolute inset-0">
                                    <WeatherOverlay weather={state.weather} />
                                    {state.activeView === 'DUNGEON' && <UndergroundHUD underground={state.underground} />}
                                    <WorldHoverTooltip state={state} tilePos={hoverTilePos} cursor={hoverCursor} hidden={hoverTooltipHidden} />
                                    {!state.isFPS ? (
                                        <>
                                            {floatingHudVisible && (
                                                <>
                                                    <HUD
                                                        resources={state.resources}
                                                        financials={{ net: financials.net }}
                                                        population={state.agents.filter(a => a.type !== 'ILLEGAL_MINER').length}
                                                        currentEra={state.currentEra}
                                                        state={state}
                                                        activeBlock={activeHUDBlock}
                                                        onToggleBlock={handleHUDToggle}
                                                    />
                                                    <Minimap chunks={state.chunks} agents={state.agents} onOpenMap={handleOpenMap} />

                                                    <div className="absolute top-14 left-2 sm:left-4 z-40 flex flex-col gap-2 items-start pointer-events-none">
                                                        <TutorialOverlay step={state.step} dispatch={dispatch} setSidebarOpen={handleSidebarOpen} playSfx={playSfx} />
                                                        <GoalWidget goal={state.activeGoal} dispatch={dispatch} playSfx={playSfx} />
                                                        <AIOverseerPanel state={state} world={worldInstance} playSfx={playSfx} />
                                                        <ContractTracker state={state} world={worldInstance} playSfx={playSfx} />
                                                        <NewsTicker news={state.newsFeed} onDismiss={(id) => dispatch({ type: 'DISMISS_NEWS', payload: id })} playSfx={playSfx} />
                                                    </div>

                                                    <CommandFailureToast result={state.ui?.lastCommandResult} />
                                                    <InventoryHUD inventory={state.inventory} selectedBuilding={state.selectedBuilding} dispatch={dispatch} playSfx={playSfx} step={state.step} />

                                                    <Controls
                                                        selectedBuilding={state.selectedBuilding}
                                                        dispatch={dispatch}
                                                        setSidebarOpen={handleSidebarOpen}
                                                        playSfx={playSfx}
                                                        step={state.step}
                                                        debugMode={state.debugMode}
                                                        interactionMode={state.interactionMode as any}
                                                        undergroundUnlocked={state.underground.unlocked || state.dungeon.unlocked}
                                                        activeView={state.activeView}
                                                        overlayMode={state.logistics.overlayMode}
                                                        selectedAgentId={state.selectedAgentId}
                                                        activeLayer={state.layeredWorld.activeY}
                                                        minLayer={state.layeredWorld.minY}
                                                        maxLayer={state.layeredWorld.surfaceY - 1}
                                                        onToggleView={handleToggleView}
                                                    />
                                                </>
                                            )}

                                            {!eraModalOpen && (
                                                <WorldMap isOpen={showWorldMap} onClose={() => setShowWorldMap(false)} chunks={state.chunks} agents={state.agents} playSfx={playSfx} />
                                            )}

                                            {sidebarsVisible && (
                                                <>
                                                    <OpsDrawer
                                                        isOpen={sidebarOpen === 'OPS'}
                                                        onClose={() => setSidebarOpen('NONE')}
                                                        state={state}
                                                        dispatch={dispatch}
                                                        financials={{ income: financials.income, cost: financials.cost, net: financials.net }}
                                                        ecoMult={financials.ecoMult}
                                                        trustMult={financials.trustMult}
                                                        playSfx={playSfx}
                                                    />
                                                    <SupplySidebar isOpen={sidebarOpen === 'SHOP'} onClose={() => setSidebarOpen('NONE')} state={state} world={worldInstance} dispatch={dispatch} playSfx={playSfx} />
                                                    <TradeTerminal isOpen={sidebarOpen === 'TRADE'} onClose={() => setSidebarOpen('NONE')} state={state} dispatch={dispatch} playSfx={playSfx} />
                                                </>
                                            )}

                                            {tileModalOpen && (
                                                <>
                                                    <ConstructionModal selectedTile={selectedTilePos} chunks={state.chunks} gems={state.resources.gems} dispatch={dispatch} onClose={() => setSelectedTilePos(null)} playSfx={playSfx} />
                                                    <BuildingInspectorModal selectedTile={selectedTilePos} chunks={state.chunks} unlockedEras={state.unlockedEras} resources={state.resources} cheatsEnabled={state.cheatsEnabled} dispatch={dispatch} onClose={() => setSelectedTilePos(null)} playSfx={playSfx} />
                                                </>
                                            )}

                                            {floatingHudVisible && <DialogueOverlay state={state} dispatch={dispatch} playSfx={playSfx} />}
                                        </>
                                    ) : (
                                        <>
                                            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto flex items-center gap-2">
                                                <button
                                                    onClick={handleExitFPS}
                                                    className="bg-slate-900/80 backdrop-blur-md hover:bg-red-600 text-white px-6 py-4 rounded-[4px] border-2 border-slate-700 hover:border-red-900 shadow-2xl font-black text-sm tracking-widest uppercase flex items-center gap-3 transition-all active:scale-95 group font-['Rajdhani']"
                                                >
                                                    <X size={20} className="group-hover:rotate-90 transition-transform" />
                                                    <span>Exit First Person</span>
                                                    <span className="text-[10px] opacity-50 ml-2 font-mono">[ESC]</span>
                                                </button>
                                                <button
                                                    onClick={handleToggleDebug}
                                                    className="bg-slate-900/80 backdrop-blur-md hover:bg-emerald-700 text-emerald-300 hover:text-white px-4 py-4 rounded-[4px] border-2 border-slate-700 hover:border-emerald-500 shadow-2xl font-black text-sm tracking-widest uppercase flex items-center gap-2 transition-all active:scale-95 font-['Rajdhani']"
                                                    title="Open debugger"
                                                >
                                                    <Activity size={18} />
                                                    <span>Debug</span>
                                                </button>
                                            </div>
                                            <FPSAbilityHUD message={fpsAbilityMessage} onAbility={handleFPSAbility} />
                                        </>
                                    )}

                                    {placementModalOpen && (
                                        <MobileBuildingConfirmation
                                            buildingType={state.selectedBuilding && isLinePlacementType(state.selectedBuilding) ? null : state.selectedBuilding}
                                            tilePos={pendingPlacementPos}
                                            onConfirm={() => {
                                                if (worldInstance && pendingPlacementPos !== null) {
                                                    worldInstance.placeBuilding(pendingPlacementPos.x, pendingPlacementPos.z);
                                                    worldInstance.selectBuilding(null);
                                                    clearPlacementPrompt();
                                                }
                                            }}
                                            onCancel={clearPlacementPrompt}
                                            playSfx={playSfx}
                                        />
                                    )}

                                    <LoadingOverlay isVisible={state.isLoading} message={state.loadingMessage || 'Preparing systems...'} />

                                    {debugVisible && (
                                        <div className="pointer-events-auto">
                                            <DebugMenu getDebugStats={getDebugStats} state={state} onClose={() => dispatch({ type: 'TOGGLE_DEBUG' })} dispatch={dispatch} />
                                            <AgentDebugOverlay agents={state.agents} jobs={state.jobs} tickCount={state.tickCount} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {state && <GameOverScreen step={state.step} resources={state.resources} dispatch={dispatch} />}
                        </div>
                    } />
                </Routes>
            )}
        </div>
    );
};

export default App;
