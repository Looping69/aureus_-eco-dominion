import { BaseSimSystem } from '../Simulation';
import { GameState, GameStep, BuildingType, SfxType, Era, GameCommand, GridTile } from '../../../types';
import { FixedContext, CommandContext, CommandResult } from '../../kernel/Types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { ChunkStore } from '../../space/ChunkStore';
import { worldToChunk, CHUNK_SIZE } from '../../utils/coords';
import { updateWaterConnectivity } from '../../utils/GameUtils';

interface DemoTask {
    delay: number;
    run: (ctx: FixedContext, state: GameState) => void;
}

interface BuildingPlacement {
    type: BuildingType;
    x: number;
    z: number;
    level?: number;
}

interface DemoStage {
    delay: number;
    loading?: string;
    headline: string;
    type: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'CRITICAL';
    objective: string;
    placements: BuildingPlacement[];
    resources?: Partial<GameState['resources']>;
    industry?: Partial<NonNullable<GameState['industry']>>;
    era?: Era;
    unlockedEras?: Era[];
    overlayMode?: GameState['logistics']['overlayMode'];
    sfx?: SfxType;
}

const DEMO_DURATION_SECONDS = 300;
const DEMO_AREA = { width: 34, height: 26 };

export class TutorialDemoSystem extends BaseSimSystem {
    readonly id = 'tutorial_demo';
    readonly priority = 200;

    private tasks: DemoTask[] = [];
    private elapsedSinceStart = 0;
    private hasStarted = false;
    private priorCheatsEnabled = false;

    handleCommand(cmd: GameCommand, _ctx: CommandContext, state: GameState): CommandResult | null {
        if (cmd.type !== 'START_DEMO') return null;

        this.tasks = [];
        this.elapsedSinceStart = 0;
        this.hasStarted = false;
        this.priorCheatsEnabled = state.cheatsEnabled;

        state.step = GameStep.DEMO;
        state.gameOver = false;
        state.selectedBuilding = null;
        state.selectedAgentId = null;
        state.interactionMode = 'INSPECT';
        state.newsFeed = [];
        state.activeGoal = null;
        state.activeEvents = [];
        state.contracts = [];
        state.ui.lastCommandResult = null;
        state.debug.commandTrace = [];
        state.isLoading = true;
        state.loadingMessage = 'Preparing guided playthrough...';

        // Demo mode authors a colony directly so it cannot stall on inventory, era, or permit gates.
        state.cheatsEnabled = true;
        state.currentEra = Era.SETTLEMENT;
        state.unlockedEras = [Era.SETTLEMENT];
        state.logistics.overlayMode = 'FLOW';

        return { ok: true };
    }

    tick(ctx: FixedContext, state: GameState): void {
        if (state.step !== GameStep.DEMO) {
            if (this.hasStarted) {
                state.cheatsEnabled = this.priorCheatsEnabled;
            }
            this.hasStarted = false;
            this.tasks = [];
            this.elapsedSinceStart = 0;
            return;
        }

        if (!this.hasStarted) {
            this.startDemoSequence(ctx, state);
            this.hasStarted = true;
        }

        this.elapsedSinceStart += ctx.fixedDt;

        for (let i = this.tasks.length - 1; i >= 0; i--) {
            const task = this.tasks[i];
            if (this.elapsedSinceStart >= task.delay) {
                task.run(ctx, state);
                this.tasks.splice(i, 1);
            }
        }
    }

