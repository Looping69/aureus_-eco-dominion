import { GameState, Agent, BuildingType, Era, ResourceNode, NewsType, TechId, CommandResultStatus, TimeOfDay, PowerGridState, InteractionMode, LogisticsOverlayMode } from '../../types';
import { INITIAL_RESOURCES, INITIAL_PERMITS, INITIAL_NPCS, INITIAL_AMBIENT_NPCS, DAY_NIGHT, STARTING_AGENTS, TECH_TREE } from '../data/VoxelConstants';
import { generateTerrainSeeded } from '../worldgen/Core';
import { ChunkStore } from '../space/ChunkStore';
import { createRNG } from '../utils/RNG';
import { createWeatherState } from '../weather/weatherModel';
import { normalizeUndergroundState } from '../underground/UndergroundGenerator';

export type StateListener = () => void;

export class StateManager {
    private state: GameState;
    private listeners = new Set<StateListener>();
    private dirtyKeys = new Set<keyof GameState>();
    private pendingCommands: Array<{ type: string; payload?: any }> = [];
    private mutableContext: 'none' | 'command' | 'simTick' = 'none';
    private commandResult: { status: CommandResultStatus; message: string } | null = null;
    private rng = createRNG();

    constructor() {
        this.state = this.createInitialState();
        this.rng = createRNG(this.state.seed);
    }

    private createInitialState(overrides?: Partial<GameState>): GameState {
        const seed = overrides?.seed || Math.floor(Math.random() * 1000000);
        const terrain = generateTerrainSeeded(seed);
        const chunks = ChunkStore.fromGrid(terrain.grid);
        const spawnX = terrain.startingPoints?.[0]?.x || 0;
        const spawnZ = terrain.startingPoints?.[0]?.z || 0;

        return {
            chunks,
            agents: STARTING_AGENTS.map((agent, index) => ({
                ...agent,
                id: `agent-${index + 1}`,
                x: spawnX + index,
                z: spawnZ,
                homeX: spawnX + index,
                homeZ: spawnZ,
            })),
            ambientNpcs: INITIAL_AMBIENT_NPCS.map((npc, index) => ({
                ...npc,
                id: `ambient-${index + 1}`,
            })),
            resources: {
                agt: INITIAL_RESOURCES.agt,
                minerals: INITIAL_RESOURCES.minerals,
                gems: INITIAL_RESOURCES.gems,
                wood: INITIAL_RESOURCES.wood,
                stone: INITIAL_RESOURCES.stone,
                eco: INITIAL_RESOURCES.eco,
                trust: INITIAL_RESOURCES.trust,
                income: 0,
                maintenance: 0,
                maxCapacity: 1000,
            },

            selectedBuilding: null,
            selectedAgentId: null,
            interactionMode: 'INSPECT',
            step: GameStep.INTRO,
            activeView: 'SURFACE',
            isFPS: false,
            dungeon: {
                unlocked: false,
                miners: [],
                buildings: [],
                renderVersion: 0,
                gold: 0,
                gems: 0,
                mana: 0,
                logs: [],
                voxelData: null,
                revealedData: null,
                gridSize: { x: 32, y: 8, z: 32 }
            },

            gameOver: false,
            debugMode: false,
            cheatsEnabled: false,
            tickCount: 0,
            idCounter: 0,
            seed,
            spawnX,
            spawnZ,

            market: {
                minerals: { basePrice: 10, currentPrice: 10, trend: 'STABLE', history: [10], volatility: 0.1 },
                gems: { basePrice: 50, currentPrice: 50, trend: 'STABLE', history: [50], volatility: 0.05 },
                wood: { basePrice: 5, currentPrice: 5, trend: 'STABLE', history: [5], volatility: 0.08 },
                stone: { basePrice: 8, currentPrice: 8, trend: 'STABLE', history: [8], volatility: 0.06 },
                eventDuration: 0,
            },

            weather: createWeatherState('CLEAR', 0.2, 180),
            activeEvents: [],
            newsFeed: [],
            activeGoal: null,
            inventory: {},
            research: { unlocked: [] },
            contracts: [],
            pendingEffects: [],

            experiments: {
                BIOLUMINESCENCE: true,
                GREEDY_MESHING_V2: false,
                HIERARCHICAL_PATHFINDING: false,
                SHARED_BUFFER_TRANSFER: false,
            },

            dayNightCycle: {
                timeOfDay: DAY_NIGHT.INITIAL_TIME_OF_DAY,
                dayCount: 1,
                isDaytime: true,
            },

            agentRequests: [],
            currentEra: Era.SETTLEMENT,
            unlockedEras: [Era.SETTLEMENT],
            eraUnlockedPopup: null,

            waterNetwork: { totalProduced: 0, totalConsumed: 0, deficit: 0 },

            bureaucracy: {
                permits: { ...INITIAL_PERMITS },
                npcs: { ...INITIAL_NPCS },
                knownNpcIds: ['licensing', 'union'],
                dirtItems: [],
                activeNPCId: null,
                activePermitId: null,
                activeMiniGame: null,
                pendingPermitAction: null,
                tutorialStep: 0,
                activeDialogue: null,
                dialogueTree: null
            },

            isLoading: false,
            loadingMessage: '',
            debug: { commandTrace: [] },
            ui: { lastCommandResult: null },

            ...overrides,
            logistics: {
                autoSell: overrides?.logistics?.autoSell ?? false,
                sellThreshold: overrides?.logistics?.sellThreshold ?? 100,
                overlayMode: overrides?.logistics?.overlayMode ?? 'FLOW',
            },
            powerGrid: {
                totalProduced: overrides?.powerGrid?.totalProduced ?? 0,
                totalConsumed: overrides?.powerGrid?.totalConsumed ?? 0,
                industrialDemand: overrides?.powerGrid?.industrialDemand ?? 0,
                strandedDemand: overrides?.powerGrid?.strandedDemand ?? 0,
                deficit: overrides?.powerGrid?.deficit ?? 0,
            },
            industry: {
                refinedMaterials: overrides?.industry?.refinedMaterials ?? 0,
                alloys: overrides?.industry?.alloys ?? 0,
                machineParts: overrides?.industry?.machineParts ?? 0,
                automationKits: overrides?.industry?.automationKits ?? 0,
                automatedChains: overrides?.industry?.automatedChains ?? 0,
                gridLoad: overrides?.industry?.gridLoad ?? 0,
            },
            underground: normalizeUndergroundState(overrides?.underground),
        } as GameState;
    }

