import { Agent, BuildingType, Era, FogExplorationState, GameState, GameStep } from '../../types';
import { INITIAL_PERMITS, INITIAL_NPCS } from '../data/bureaucracy';
import { INITIAL_RESOURCES } from '../data/resources';
import type { ActiveGameDefinitionProvider } from '../game-definition';
import { validateGameCommandForActiveDefinition } from '../game-definition';
import { DAY_NIGHT } from '../sim/dayNightCycle';
import { ChunkStore } from '../space/ChunkStore';
import type { DeterministicCommandInput } from '../net/DeterministicCommand';
import { LockstepCommandBuffer } from '../net/LockstepCommandBuffer';
import { flushLockstepCommandsToQueue } from '../net/LockstepStateBridge';
import { normalizeUndergroundState } from '../underground/UndergroundGenerator';
import { createWeatherState } from '../weather/weatherModel';
import { normalizeLayeredWorldState } from '../worldgen/LayeredWorldGenerator';

export type StateListener = (newState: GameState) => void;

export interface StateManagerOptions {
    lockstepCommandBuffer?: LockstepCommandBuffer | null;
    activeGameDefinitionProvider?: ActiveGameDefinitionProvider | null;
}

type MutableContext = 'none' | 'command' | 'simTick';
type LegacyCommandResultStatus = string | boolean;

type SeededRandom = {
    seed: number;
    next: () => number;
    range: (min: number, max: number) => number;
    rangeInt: (min: number, max: number) => number;
    chance: (probability: number) => boolean;
};

function createSeededRandom(seed: number): SeededRandom {
    let value = (seed >>> 0) || 1;
    return {
        seed: value,
        next: () => {
            value = (value * 1664525 + 1013904223) >>> 0;
            return value / 0x100000000;
        },
        range: (min: number, max: number) => min + ((value = (value * 1664525 + 1013904223) >>> 0) / 0x100000000) * (max - min),
        rangeInt: (min: number, max: number) => Math.floor(min + ((value = (value * 1664525 + 1013904223) >>> 0) / 0x100000000) * (max - min)),
        chance: (probability: number) => ((value = (value * 1664525 + 1013904223) >>> 0) / 0x100000000) < probability,
    };
}

function createStarterAgents(spawnX: number, spawnZ: number): Agent[] {
    const names = ['Mira', 'Juno', 'Tebogo'];
    return names.map((name, index) => ({
        id: `agent-${index + 1}`,
        name,
        type: 'WORKER',
        x: spawnX + index,
        z: spawnZ,
        targetX: null,
        targetZ: null,
        path: null,
        visualX: spawnX + index,
        visualZ: spawnZ,
        state: 'IDLE',
        energy: 100,
        hunger: 100,
        mood: 75,
        skills: {
            mining: 1,
            construction: 1,
            plants: 1,
            intelligence: 1,
        },
        currentJobId: null,
        inventory: {
            type: null,
            amount: 0,
            capacity: 25,
        },
        layer: 0,
        workEfficiency: 1,
        moveSpeed: 1,
        shift: 'DAY',
        consecutiveWorkTicks: 0,
        lastBreakTick: 0,
        profession: null,
        workPlaceX: null,
        workPlaceZ: null,
    }));
}

function clonePermits() {
    return Object.fromEntries(
        Object.entries(INITIAL_PERMITS).map(([id, permit]) => [id, { ...permit }]),
    );
}

function cloneNpcs() {
    return Object.fromEntries(
        Object.entries(INITIAL_NPCS).map(([id, npc]) => [
            id,
            {
                ...npc,
                vulnerability: { ...npc.vulnerability },
                rivals: [...npc.rivals],
                allies: [...npc.allies],
                workHours: { ...npc.workHours },
            },
        ]),
    );
}

function normalizeSelectedAgentIds(selectedAgentId?: string | null, selectedAgentIds?: unknown): string[] {
    if (Array.isArray(selectedAgentIds)) {
        return Array.from(new Set(selectedAgentIds.filter((id): id is string => typeof id === 'string' && id.length > 0)));
    }
    return selectedAgentId ? [selectedAgentId] : [];
}

function normalizeLastCommandResult(
    result: any,
): GameState['ui']['lastCommandResult'] {
    if (!result) return null;
    if (
        typeof result.commandId === 'string' &&
        typeof result.type === 'string' &&
        typeof result.ok === 'boolean'
    ) {
        return result;
    }

    const status = typeof result.status === 'string' ? result.status : undefined;
    return {
        commandId: 'legacy-result',
        type: 'LEGACY',
        ok: status ? ['SUCCESS', 'OK', 'ACCEPTED'].includes(status) : false,
        code: status,
        reason: typeof result.message === 'string' ? result.message : undefined,
    };
}

