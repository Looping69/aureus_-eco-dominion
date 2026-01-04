/**
 * useEngineState
 * React hook to subscribe to engine state changes.
 * Replaces useReducer for game state management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState } from '../types';
import { AureusWorld } from './AureusWorld';

export function useEngineState(world: AureusWorld | null) {
    const [state, setState] = useState<GameState | null>(null);
    const stateRef = useRef<GameState | null>(null);

    useEffect(() => {
        if (!world) return;

        // Get initial state
        const initial = world.getState();
        setState(initial);
        stateRef.current = initial;

        // Subscribe to changes
        const unsubscribe = world.subscribeToState((newState) => {
            stateRef.current = newState;
            setState(newState);
        });

        return unsubscribe;
    }, [world]);

    // For synchronous access without triggering re-render
    const getStateRef = useCallback(() => stateRef.current, []);

    return { state, getStateRef };
}

/**
 * Action dispatcher for UI -> Engine communication
 * Replaces React dispatch({ type: ... })
 */
export interface EngineActions {
    placeBuilding: (index: number, type?: string) => void;
    bulldozeTile: (index: number) => void;
    selectBuilding: (type: string | null) => void;
    selectAgent: (id: string | null) => void;
    commandAgent: (agentId: string, tileId: number) => void;
    setInteractionMode: (mode: 'BUILD' | 'BULLDOZE' | 'INSPECT') => void;
    sellMinerals: () => void;
    setAutoSell: (enabled: boolean, threshold: number) => void;
    researchTech: (techId: string) => void;
    toggleDebug: () => void;
    saveGame: () => void;
    loadGame: (data: string) => void;
    speedUpConstruction: (index: number) => void;
    acceptContract: (contractId: string) => void;
    deliverContract: (contractId: string) => void;
}

export function useEngineActions(world: AureusWorld | null): EngineActions {
    return {
        placeBuilding: useCallback((index: number, type?: string) => {
            world?.placeBuilding(index, type);
        }, [world]),

        bulldozeTile: useCallback((index: number) => {
            world?.bulldozeTile(index);
        }, [world]),

        selectBuilding: useCallback((type: string | null) => {
            world?.selectBuilding(type);
        }, [world]),

        selectAgent: useCallback((id: string | null) => {
            world?.selectAgent(id);
        }, [world]),

        commandAgent: useCallback((agentId: string, tileId: number) => {
            world?.commandAgent(agentId, tileId);
        }, [world]),

        setInteractionMode: useCallback((mode: 'BUILD' | 'BULLDOZE' | 'INSPECT') => {
            world?.setInteractionMode(mode);
        }, [world]),

        sellMinerals: useCallback(() => {
            world?.sellMinerals();
        }, [world]),

        setAutoSell: useCallback((enabled: boolean, threshold: number) => {
            world?.setAutoSell(enabled, threshold);
        }, [world]),

        researchTech: useCallback((techId: string) => {
            world?.researchTech(techId);
        }, [world]),

        toggleDebug: useCallback(() => {
            world?.toggleDebug();
        }, [world]),

        saveGame: useCallback(() => {
            world?.saveGame();
        }, [world]),

        loadGame: useCallback((data: string) => {
            world?.loadGame(data);
        }, [world]),

        speedUpConstruction: useCallback((index: number) => {
            world?.speedUpConstruction(index);
        }, [world]),

        acceptContract: useCallback((contractId: string) => {
            world?.acceptContract(contractId);
        }, [world]),

        deliverContract: useCallback((contractId: string) => {
            world?.deliverContract(contractId);
        }, [world]),
    };
}