    getState(): GameState {
        return this.state;
    }

    getMutableState(): GameState {
        return this.state;
    }

    setMutableContext(context: 'none' | 'command' | 'simTick') {
        this.mutableContext = context;
    }

    getRandom() {
        return this.rng;
    }

    getNextId(prefix: string): string {
        this.state.idCounter += 1;
        this.markDirty('idCounter');
        return `${prefix}_${this.state.idCounter}`;
    }

    subscribe(listener: StateListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notifyIfDirty() {
        if (this.dirtyKeys.size === 0) return;
        this.listeners.forEach(listener => listener());
        this.dirtyKeys.clear();
    }

    markDirty(...keys: (keyof GameState)[]) {
        keys.forEach(key => this.dirtyKeys.add(key));
    }

    getDirtyKeys(): Set<keyof GameState> {
        return new Set(this.dirtyKeys);
    }

    mutate<K extends keyof GameState>(key: K, value: GameState[K]) {
        if (this.mutableContext === 'none') {
            console.warn(`[StateManager] Direct mutation of '${String(key)}' outside sim/command context. Use update() for UI actions.`);
        }
        (this.state as any)[key] = value;
        this.markDirty(key);
    }

    update(partial: Partial<GameState>) {
        Object.assign(this.state, partial);
        this.markDirty(...Object.keys(partial) as (keyof GameState)[]);
    }

    loadState(newState: GameState) {
        this.state = newState;
        this.rng = createRNG(this.state.seed);
        this.markDirty(...Object.keys(newState) as (keyof GameState)[]);
        this.notifyIfDirty();
    }

    pushCommand(type: string, payload?: any) {
        this.pendingCommands.push({ type, payload });
    }

    drainCommands(): Array<{ type: string; payload?: any }> {
        const commands = [...this.pendingCommands];
        this.pendingCommands.length = 0;
        return commands;
    }

    pushEffect(effect: any) {
        this.state.pendingEffects.push(effect);
        this.markDirty('pendingEffects');
    }

    setCommandResult(status: CommandResultStatus, message: string) {
        this.commandResult = { status, message };
        this.state.ui.lastCommandResult = this.commandResult;
        this.markDirty('ui');
    }
}

enum GameStep {
    INTRO = 'INTRO',
    RUNNING = 'RUNNING',
    GAME_OVER = 'GAME_OVER',
}