function normalizeFogExplorationState(fogExploration: any): FogExplorationState {
    const centers = Array.isArray(fogExploration?.centers)
        ? fogExploration.centers.filter((center: any) => (
            typeof center?.key === 'string'
            && typeof center.x === 'number'
            && Number.isFinite(center.x)
            && typeof center.z === 'number'
            && Number.isFinite(center.z)
            && typeof center.radius === 'number'
            && Number.isFinite(center.radius)
            && center.radius > 0
        ))
        : [];

    return {
        centers,
        version: typeof fogExploration?.version === 'number' && Number.isFinite(fogExploration.version)
            ? fogExploration.version
            : centers.length,
    };
}

export class StateManager {
    private state: GameState;
    private listeners = new Set<StateListener>();
    private dirtyKeys = new Set<keyof GameState>();
    private mutableContext: MutableContext = 'none';
    private rng: SeededRandom;
    private lockstepCommandBuffer: LockstepCommandBuffer | null = null;
    private activeGameDefinitionProvider: ActiveGameDefinitionProvider | null = null;

    constructor(overrides?: Partial<GameState>, options?: StateManagerOptions) {
        this.state = this.createInitialState(overrides);
        this.rng = createSeededRandom(this.state.seed);
        this.lockstepCommandBuffer = options?.lockstepCommandBuffer ?? null;
        this.activeGameDefinitionProvider = options?.activeGameDefinitionProvider ?? null;
    }

    private createInitialChunks(seed: number, chunks?: GameState['chunks']): GameState['chunks'] {
        if (chunks && Object.keys(chunks).length > 0) {
            return chunks;
        }

        const initialChunks: GameState['chunks'] = {};
        for (let cx = -1; cx <= 1; cx += 1) {
            for (let cz = -1; cz <= 1; cz += 1) {
                ChunkStore.ensureChunk(initialChunks, cx, cz, seed);
            }
        }
        return initialChunks;
    }