    private startDemoSequence(ctx: FixedContext, state: GameState): void {
        this.tasks = [];
        this.elapsedSinceStart = 0;

        const originX = state.spawnX - 12;
        const originZ = state.spawnZ - 8;

        this.notify(ctx, state, 'GUIDED DEMO: FIVE-MINUTE COLONY STARTUP BEGINNING.', 'NEUTRAL');
        this.setObjective(state, 'Scout the site and establish a livable starter camp.', BuildingType.STAFF_QUARTERS, 0, 1);

        this.addTask(0, (taskCtx, taskState) => {
            this.prepareDemoSite(taskState, originX, originZ);
            taskState.resources = {
                ...taskState.resources,
                agt: 8500,
                minerals: 180,
                gems: 0,
                wood: 520,
                stone: 360,
                eco: 74,
                trust: 54,
                income: 0,
                maintenance: 0,
            };
            taskState.industry = {
                refinedMaterials: 0,
                alloys: 0,
                machineParts: 0,
                automationKits: 0,
                automatedChains: 0,
                gridLoad: 0,
            };
            this.notify(taskCtx, taskState, 'SITE SURVEY COMPLETE. CREWS ARE MARKING THE FIRST ROADS.', 'NEUTRAL');
        });

        for (const stage of this.getPlaythroughStages(originX, originZ)) {
            this.addTask(stage.delay, (taskCtx, taskState) => this.applyStage(taskCtx, taskState, stage));
        }

        this.addTask(DEMO_DURATION_SECONDS, (taskCtx, taskState) => {
            taskState.cheatsEnabled = this.priorCheatsEnabled;
            taskState.step = GameStep.PLAYING;
            taskState.isLoading = false;
            taskState.loadingMessage = '';
            taskState.selectedBuilding = null;
            taskState.selectedAgentId = null;
            taskState.interactionMode = 'INSPECT';
            taskState.activeGoal = {
                id: 'demo_handoff',
                title: 'Continue the Colony',
                description: 'The demo has built a realistic starter operation. Expand power, stabilize logistics, or push toward underground surveys.',
                type: 'STAT',
                targetType: 'TRUST',
                targetValue: 70,
                currentValue: taskState.resources.trust,
                reward: { type: 'AGT', amount: 1500 },
                completed: false,
            };
            this.notify(taskCtx, taskState, 'DEMO HANDOFF COMPLETE. THE COLONY IS YOURS TO RUN.', 'POSITIVE');
            taskState.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.COMPLETE });
        });
    }

    private getPlaythroughStages(originX: number, originZ: number): DemoStage[] {
        return [
            {
                delay: 3,
                loading: 'Founding starter camp...',
                headline: 'FOUNDATION: QUARTERS, CANTEEN, WELL, AND GENERATOR ONLINE.',
                type: 'POSITIVE',
                objective: 'Keep workers alive before chasing profit.',
                placements: [
                    { type: BuildingType.ROAD, x: originX + 2, z: originZ + 8 },
                    { type: BuildingType.ROAD, x: originX + 3, z: originZ + 8 },
                    { type: BuildingType.ROAD, x: originX + 4, z: originZ + 8 },
                    { type: BuildingType.ROAD, x: originX + 5, z: originZ + 8 },
                    { type: BuildingType.STAFF_QUARTERS, x: originX + 2, z: originZ + 5 },
                    { type: BuildingType.CANTEEN, x: originX + 6, z: originZ + 5 },
                    { type: BuildingType.WATER_WELL, x: originX + 10, z: originZ + 5 },
                    { type: BuildingType.GENERATOR, x: originX + 13, z: originZ + 5 },
                    { type: BuildingType.PIPE, x: originX + 9, z: originZ + 6 },
                    { type: BuildingType.POWER_LINE, x: originX + 12, z: originZ + 6 },
                ],
                resources: { agt: 7600, wood: 410, stone: 290, trust: 57 },
                sfx: SfxType.CAMP_BUILD,
            },
            {
                delay: 35,
                headline: 'EXTRACTION: HEADFRAME, SAWMILL, QUARRY, AND STOCKPILE BUILT.',
                type: 'NEUTRAL',
                objective: 'Feed the first supply chain without overbuilding.',
                placements: [
                    { type: BuildingType.ROAD, x: originX + 5, z: originZ + 9 },
                    { type: BuildingType.ROAD, x: originX + 5, z: originZ + 10 },
                    { type: BuildingType.ROAD, x: originX + 5, z: originZ + 11 },
                    { type: BuildingType.MINING_HEADFRAME, x: originX + 2, z: originZ + 12 },
                    { type: BuildingType.SAWMILL, x: originX + 7, z: originZ + 12 },
                    { type: BuildingType.STONE_QUARRY, x: originX + 11, z: originZ + 12 },
                    { type: BuildingType.STOCKPILE, x: originX + 15, z: originZ + 11 },
                ],
                resources: { agt: 6400, minerals: 240, wood: 580, stone: 470, eco: 70, income: 160, maintenance: 28 },
                sfx: SfxType.BUILD,
            },
            {
                delay: 75,
                headline: 'PROCESSING: WASH PLANT AND FOUNDRY START REFINING ORE.',
                type: 'POSITIVE',
                objective: 'Turn raw extraction into useful industrial stock.',
                placements: [
                    { type: BuildingType.ROAD, x: originX + 6, z: originZ + 8 },
                    { type: BuildingType.ROAD, x: originX + 7, z: originZ + 8 },
                    { type: BuildingType.ROAD, x: originX + 8, z: originZ + 8 },
                    { type: BuildingType.WASH_PLANT, x: originX + 8, z: originZ + 8 },
                    { type: BuildingType.ORE_FOUNDRY, x: originX + 13, z: originZ + 8 },
                    { type: BuildingType.PIPE, x: originX + 10, z: originZ + 7 },
                    { type: BuildingType.POWER_LINE, x: originX + 12, z: originZ + 7 },
                    { type: BuildingType.POWER_LINE, x: originX + 13, z: originZ + 7 },
                ],
                resources: { agt: 5200, minerals: 310, eco: 65, income: 260, maintenance: 56 },
                industry: { refinedMaterials: 18, alloys: 6, gridLoad: 3 },
                era: Era.GROWTH,
                unlockedEras: [Era.SETTLEMENT, Era.GROWTH],
                sfx: SfxType.BUILD,
            },
            {
                delay: 115,
                headline: 'UTILITIES: SOLAR, WIND, AND WATER LINKS REDUCE OPERATING RISK.',
                type: 'POSITIVE',
                objective: 'Balance power and water before the factory grows.',
                placements: [
                    { type: BuildingType.SOLAR_ARRAY, x: originX + 18, z: originZ + 3 },
                    { type: BuildingType.WIND_TURBINE, x: originX + 22, z: originZ + 5 },
                    { type: BuildingType.POWER_LINE, x: originX + 17, z: originZ + 6 },
                    { type: BuildingType.POWER_LINE, x: originX + 18, z: originZ + 6 },
                    { type: BuildingType.POWER_LINE, x: originX + 19, z: originZ + 6 },
                    { type: BuildingType.WATER_WELL, x: originX + 20, z: originZ + 10 },
                    { type: BuildingType.PIPE, x: originX + 19, z: originZ + 10 },
                    { type: BuildingType.PIPE, x: originX + 18, z: originZ + 10 },
                ],
                resources: { agt: 4550, eco: 67, trust: 60, income: 320, maintenance: 74 },
                sfx: SfxType.BUILD,
            },
            {
                delay: 155,
                headline: 'LOGISTICS: STORAGE, WORKSHOP, AND DISTRIBUTION HUB TAKE PRESSURE OFF WORKERS.',
                type: 'NEUTRAL',
                objective: 'Watch materials move instead of pretending buildings are trophies.',
                placements: [
                    { type: BuildingType.ROAD, x: originX + 16, z: originZ + 9 },
                    { type: BuildingType.ROAD, x: originX + 17, z: originZ + 9 },
                    { type: BuildingType.ROAD, x: originX + 18, z: originZ + 9 },
                    { type: BuildingType.STORAGE_DEPOT, x: originX + 18, z: originZ + 11 },
                    { type: BuildingType.WORKSHOP, x: originX + 21, z: originZ + 11 },
                    { type: BuildingType.DISTRIBUTION_HUB, x: originX + 24, z: originZ + 10 },
                ],
                resources: { agt: 3600, minerals: 380, wood: 650, stone: 530, income: 410, maintenance: 110 },
                industry: { refinedMaterials: 42, alloys: 14, machineParts: 8, gridLoad: 5 },
                era: Era.INDUSTRY,
                unlockedEras: [Era.SETTLEMENT, Era.GROWTH, Era.INDUSTRY],
                overlayMode: 'FLOW',
                sfx: SfxType.COMPLETE,
            },
            {
                delay: 205,
                headline: 'CIVIL BALANCE: GARDEN, SCHOOL, SECURITY, AND RECYCLING OFFSET THE DIRTY CORE.',
                type: 'POSITIVE',
                objective: 'Stability is part of the production chain.',
                placements: [
                    { type: BuildingType.COMMUNITY_GARDEN, x: originX + 2, z: originZ + 1 },
                    { type: BuildingType.LOCAL_SCHOOL, x: originX + 6, z: originZ + 1 },
                    { type: BuildingType.SECURITY_POST, x: originX + 10, z: originZ + 1 },
                    { type: BuildingType.RECYCLING_PLANT, x: originX + 14, z: originZ + 1 },
                    { type: BuildingType.ROAD, x: originX + 2, z: originZ + 4 },
                    { type: BuildingType.ROAD, x: originX + 6, z: originZ + 4 },
                    { type: BuildingType.ROAD, x: originX + 10, z: originZ + 4 },
                    { type: BuildingType.ROAD, x: originX + 14, z: originZ + 4 },
                ],
                resources: { agt: 3100, eco: 72, trust: 66, income: 455, maintenance: 138 },
                sfx: SfxType.BUILD,
            },
            {
                delay: 250,
                headline: 'EXPANSION: RAIL STUB AND SURVEY DRILL PREPARE THE NEXT FIVE MINUTES.',
                type: 'NEUTRAL',
                objective: 'The demo ends with choices, not a finished poster.',
                placements: [
                    { type: BuildingType.TRAIN_STATION, x: originX + 24, z: originZ + 15 },
                    { type: BuildingType.RAIL_LINE, x: originX + 22, z: originZ + 16 },
                    { type: BuildingType.RAIL_LINE, x: originX + 23, z: originZ + 16 },
                    { type: BuildingType.RAIL_LINE, x: originX + 26, z: originZ + 16 },
                    { type: BuildingType.RAIL_LINE, x: originX + 27, z: originZ + 16 },
                    { type: BuildingType.SURVEY_DRILL, x: originX + 29, z: originZ + 7 },
                ],
                resources: { agt: 2600, minerals: 460, gems: 3, income: 520, maintenance: 170, trust: 68 },
                industry: { refinedMaterials: 60, alloys: 22, machineParts: 15, automationKits: 2, automatedChains: 1, gridLoad: 7 },
                overlayMode: 'JUNCTIONS',
                sfx: SfxType.COMPLETE,
            },
        ];
    }

    private addTask(delay: number, run: (ctx: FixedContext, state: GameState) => void): void {
        this.tasks.push({ delay, run });
    }

    private applyStage(ctx: FixedContext, state: GameState, stage: DemoStage): void {
        if (stage.loading) {
            state.loadingMessage = stage.loading;
        }

        this.applyPlacementsDirect(state, stage.placements);

        if (stage.resources) {
            state.resources = { ...state.resources, ...stage.resources };
        }

        if (stage.industry) {
            state.industry = { ...(state.industry || {
                refinedMaterials: 0,
                alloys: 0,
                machineParts: 0,
                automationKits: 0,
                automatedChains: 0,
                gridLoad: 0,
            }), ...stage.industry };
        }

        if (stage.era) {
            state.currentEra = stage.era;
        }

        if (stage.unlockedEras) {
            state.unlockedEras = [...stage.unlockedEras];
        }

        if (stage.overlayMode) {
            state.logistics.overlayMode = stage.overlayMode;
        }

        state.isLoading = false;
        state.loadingMessage = '';
        this.setObjective(state, stage.objective, stage.placements[0]?.type || BuildingType.ROAD, 1, 1);
        this.notify(ctx, state, stage.headline, stage.type);
        state.pendingEffects.push({ type: 'AUDIO', sfx: stage.sfx || SfxType.BUILD });
    }

    private prepareDemoSite(state: GameState, originX: number, originZ: number): void {
        const placements: BuildingPlacement[] = [];

        for (let x = 0; x <= DEMO_AREA.width; x++) {
            placements.push({ type: BuildingType.ROAD, x: originX + x, z: originZ + 8 });
        }
        for (let z = 2; z <= 20; z++) {
            placements.push({ type: BuildingType.ROAD, x: originX + 5, z: originZ + z });
            placements.push({ type: BuildingType.ROAD, x: originX + 18, z: originZ + z });
        }

        this.clearDemoArea(state, originX, originZ, DEMO_AREA.width, DEMO_AREA.height);
        this.applyPlacementsDirect(state, placements);
        updateWaterConnectivity(state.chunks);
    }

    private clearDemoArea(state: GameState, originX: number, originZ: number, width: number, height: number): void {
        const affectedChunks = new Map<string, GridTile[]>();

        for (let z = -2; z <= height; z++) {
            for (let x = -2; x <= width; x++) {
                const tile = this.touchTile(state, originX + x, originZ + z, affectedChunks);
                Object.assign(tile, {
                    buildingType: BuildingType.EMPTY,
                    level: 0,
                    isUnderConstruction: false,
                    constructionTimeLeft: 0,
                    structureHeadX: undefined,
                    structureHeadZ: undefined,
                    foliage: 'NONE',
                    markedForHarvest: false,
                    revealed: true,
                    explored: true,
                });
            }
        }

        this.emitChunkUpdates(state, affectedChunks);
    }

    private applyPlacementsDirect(state: GameState, placements: BuildingPlacement[]): void {
        const affectedChunks = new Map<string, GridTile[]>();

        for (const placement of placements) {
            this.placeDirect(state, placement, affectedChunks);
        }

        updateWaterConnectivity(state.chunks);
        this.emitChunkUpdates(state, affectedChunks);
    }

    private placeDirect(state: GameState, placement: BuildingPlacement, affectedChunks: Map<string, GridTile[]>): void {
        const def = BUILDINGS[placement.type];
        if (!def) return;

        const width = def.width || 1;
        const depth = def.depth || 1;

        for (let dz = 0; dz < depth; dz++) {
            for (let dx = 0; dx < width; dx++) {
                const tile = this.touchTile(state, placement.x + dx, placement.z + dz, affectedChunks);
                Object.assign(tile, {
                    buildingType: placement.type,
                    level: placement.level || 1,
                    isUnderConstruction: false,
                    constructionTimeLeft: 0,
                    structureHeadX: placement.x,
                    structureHeadZ: placement.z,
                    foliage: 'NONE',
                    markedForHarvest: false,
                    revealed: true,
                    explored: true,
                });
            }
        }
    }

    private touchTile(state: GameState, x: number, z: number, affectedChunks: Map<string, GridTile[]>): GridTile {
        const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
        ChunkStore.ensureChunk(state.chunks, cx, cz, state.seed);
        const tile = ChunkStore.getTile(state.chunks, x, z);
        if (!tile) {
            throw new Error(`Demo playthrough failed to resolve tile at (${x}, ${z})`);
        }

        const key = `${cx},${cz}`;
        const updates = affectedChunks.get(key);
        if (updates) {
            if (!updates.includes(tile)) updates.push(tile);
        } else {
            affectedChunks.set(key, [tile]);
        }

        const chunk = state.chunks[key];
        if (chunk) {
            chunk.meshDirty = true;
            chunk.simDirty = true;
        }

        return tile;
    }

    private emitChunkUpdates(state: GameState, affectedChunks: Map<string, GridTile[]>): void {
        for (const [key, updates] of affectedChunks.entries()) {
            const [cx, cz] = key.split(',').map(Number);
            state.pendingEffects.push({ type: 'CHUNK_UPDATE', cx, cz, updates });
        }
    }

    private setObjective(
        state: GameState,
        description: string,
        targetType: BuildingType,
        currentValue: number,
        targetValue: number,
    ): void {
        state.activeGoal = {
            id: 'guided_demo_objective',
            title: 'Guided Playthrough',
            description,
            type: 'BUILD',
            targetType,
            targetValue,
            currentValue,
            reward: { type: 'AGT', amount: 0 },
            completed: currentValue >= targetValue,
        };
    }

    private notify(ctx: FixedContext, state: GameState, message: string, type: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'CRITICAL'): void {
        state.newsFeed.unshift({
            id: ctx.getNextId?.('demo_msg') || `msg_${Date.now()}_${Math.random()}`,
            headline: message,
            type,
            timestamp: state.tickCount,
        });

        state.newsFeed = state.newsFeed.slice(0, 8);
    }
}