    private createInitialState(overrides?: Partial<GameState>): GameState {
        const seed = overrides?.seed ?? Math.floor(Math.random() * 1000000);
        const spawnX = overrides?.spawnX ?? 0;
        const spawnZ = overrides?.spawnZ ?? 0;
        const initialChunks = this.createInitialChunks(seed, overrides?.chunks);

        const baseState: GameState = {
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
                maxCapacity: INITIAL_RESOURCES.maxCapacity,
            },
            industry: {
                refinedMaterials: 0,
                alloys: 0,
                machineParts: 0,
                automationKits: 0,
                automatedChains: 0,
                gridLoad: 0,
            },
            chunks: initialChunks,
            layeredWorld: normalizeLayeredWorldState(initialChunks, overrides?.layeredWorld),
            agents: createStarterAgents(spawnX, spawnZ),
            ambientNpcs: [],
            jobs: [],
            inventory: {},
            selectedBuilding: null,
            selectedAgentId: null,
            selectedAgentIds: [],
            interactionMode: 'INSPECT',
            step: GameStep.INTRO,
            gameOver: false,
            tickCount: 0,
            idCounter: 0,
            seed,
            spawnX,
            spawnZ,
            fogExploration: { centers: [], version: 0 },
            logistics: {
                autoSell: false,
                sellThreshold: 100,
                overlayMode: 'FLOW',
            },
            factory: undefined,
            activeGoal: null,
            newsFeed: [],
            activeEvents: [],
            research: { unlocked: [] },
            debugMode: false,
            cheatsEnabled: false,
            pendingEffects: [],
            market: {
                minerals: { basePrice: 10, currentPrice: 10, trend: 'STABLE', history: [10], volatility: 0.1 },
                gems: { basePrice: 50, currentPrice: 50, trend: 'STABLE', history: [50], volatility: 0.05 },
                wood: { basePrice: 5, currentPrice: 5, trend: 'STABLE', history: [5], volatility: 0.08 },
                stone: { basePrice: 8, currentPrice: 8, trend: 'STABLE', history: [8], volatility: 0.06 },
                eventDuration: 0,
            },
            contracts: [],
            weather: createWeatherState('CLEAR', 0.2, 180),
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
                gridSize: { x: 32, y: 8, z: 32 },
            },
            underground: normalizeUndergroundState(overrides?.underground),
            dayNightCycle: {
                timeOfDay: DAY_NIGHT.INITIAL_TIME_OF_DAY,
                dayCount: 1,
                isDaytime: true,
            },
            currentEra: Era.SETTLEMENT,
            unlockedEras: [Era.SETTLEMENT],
            eraUnlockedPopup: null,
            powerGrid: {
                totalProduced: 0,
                totalConsumed: 0,
                industrialDemand: 0,
                strandedDemand: 0,
                deficit: 0,
            },
            waterNetwork: {
                totalProduced: 0,
                totalConsumed: 0,
                deficit: 0,
            },
            agentRequests: [],
            experiments: {
                BIOLUMINESCENCE: true,
                GREEDY_MESHING_V2: false,
                HIERARCHICAL_PATHFINDING: false,
                SHARED_BUFFER_TRANSFER: false,
            },
            commandQueue: [],
            isLoading: false,
            loadingMessage: '',
            debug: {
                commandTrace: [],
            },
            ui: {
                lastCommandResult: null,
            },
            bureaucracy: {
                permits: clonePermits(),
                npcs: cloneNpcs(),
                knownNpcIds: ['licensing', 'union'],
                dirtItems: [],
                activeNPCId: null,
                activePermitId: null,
                activeMiniGame: null,
                pendingPermitAction: null,
                activeDialogue: null,
                dialogueTree: {},
                tutorialStep: 0,
            },
        };

        const unlockedEras = overrides?.unlockedEras ?? baseState.unlockedEras;
        const eraUnlockedPopup = overrides?.eraUnlockedPopup && !unlockedEras.includes(overrides.eraUnlockedPopup)
            ? overrides.eraUnlockedPopup
            : null;
        const chunks = this.createInitialChunks(seed, overrides?.chunks);
        const selectedAgentIds = normalizeSelectedAgentIds(overrides?.selectedAgentId, overrides?.selectedAgentIds);

        return {
            ...baseState,
            ...overrides,
            resources: {
                ...baseState.resources,
                ...overrides?.resources,
            },
            industry: {
                ...baseState.industry,
                ...overrides?.industry,
            },
            chunks,
            layeredWorld: normalizeLayeredWorldState(chunks, overrides?.layeredWorld),
            agents: overrides?.agents ?? baseState.agents,
            ambientNpcs: overrides?.ambientNpcs ?? baseState.ambientNpcs,
            jobs: overrides?.jobs ?? baseState.jobs,
            inventory: overrides?.inventory ?? baseState.inventory,
            selectedAgentId: selectedAgentIds[0] ?? overrides?.selectedAgentId ?? null,
            selectedAgentIds,
            fogExploration: normalizeFogExplorationState(overrides?.fogExploration ?? baseState.fogExploration),
            logistics: {
                ...baseState.logistics,
                ...overrides?.logistics,
            },
            research: {
                ...baseState.research,
                ...overrides?.research,
                unlocked: overrides?.research?.unlocked ?? baseState.research.unlocked,
            },
            pendingEffects: overrides?.pendingEffects ?? baseState.pendingEffects,
            contracts: overrides?.contracts ?? baseState.contracts,
            newsFeed: overrides?.newsFeed ?? baseState.newsFeed,
            activeEvents: overrides?.activeEvents ?? baseState.activeEvents,
            weather: overrides?.weather ? createWeatherState(overrides.weather.current, overrides.weather.intensity, overrides.weather.timeLeft) : baseState.weather,
            dungeon: {
                ...baseState.dungeon,
                ...overrides?.dungeon,
            },
            underground: normalizeUndergroundState(overrides?.underground),
            dayNightCycle: {
                ...baseState.dayNightCycle,
                ...overrides?.dayNightCycle,
            },
            unlockedEras,
            eraUnlockedPopup,
            powerGrid: {
                ...baseState.powerGrid,
                ...overrides?.powerGrid,
            },
            waterNetwork: {
                ...baseState.waterNetwork,
                ...overrides?.waterNetwork,
            },
            agentRequests: overrides?.agentRequests ?? baseState.agentRequests,
            experiments: {
                ...baseState.experiments,
                ...overrides?.experiments,
            },
            commandQueue: overrides?.commandQueue ?? baseState.commandQueue,
            debug: {
                ...baseState.debug,
                ...overrides?.debug,
                commandTrace: overrides?.debug?.commandTrace ?? baseState.debug.commandTrace,
            },
            ui: {
                ...baseState.ui,
                ...overrides?.ui,
                lastCommandResult: normalizeLastCommandResult(overrides?.ui?.lastCommandResult),
            },
            bureaucracy: {
                ...baseState.bureaucracy,
                ...overrides?.bureaucracy,
                permits: {
                    ...baseState.bureaucracy.permits,
                    ...overrides?.bureaucracy?.permits,
                },
                npcs: {
                    ...baseState.bureaucracy.npcs,
                    ...overrides?.bureaucracy?.npcs,
                },
                knownNpcIds: overrides?.bureaucracy?.knownNpcIds ?? baseState.bureaucracy.knownNpcIds,
                dirtItems: overrides?.bureaucracy?.dirtItems ?? baseState.bureaucracy.dirtItems,
                dialogueTree: overrides?.bureaucracy?.dialogueTree ?? baseState.bureaucracy.dialogueTree,
            },
        };
    }

    getState(): GameState {
        return this.state;
    }

    getMutableState(): GameState {
        return this.state;
    }

    setMutableContext(context: MutableContext): void {
        this.mutableContext = context;
    }

    getRandom(): SeededRandom {
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

    notifyIfDirty(): void {
        if (this.dirtyKeys.size === 0) return;
        this.listeners.forEach((listener) => listener(this.state));
        this.dirtyKeys.clear();
    }

    markDirty(...keys: (keyof GameState)[]): void {
        keys.forEach((key) => this.dirtyKeys.add(key));
    }

    getDirtyKeys(): Set<keyof GameState> {
        return new Set(this.dirtyKeys);
    }

    mutate<K extends keyof GameState>(key: K, value: GameState[K]): void {
        if (this.mutableContext === 'none') {
            console.warn(`[StateManager] Direct mutation of '${String(key)}' outside sim/command context. Use update() for UI actions.`);
        }
        this.state[key] = value;
        this.markDirty(key);
    }

    update(partial: Partial<GameState>): void {
        Object.assign(this.state, partial);
        this.markDirty(...(Object.keys(partial) as (keyof GameState)[]));
    }

    loadState(newState: GameState): void {
        this.state = this.createInitialState(newState);
        this.rng = createSeededRandom(this.state.seed);
        this.markDirty(...(Object.keys(this.state) as (keyof GameState)[]));
        this.notifyIfDirty();
    }

    serializeState(): string {
        return JSON.stringify(this.state);
    }

    setActiveGameDefinitionProvider(provider: ActiveGameDefinitionProvider | null): void {
        this.activeGameDefinitionProvider = provider;
    }

    private rejectCommandOutsideActiveDefinition(type: string): boolean {
        if (!this.activeGameDefinitionProvider) return false;

        const validation = validateGameCommandForActiveDefinition(this.activeGameDefinitionProvider, type);
        if (validation.ok) return false;

        const commandId = this.getNextId('cmd_reject');
        const reason = validation.reason ?? `Command type ${type} is not declared by the active game definition.`;
        console.warn(`[StateManager] Rejected command '${type}': ${reason}`);
        this.state.ui.lastCommandResult = {
            commandId,
            type,
            ok: false,
            code: 'COMMAND_NOT_DECLARED',
            reason,
        };
        this.markDirty('ui');
        return true;
    }

    pushCommand(type: string, payload?: any): void {
        if (this.rejectCommandOutsideActiveDefinition(type)) {
            return;
        }

        this.state.commandQueue.push({
            id: this.getNextId('cmd'),
            type: type as any,
            payload,
            issuedAtTick: this.state.tickCount,
        });
        this.markDirty('commandQueue');
    }

    setLockstepCommandBuffer(buffer: LockstepCommandBuffer | null): void {
        this.lockstepCommandBuffer = buffer;
    }

    scheduleDeterministicCommand(input: DeterministicCommandInput) {
        if (!this.lockstepCommandBuffer) {
            throw new Error('Lockstep command buffer is not enabled for this StateManager');
        }
        return this.lockstepCommandBuffer.accept(input, this.state.tickCount);
    }

    flushReadyLockstepCommands(): void {
        if (!this.lockstepCommandBuffer) return;
        flushLockstepCommandsToQueue(this.lockstepCommandBuffer, this.state);
        this.markDirty('commandQueue');
    }

    drainCommands(): Array<{ type: string; payload?: any }> {
        const commands = this.state.commandQueue.map(({ type, payload }) => ({ type, payload }));
        this.state.commandQueue = [];
        this.markDirty('commandQueue');
        return commands;
    }

    pushEffect(effect: any): void {
        this.state.pendingEffects.push(effect);
        this.markDirty('pendingEffects');
    }

    setCommandResult(status: LegacyCommandResultStatus, message: string): void {
        const statusText = typeof status === 'string' ? status : status ? 'SUCCESS' : 'ERROR';
        this.state.ui.lastCommandResult = {
            commandId: this.getNextId('result'),
            type: 'LEGACY',
            ok: typeof status === 'boolean' ? status : ['SUCCESS', 'OK', 'ACCEPTED'].includes(status),
            code: statusText,
            reason: message || undefined,
        };
        this.markDirty('ui');
    }
}
