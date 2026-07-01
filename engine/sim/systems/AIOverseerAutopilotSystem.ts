import { BaseSimSystem } from '../Simulation';
import { FixedContext, CommandContext, CommandResult } from '../../kernel/Types';
import { BuildingType, Contract, Era, GameCommand, GameState, GridTile, SfxType } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { ChunkStore } from '../../space/ChunkStore';
import { HARVESTABLE_ROCKS, HARVESTABLE_TREES } from '../../utils/GameUtils';

type OverseerMode = 'OBSERVE' | 'CONTRACTS' | 'STABILITY' | 'GROWTH' | 'AUTOPILOT';
type ResourceKey = 'minerals' | 'gems' | 'wood' | 'stone';
type Point = { x: number; z: number };

type OverseerState = {
    enabled: boolean;
    mode: OverseerMode;
    autoAct: boolean;
    confidence: number;
    currentFocus: string;
    recommendation: string;
    lastAction: string | null;
    nextReviewAt: number;
    actionLog: Array<{ tick: number; label: string }>;
};

type BuildIntent = {
    type: BuildingType;
    reason: string;
    desiredCount?: number;
    minEra?: Era;
};

type InfrastructureNeed = {
    type: BuildingType.ROAD | BuildingType.PIPE | BuildingType.POWER_LINE | BuildingType.FENCE | BuildingType.RAIL_LINE;
    x: number;
    z: number;
    reason: string;
};

const DEFAULT_OVERSEER: OverseerState = {
    enabled: true,
    mode: 'OBSERVE',
    autoAct: false,
    confidence: 0.55,
    currentFocus: 'Reading the colony state',
    recommendation: 'Watching contracts, utilities, workforce, and progression before acting.',
    lastAction: null,
    nextReviewAt: 0,
    actionLog: [],
};

const ERA_ORDER: Record<Era, number> = {
    [Era.SETTLEMENT]: 1,
    [Era.GROWTH]: 2,
    [Era.INDUSTRY]: 3,
    [Era.SUSTAINABILITY]: 4,
    [Era.PROSPERITY]: 5,
};

const RESOURCE_KEY: Record<Contract['resource'], ResourceKey> = {
    MINERALS: 'minerals',
    GEMS: 'gems',
    WOOD: 'wood',
    STONE: 'stone',
};

const RESOURCE_LABEL: Record<Contract['resource'], string> = {
    MINERALS: 'Minerals',
    GEMS: 'Gems',
    WOOD: 'Wood',
    STONE: 'Stone',
};

const BUILD_RESOURCE_LABEL: Record<ResourceKey, string> = {
    minerals: 'Minerals',
    gems: 'Gems',
    wood: 'Wood',
    stone: 'Stone',
};

const INFRASTRUCTURE_TYPES = new Set<BuildingType>([
    BuildingType.ROAD,
    BuildingType.PIPE,
    BuildingType.POWER_LINE,
    BuildingType.FENCE,
    BuildingType.RAIL_LINE,
]);

const STARTER_SPINE: BuildIntent[] = [
    { type: BuildingType.STAFF_QUARTERS, reason: 'first shelter and worker recovery' },
    { type: BuildingType.STORAGE_DEPOT, reason: 'storage for deliveries and worker deposits' },
    { type: BuildingType.SOLAR_ARRAY, reason: 'clean power before utility demand appears' },
    { type: BuildingType.WATER_WELL, reason: 'water supply before utility demand appears' },
    { type: BuildingType.WASH_PLANT, reason: 'first mineral production chain' },
    { type: BuildingType.MINING_HEADFRAME, reason: 'stronger mineral production for contracts' },
    { type: BuildingType.CANTEEN, reason: 'worker hunger recovery' },
];

const FULL_GAME_BUILD_PLAN: BuildIntent[] = [
    ...STARTER_SPINE,
    { type: BuildingType.SOLAR_ARRAY, reason: 'more clean power capacity', desiredCount: 3 },
    { type: BuildingType.WATER_WELL, reason: 'more water capacity', desiredCount: 2 },
    { type: BuildingType.SAWMILL, reason: 'steady construction wood' },
    { type: BuildingType.STONE_QUARRY, reason: 'steady construction stone' },
    { type: BuildingType.STAFF_QUARTERS, reason: 'capacity for recruitment and era growth', desiredCount: 4, minEra: Era.GROWTH },
    { type: BuildingType.STOCKPILE, reason: 'larger storage for industrial resources', desiredCount: 1, minEra: Era.GROWTH },
    { type: BuildingType.GENERATOR, reason: 'backup power for heavier production', desiredCount: 1, minEra: Era.GROWTH },
    { type: BuildingType.WIND_TURBINE, reason: 'cleaner power and eco recovery', desiredCount: 2, minEra: Era.GROWTH },
    { type: BuildingType.COMMUNITY_GARDEN, reason: 'trust and eco-friendly development', desiredCount: 3, minEra: Era.GROWTH },
    { type: BuildingType.MEDICAL_BAY, reason: 'colonist support for larger workforce', desiredCount: 1, minEra: Era.GROWTH },
    { type: BuildingType.TRAINING_CENTER, reason: 'faster workforce skill growth', desiredCount: 1, minEra: Era.GROWTH },
    { type: BuildingType.SECURITY_POST, reason: 'trust and settlement safety', desiredCount: 1, minEra: Era.GROWTH },
    { type: BuildingType.SOCIAL_HUB, reason: 'higher morale and trust', desiredCount: 1, minEra: Era.GROWTH },
    { type: BuildingType.ORE_FOUNDRY, reason: 'industrial materials and alloys', desiredCount: 1, minEra: Era.INDUSTRY },
    { type: BuildingType.WORKSHOP, reason: 'machine parts and automation support', desiredCount: 1, minEra: Era.INDUSTRY },
    { type: BuildingType.DISTRIBUTION_HUB, reason: 'automated logistics throughput', desiredCount: 1, minEra: Era.INDUSTRY },
    { type: BuildingType.TRAIN_STATION, reason: 'regional bulk logistics', desiredCount: 1, minEra: Era.INDUSTRY },
    { type: BuildingType.RAIL_LINE, reason: 'rail network connection', desiredCount: 10, minEra: Era.INDUSTRY },
    { type: BuildingType.GEM_REFINERY, reason: 'premium resource production', desiredCount: 1, minEra: Era.INDUSTRY },
    { type: BuildingType.RECYCLING_PLANT, reason: 'cleaner mineral processing', desiredCount: 1, minEra: Era.INDUSTRY },
    { type: BuildingType.GEOTHERMAL_PLANT, reason: 'stable late-game power', desiredCount: 1, minEra: Era.SUSTAINABILITY },
    { type: BuildingType.WASTE_TREATMENT, reason: 'pollution control for eco recovery', desiredCount: 1, minEra: Era.SUSTAINABILITY },
    { type: BuildingType.NATURE_RESERVE, reason: 'major eco and trust recovery', desiredCount: 2, minEra: Era.SUSTAINABILITY },
    { type: BuildingType.HYDROPONICS, reason: 'advanced food and sustainability support', desiredCount: 1, minEra: Era.SUSTAINABILITY },
    { type: BuildingType.DRONE_DEPOT, reason: 'late-game delivery automation', desiredCount: 1, minEra: Era.SUSTAINABILITY },
    { type: BuildingType.RESERVOIR, reason: 'large-scale water stability', desiredCount: 1, minEra: Era.SUSTAINABILITY },
    { type: BuildingType.MONUMENT, reason: 'prosperity victory landmark', desiredCount: 1, minEra: Era.PROSPERITY },
    { type: BuildingType.SPACEPORT, reason: 'final export economy', desiredCount: 1, minEra: Era.PROSPERITY },
    { type: BuildingType.SAFARI_LODGE, reason: 'prosperity income and eco tourism', desiredCount: 1, minEra: Era.PROSPERITY },
    { type: BuildingType.GREEN_TECH_LAB, reason: 'planetary restoration technology', desiredCount: 1, minEra: Era.PROSPERITY },
];

function getOverseer(state: GameState): OverseerState {
    const existing = (state as any).aiOverseer as Partial<OverseerState> | undefined;
    const normalized: OverseerState = {
        ...DEFAULT_OVERSEER,
        ...existing,
        mode: ['OBSERVE', 'CONTRACTS', 'STABILITY', 'GROWTH', 'AUTOPILOT'].includes(existing?.mode as string)
            ? existing!.mode as OverseerMode
            : DEFAULT_OVERSEER.mode,
        actionLog: Array.isArray(existing?.actionLog) ? existing!.actionLog!.slice(0, 8) : [],
    };
    (state as any).aiOverseer = normalized;
    return normalized;
}

function hasActiveRouteCooldown(agent: GameState['agents'][number], tickCount: number): boolean {
    return Object.values(agent.unreachableCooldowns || {}).some(expiresAt => tickCount < expiresAt);
}

export class AIOverseerSystem extends BaseSimSystem {
    readonly id = 'ai-overseer';
    readonly priority = 9;

    tick(ctx: FixedContext, state: GameState): void {
        const overseer = getOverseer(state);
        if (!overseer.enabled) return;
        if (ctx.time < overseer.nextReviewAt) return;

        overseer.nextReviewAt = ctx.time + (overseer.mode === 'AUTOPILOT' && overseer.autoAct ? 1.5 : 4);
        const insight = this.analyze(state);
        overseer.confidence = insight.confidence;
        overseer.currentFocus = insight.focus;
        overseer.recommendation = insight.recommendation;

        if (overseer.autoAct) {
            this.tryAct(ctx, state, overseer);
        }
    }

    handleCommand(cmd: GameCommand, _ctx: CommandContext, state: GameState): CommandResult | null {
        if ((cmd.type as string) !== 'SET_AI_OVERSEER') return null;
        const overseer = getOverseer(state);
        const payload = cmd.payload || {};

        if (typeof payload.enabled === 'boolean') overseer.enabled = payload.enabled;
        if (typeof payload.autoAct === 'boolean') overseer.autoAct = payload.autoAct;
        if (['OBSERVE', 'CONTRACTS', 'STABILITY', 'GROWTH', 'AUTOPILOT'].includes(payload.mode)) {
            overseer.mode = payload.mode;
        }
        overseer.nextReviewAt = 0;
        this.log(state, overseer, `AI mode: ${overseer.mode}${overseer.autoAct ? ' with auto act' : ''}`);
        return { ok: true };
    }

    private analyze(state: GameState): { focus: string; recommendation: string; confidence: number } {
        const ready = state.contracts.find(contract => this.isReady(contract, state));
        if (ready) {
            return {
                focus: `Ready delivery: ${RESOURCE_LABEL[ready.resource]}`,
                recommendation: `Deliver ${ready.amount} ${RESOURCE_LABEL[ready.resource]} for ${ready.reward.toLocaleString()} AGT.`,
                confidence: 0.94,
            };
        }

        const infrastructure = this.getInfrastructureNeed(state);
        if (infrastructure) {
            const def = BUILDINGS[infrastructure.type];
            return {
                focus: `Layout work: ${def.name}`,
                recommendation: `Place ${def.name} at ${infrastructure.x},${infrastructure.z} to ${infrastructure.reason}.`,
                confidence: 0.86,
            };
        }

        const blockedAgents = state.agents.filter(agent => agent.statusTone === 'blocked' || hasActiveRouteCooldown(agent, state.tickCount));
        if (blockedAgents.length > 0) {
            const sample = blockedAgents[0];
            return {
                focus: 'Blocked agent route',
                recommendation: `${blockedAgents.length} agent${blockedAgents.length === 1 ? '' : 's'} cannot complete a route. ${sample.name}: ${sample.statusReason || 'No route to target.'}`,
                confidence: 0.88,
            };
        }

        const stabilityIntent = this.getStabilityBuildIntent(state);
        if (stabilityIntent) {
            const def = BUILDINGS[stabilityIntent.type];
            return {
                focus: `Stability need: ${def.name}`,
                recommendation: `Build ${def.name} for ${stabilityIntent.reason}.`,
                confidence: 0.84,
            };
        }

        const strategicIntent = this.getStrategicBuildIntent(state);
        if (strategicIntent) {
            const def = BUILDINGS[strategicIntent.type];
            return {
                focus: `Autonomous plan: ${def.name}`,
                recommendation: `Pilot wants ${def.name}: ${strategicIntent.reason}.`,
                confidence: 0.82,
            };
        }

        const available = state.contracts.find(contract => (contract.status || 'AVAILABLE') === 'AVAILABLE');
        if (available) {
            const stock = state.resources[RESOURCE_KEY[available.resource]] || 0;
            const coverage = Math.min(1, stock / Math.max(1, available.amount));
            return {
                focus: `Available contract: ${RESOURCE_LABEL[available.resource]}`,
                recommendation: coverage >= 0.35
                    ? `Accept the ${RESOURCE_LABEL[available.resource]} contract; stock covers ${Math.round(coverage * 100)}%.`
                    : `Build production before accepting the ${RESOURCE_LABEL[available.resource]} contract.`,
                confidence: coverage >= 0.35 ? 0.76 : 0.62,
            };
        }

        if (state.activeGoal && !state.activeGoal.completed) {
            return {
                focus: state.activeGoal.title,
                recommendation: state.activeGoal.description,
                confidence: 0.68,
            };
        }

        return {
            focus: 'Autopilot cruising',
            recommendation: 'No urgent bottleneck. Pilot will keep harvesting, selling surplus, accepting safe contracts, and expanding the build plan.',
            confidence: 0.62,
        };
    }

    private tryAct(ctx: FixedContext, state: GameState, overseer: OverseerState): void {
        if (overseer.mode === 'OBSERVE') return;
        if (state.commandQueue.some(command => String(command.id).startsWith('ai_cmd_'))) return;

        if (this.claimCompletedGoal(state, overseer)) return;

        if (overseer.mode === 'AUTOPILOT') {
            const infra = this.getInfrastructureNeed(state);
            if (infra && this.tryPlaceInfrastructure(ctx, state, overseer, infra)) return;

            const owned = this.getOwnedBuildingToPlace(state);
            if (owned && this.trySupportBuild(ctx, state, overseer, owned)) return;
        }

        if (overseer.mode === 'CONTRACTS' || overseer.mode === 'GROWTH' || overseer.mode === 'AUTOPILOT') {
            const ready = state.contracts.find(contract => this.isReady(contract, state));
            if (ready) {
                this.queueCommand(ctx, state, 'DELIVER_CONTRACT', { contractId: ready.id });
                this.log(state, overseer, `Delivered ${ready.amount} ${RESOURCE_LABEL[ready.resource]}`);
                return;
            }

            const acceptable = state.contracts.find(contract => this.shouldAccept(contract, state));
            if (acceptable) {
                this.queueCommand(ctx, state, 'ACCEPT_CONTRACT', { contractId: acceptable.id });
                this.log(state, overseer, `Accepted ${RESOURCE_LABEL[acceptable.resource]} contract`);
                return;
            }
        }

        if (overseer.mode === 'STABILITY' || overseer.mode === 'AUTOPILOT') {
            const stabilityIntent = this.getStabilityBuildIntent(state);
            if (stabilityIntent && this.trySupportBuild(ctx, state, overseer, stabilityIntent)) return;
        }

        if (overseer.mode === 'GROWTH' || overseer.mode === 'AUTOPILOT') {
            const strategicIntent = this.getStrategicBuildIntent(state);
            if (strategicIntent && this.trySupportBuild(ctx, state, overseer, strategicIntent)) return;

            if (this.tryRaiseAgt(ctx, state, overseer, 10000)) return;
            if (this.tryMarkUsefulHarvest(ctx, state, overseer)) return;
        }
    }

    private claimCompletedGoal(state: GameState, overseer: OverseerState): boolean {
        const goal = state.activeGoal;
        if (!goal?.completed) return false;

        if (goal.reward.type === 'AGT') state.resources.agt += goal.reward.amount;
        else state.resources.gems += goal.reward.amount;

        state.activeGoal = null;
        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.COMPLETE });
        state.newsFeed.unshift({
            id: `ai_goal_claim_${Date.now()}_${state.tickCount}`,
            headline: `AI Overseer claimed completed goal: ${goal.title}.`,
            type: 'POSITIVE',
            timestamp: state.tickCount,
        });
        this.log(state, overseer, `Claimed goal reward: ${goal.title}`);
        return true;
    }

    private getStrategicBuildIntent(state: GameState): BuildIntent | null {
        const storagePressure = this.getStoragePressure(state);
        if (storagePressure > 0.82 && this.isEraAvailable(state, Era.GROWTH)) {
            const type = this.countPlacedBuildings(state, BuildingType.STOCKPILE) > 0 ? BuildingType.STORAGE_DEPOT : BuildingType.STOCKPILE;
            return { type, reason: 'storage is close to capacity', desiredCount: this.countPlacedBuildings(state, type) + 1 };
        }

        const nextEraIntent = this.getNextEraIntent(state);
        if (nextEraIntent) return nextEraIntent;

        for (const intent of FULL_GAME_BUILD_PLAN) {
            if (!this.isBuildIntentAvailable(state, intent)) continue;
            const desired = intent.desiredCount || 1;
            if (this.countPlacedAndOwned(state, intent.type) >= desired) continue;
            return intent;
        }

        return null;
    }

    private getNextEraIntent(state: GameState): BuildIntent | null {
        if (state.currentEra === Era.SETTLEMENT) {
            return STARTER_SPINE.find(intent => this.countPlacedAndOwned(state, intent.type) < (intent.desiredCount || 1)) || null;
        }

        if (state.currentEra === Era.GROWTH) {
            if (state.agents.filter(agent => agent.type !== 'ILLEGAL_MINER').length < 12) {
                return { type: BuildingType.STAFF_QUARTERS, reason: 'more housing capacity for colonist recruitment', desiredCount: this.countPlacedBuildings(state, BuildingType.STAFF_QUARTERS) + 1 };
            }
            if (state.resources.eco < 40) return { type: BuildingType.WIND_TURBINE, reason: 'eco recovery for Industry unlock', desiredCount: 2 };
            if (state.resources.agt < 20000) return { type: BuildingType.MINING_HEADFRAME, reason: 'more mineral output for Industry funding', desiredCount: 2 };
        }

        if (state.currentEra === Era.INDUSTRY) {
            if (state.resources.eco < 70) return { type: BuildingType.RECYCLING_PLANT, reason: 'cleaner industry and eco recovery', desiredCount: 1 };
            if (state.resources.trust < 60) return { type: BuildingType.COMMUNITY_GARDEN, reason: 'trust growth for Sustainability unlock', desiredCount: 3 };
            if (state.resources.agt < 50000) return { type: BuildingType.ORE_FOUNDRY, reason: 'industrial production and cash base', desiredCount: 2 };
        }

        if (state.currentEra === Era.SUSTAINABILITY) {
            if (state.resources.eco < 90) return { type: BuildingType.NATURE_RESERVE, reason: 'eco recovery for Prosperity unlock', desiredCount: 2 };
            if (state.resources.trust < 90) return { type: BuildingType.NATURE_RESERVE, reason: 'trust recovery for Prosperity unlock', desiredCount: 2 };
            if (state.agents.filter(agent => agent.type !== 'ILLEGAL_MINER').length < 25) {
                return { type: BuildingType.STAFF_QUARTERS, reason: 'population capacity for Prosperity unlock', desiredCount: this.countPlacedBuildings(state, BuildingType.STAFF_QUARTERS) + 1 };
            }
        }

        if (state.currentEra === Era.PROSPERITY) {
            if (this.countPlacedAndOwned(state, BuildingType.MONUMENT) === 0) return { type: BuildingType.MONUMENT, reason: 'victory landmark', desiredCount: 1 };
            if (this.countPlacedAndOwned(state, BuildingType.SPACEPORT) === 0) return { type: BuildingType.SPACEPORT, reason: 'final export engine', desiredCount: 1 };
        }

        return null;
    }

    private getStabilityBuildIntent(state: GameState): BuildIntent | null {
        if ((state.powerGrid?.deficit || 0) > 0 || (state.powerGrid?.strandedDemand || 0) > 0) {
            if (this.isEraAvailable(state, Era.SUSTAINABILITY) && !this.hasBuildingOrInventory(state, BuildingType.GEOTHERMAL_PLANT)) {
                return { type: BuildingType.GEOTHERMAL_PLANT, reason: 'stable late-game power capacity' };
            }
            if (!this.hasBuildingOrInventory(state, BuildingType.SOLAR_ARRAY)) {
                return { type: BuildingType.SOLAR_ARRAY, reason: 'clean early power capacity' };
            }
            return { type: BuildingType.POWER_LINE, reason: 'connecting stranded power demand', desiredCount: this.countPlacedBuildings(state, BuildingType.POWER_LINE) + 2 };
        }

        if ((state.waterNetwork?.deficit || 0) > 0) {
            if (this.isEraAvailable(state, Era.SUSTAINABILITY) && !this.hasBuildingOrInventory(state, BuildingType.RESERVOIR)) {
                return { type: BuildingType.RESERVOIR, reason: 'large-scale water stability' };
            }
            if (!this.hasBuildingOrInventory(state, BuildingType.WATER_WELL)) {
                return { type: BuildingType.WATER_WELL, reason: 'basic water supply' };
            }
            return { type: BuildingType.PIPE, reason: 'connecting stranded water demand', desiredCount: this.countPlacedBuildings(state, BuildingType.PIPE) + 2 };
        }

        return null;
    }

    private getOwnedBuildingToPlace(state: GameState): BuildIntent | null {
        for (const intent of FULL_GAME_BUILD_PLAN) {
            if ((state.inventory?.[intent.type] || 0) > 0 && this.isBuildIntentAvailable(state, intent)) return intent;
        }

        for (const [type, count] of Object.entries(state.inventory || {})) {
            const buildingType = type as BuildingType;
            if (!count || count <= 0 || buildingType === BuildingType.EMPTY) continue;
            if (INFRASTRUCTURE_TYPES.has(buildingType)) continue;
            const def = BUILDINGS[buildingType];
            if (!def || !this.isEraAvailable(state, def.era || Era.SETTLEMENT)) continue;
            return { type: buildingType, reason: 'owned building waiting in inventory' };
        }

        return null;
    }

    private trySupportBuild(ctx: FixedContext, state: GameState, overseer: OverseerState, intent: BuildIntent): boolean {
        const def = BUILDINGS[intent.type];
        if (!def || intent.type === BuildingType.EMPTY) return false;
        if (!this.isBuildIntentAvailable(state, intent)) return false;

        if ((state.inventory?.[intent.type] || 0) > 0) {
            const placement = this.findPlannedPlacement(state, intent.type);
            if (!placement) {
                this.log(state, overseer, `Could not place ${def.name}: no clear footprint`);
                return true;
            }
            this.queueCommand(ctx, state, 'PLACE_BUILDING', { x: placement.x, z: placement.z, buildingType: intent.type });
            this.log(state, overseer, `Placed ${def.name}`);
            return true;
        }

        if (!this.hasEnoughAgtForBuild(state, intent.type)) {
            if (!this.tryRaiseAgt(ctx, state, overseer, this.getAgtCost(intent.type))) {
                this.log(state, overseer, `Waiting for AGT to buy ${def.name}`);
            }
            return true;
        }

        const missing = this.getMissingBuildResources(state, intent.type);
        if (missing.length === 0) {
            this.queueCommand(ctx, state, 'BUY_BUILDING', { buildingType: intent.type, cost: def.cost });
            this.log(state, overseer, `Bought ${def.name}`);
            return true;
        }

        const imported = this.tryImportMissingResource(ctx, state, overseer, missing);
        if (!imported) this.log(state, overseer, `Waiting for resources to buy ${def.name}`);
        return true;
    }

    private getInfrastructureNeed(state: GameState): InfrastructureNeed | null {
        const heads = this.getPlacedStructureHeads(state)
            .filter(tile => !tile.isUnderConstruction && !INFRASTRUCTURE_TYPES.has(tile.buildingType));

        for (const head of heads) {
            const road = this.findLineGapToStructure(state, head, BuildingType.ROAD);
            if (road) return { type: BuildingType.ROAD, ...road, reason: `connect ${BUILDINGS[head.buildingType]?.name || 'building'} to the road spine` };
        }

        for (const head of heads) {
            const def = BUILDINGS[head.buildingType];
            if (!def?.power) continue;
            const power = this.findLineGapToStructure(state, head, BuildingType.POWER_LINE);
            if (power) return { type: BuildingType.POWER_LINE, ...power, reason: `connect ${def.name} to the power spine` };
        }

        for (const head of heads) {
            const def = BUILDINGS[head.buildingType];
            if (!def?.water) continue;
            const pipe = this.findLineGapToStructure(state, head, BuildingType.PIPE);
            if (pipe) return { type: BuildingType.PIPE, ...pipe, reason: `connect ${def.name} to the water spine` };
        }

        const fence = this.findFenceGap(state, heads);
        if (fence) return fence;

        return null;
    }

    private tryPlaceInfrastructure(ctx: FixedContext, state: GameState, overseer: OverseerState, need: InfrastructureNeed): boolean {
        const def = BUILDINGS[need.type];
        if (!def) return false;

        if ((state.inventory?.[need.type] || 0) > 0) {
            this.queueCommand(ctx, state, 'PLACE_BUILDING', { x: need.x, z: need.z, buildingType: need.type });
            this.log(state, overseer, `Placed ${def.name}: ${need.reason}`);
            return true;
        }

        if (!this.hasEnoughAgtForBuild(state, need.type)) {
            if (!this.tryRaiseAgt(ctx, state, overseer, this.getAgtCost(need.type))) {
                this.log(state, overseer, `Waiting for AGT to buy ${def.name}`);
            }
            return true;
        }

        const missing = this.getMissingBuildResources(state, need.type);
        if (missing.length > 0) {
            if (!this.tryImportMissingResource(ctx, state, overseer, missing)) {
                this.log(state, overseer, `Waiting for resources to buy ${def.name}`);
            }
            return true;
        }

        this.queueCommand(ctx, state, 'BUY_BUILDING', { buildingType: need.type, cost: def.cost });
        this.log(state, overseer, `Bought ${def.name} for layout`);
        return true;
    }

    private findLineGapToStructure(state: GameState, head: GridTile, lineType: BuildingType): Point | null {
        const def = BUILDINGS[head.buildingType];
        if (!def) return null;

        const width = def.width || 1;
        const depth = def.depth || 1;
        const target = this.findBestAdjacentPoint(state, head.x, head.z, width, depth, lineType);
        if (!target) return null;

        const start = { x: Math.round(state.spawnX || 0), z: Math.round(state.spawnZ || 0) };
        const path = this.makeManhattanPath(start, target);
        for (const point of path) {
            if (this.hasLineAt(state, point.x, point.z, lineType)) continue;
            if (this.canPlaceAt(state, lineType, point.x, point.z, 1, 1)) return point;
        }

        return null;
    }

    private findBestAdjacentPoint(state: GameState, x: number, z: number, width: number, depth: number, lineType: BuildingType): Point | null {
        const candidates: Point[] = [];
        for (let dx = 0; dx < width; dx++) {
            candidates.push({ x: x + dx, z: z - 1 }, { x: x + dx, z: z + depth });
        }
        for (let dz = 0; dz < depth; dz++) {
            candidates.push({ x: x - 1, z: z + dz }, { x: x + width, z: z + dz });
        }

        const centerX = Math.round(state.spawnX || 0);
        const centerZ = Math.round(state.spawnZ || 0);
        return candidates
            .filter(point => this.hasLineAt(state, point.x, point.z, lineType) || this.canPlaceAt(state, lineType, point.x, point.z, 1, 1))
            .sort((a, b) => (Math.abs(a.x - centerX) + Math.abs(a.z - centerZ)) - (Math.abs(b.x - centerX) + Math.abs(b.z - centerZ)))[0] || null;
    }

    private makeManhattanPath(start: Point, target: Point): Point[] {
        const path: Point[] = [];
        const stepX = target.x >= start.x ? 1 : -1;
        for (let x = start.x; x !== target.x; x += stepX) path.push({ x, z: start.z });
        const stepZ = target.z >= start.z ? 1 : -1;
        for (let z = start.z; z !== target.z; z += stepZ) path.push({ x: target.x, z });
        path.push(target);
        return path;
    }

    private hasLineAt(state: GameState, x: number, z: number, lineType: BuildingType): boolean {
        const tile = ChunkStore.getTile(state.chunks, x, z);
        return Boolean(tile && tile.buildingType === lineType);
    }

    private findFenceGap(state: GameState, heads: GridTile[]): InfrastructureNeed | null {
        if (heads.length < 5 || this.countPlacedBuildings(state, BuildingType.FENCE) >= 32) return null;

        const minX = Math.min(...heads.map(tile => tile.x)) - 3;
        const maxX = Math.max(...heads.map(tile => tile.x + (BUILDINGS[tile.buildingType]?.width || 1))) + 2;
        const minZ = Math.min(...heads.map(tile => tile.z)) - 3;
        const maxZ = Math.max(...heads.map(tile => tile.z + (BUILDINGS[tile.buildingType]?.depth || 1))) + 2;
        const edges: Point[] = [];

        for (let x = minX; x <= maxX; x++) edges.push({ x, z: minZ }, { x, z: maxZ });
        for (let z = minZ + 1; z < maxZ; z++) edges.push({ x: minX, z }, { x: maxX, z });

        const target = edges.find(point => !this.hasLineAt(state, point.x, point.z, BuildingType.FENCE) && this.canPlaceAt(state, BuildingType.FENCE, point.x, point.z, 1, 1));
        return target ? { type: BuildingType.FENCE, ...target, reason: 'secure the autonomous settlement perimeter' } : null;
    }

    private findPlannedPlacement(state: GameState, buildingType: BuildingType): Point | null {
        const def = BUILDINGS[buildingType];
        if (!def) return null;

        if (INFRASTRUCTURE_TYPES.has(buildingType)) {
            return this.findPlacement(state, buildingType);
        }

        const width = def.width || 1;
        const depth = def.depth || 1;
        const centerX = Math.round(state.spawnX || 0);
        const centerZ = Math.round(state.spawnZ || 0);
        const placedCount = this.getPlacedStructureHeads(state).filter(tile => !INFRASTRUCTURE_TYPES.has(tile.buildingType)).length;
        const lane = placedCount % 4;
        const laneOffset = Math.floor(placedCount / 4) * 4;
        const seeds: Point[] = [
            { x: centerX + 3 + laneOffset, z: centerZ + lane * 4 },
            { x: centerX - 5 - laneOffset, z: centerZ + lane * 4 },
            { x: centerX + lane * 4, z: centerZ + 3 + laneOffset },
            { x: centerX + lane * 4, z: centerZ - 5 - laneOffset },
        ];

        for (const seed of seeds) {
            const placement = this.searchFrom(state, buildingType, seed.x, seed.z, width, depth, 7);
            if (placement) return placement;
        }

        return this.findPlacement(state, buildingType);
    }

    private searchFrom(state: GameState, buildingType: BuildingType, startX: number, startZ: number, width: number, depth: number, maxRadius: number): Point | null {
        for (let radius = 0; radius <= maxRadius; radius++) {
            for (let dz = -radius; dz <= radius; dz++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
                    const x = startX + dx;
                    const z = startZ + dz;
                    if (this.canPlaceAt(state, buildingType, x, z, width, depth)) return { x, z };
                }
            }
        }
        return null;
    }

    private findPlacement(state: GameState, buildingType: BuildingType): Point | null {
        const def = BUILDINGS[buildingType];
        if (!def) return null;

        const width = def.width || 1;
        const depth = def.depth || 1;
        const centerX = Math.round(state.spawnX || 0);
        const centerZ = Math.round(state.spawnZ || 0);

        for (let radius = 2; radius <= 36; radius++) {
            for (let dz = -radius; dz <= radius; dz++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
                    const x = centerX + dx;
                    const z = centerZ + dz;
                    if (this.canPlaceAt(state, buildingType, x, z, width, depth)) return { x, z };
                }
            }
        }

        return null;
    }

    private canPlaceAt(state: GameState, buildingType: BuildingType, x: number, z: number, width: number, depth: number): boolean {
        const def = BUILDINGS[buildingType];
        if (!def) return false;

        for (let dz = 0; dz < depth; dz++) {
            for (let dx = 0; dx < width; dx++) {
                const tile = ChunkStore.getTile(state.chunks, x + dx, z + dz);
                if (!tile || tile.locked || tile.isUnderConstruction) return false;
                const isEmpty = tile.buildingType === BuildingType.EMPTY;
                const isAllowedWater = tile.buildingType === BuildingType.POND && Boolean(def.waterPlaceable);
                if (!isEmpty && !isAllowedWater) return false;
            }
        }
        return true;
    }

    private getPlacedStructureHeads(state: GameState): GridTile[] {
        const heads: GridTile[] = [];
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (tile.buildingType === BuildingType.EMPTY || !this.isStructureHead(tile)) continue;
                heads.push(tile);
            }
        }
        return heads;
    }

    private countPlacedBuildings(state: GameState, buildingType: BuildingType): number {
        return this.getPlacedStructureHeads(state).filter(tile => tile.buildingType === buildingType).length;
    }

    private countPlacedAndOwned(state: GameState, buildingType: BuildingType): number {
        return this.countPlacedBuildings(state, buildingType) + (state.inventory?.[buildingType] || 0);
    }

    private isStructureHead(tile: GridTile): boolean {
        return tile.structureHeadX === undefined || (tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ);
    }

    private isBuildIntentAvailable(state: GameState, intent: BuildIntent): boolean {
        const def = BUILDINGS[intent.type];
        if (!def || intent.type === BuildingType.EMPTY) return false;
        const requiredEra = intent.minEra || def.era || Era.SETTLEMENT;
        return this.isEraAvailable(state, requiredEra);
    }

    private isEraAvailable(state: GameState, era: Era): boolean {
        return ERA_ORDER[state.currentEra] >= ERA_ORDER[era] || Boolean(state.unlockedEras?.includes(era));
    }

    private hasBuildingOrInventory(state: GameState, buildingType: BuildingType): boolean {
        return this.countPlacedAndOwned(state, buildingType) > 0;
    }

    private hasEnoughAgtForBuild(state: GameState, buildingType: BuildingType): boolean {
        return state.resources.agt >= this.getAgtCost(buildingType);
    }

    private getAgtCost(buildingType: BuildingType): number {
        const def = BUILDINGS[buildingType];
        return Number(def?.costs?.agt ?? def?.cost ?? 0);
    }

    private getMissingBuildResources(state: GameState, buildingType: BuildingType): Array<{ resource: ResourceKey; amount: number }> {
        const def = BUILDINGS[buildingType];
        if (!def?.costs) return [];

        return Object.entries(def.costs)
            .map(([resource, amount]) => ({
                resource: resource as ResourceKey,
                amount: Math.ceil(Math.max(0, Number(amount) - Number((state.resources as any)[resource] || 0))),
            }))
            .filter(item => item.amount > 0 && ['minerals', 'gems', 'wood', 'stone'].includes(item.resource));
    }

    private tryRaiseAgt(ctx: FixedContext, state: GameState, overseer: OverseerState, targetAgt: number): boolean {
        if (state.resources.agt >= targetAgt) return false;

        const sellOrder: ResourceKey[] = ['minerals', 'stone', 'wood', 'gems'];
        const sellTarget = sellOrder.find(resource => state.resources[resource] > this.getReserveForResource(resource));
        if (!sellTarget) return false;

        this.queueCommand(ctx, state, 'SELL_RESOURCE', { resource: sellTarget });
        this.log(state, overseer, `Sold surplus ${BUILD_RESOURCE_LABEL[sellTarget]} for AGT`);
        return true;
    }

    private getReserveForResource(resource: ResourceKey): number {
        if (resource === 'gems') return 20;
        if (resource === 'minerals') return 700;
        return 700;
    }

    private tryImportMissingResource(ctx: FixedContext, state: GameState, overseer: OverseerState, missing: Array<{ resource: ResourceKey; amount: number }>): boolean {
        const target = missing.find(item => item.resource !== 'gems') || missing[0];
        if (!target || target.amount <= 0) return false;
        if (state.resources.agt < 500) return false;

        const amount = Math.max(25, Math.min(400, target.amount));
        this.queueCommand(ctx, state, 'BUY_RESOURCE', { resource: target.resource, amount });
        this.log(state, overseer, `Imported ${amount} ${BUILD_RESOURCE_LABEL[target.resource]}`);
        return true;
    }

    private getStoragePressure(state: GameState): number {
        const cap = Math.max(1, state.resources.maxCapacity || 1);
        const stored = state.resources.minerals + state.resources.wood + state.resources.stone;
        return stored / cap;
    }

    private tryMarkUsefulHarvest(ctx: FixedContext, state: GameState, overseer: OverseerState): boolean {
        if (state.jobs.length > state.agents.length + 3) return false;

        const resource = this.pickNeededHarvestResource(state);
        const target = this.findHarvestTarget(state, resource);
        if (!target) return false;

        this.queueCommand(ctx, state, 'MARK_HARVEST', { x: target.x, z: target.z });
        this.log(state, overseer, `Marked ${resource} harvest target`);
        return true;
    }

    private pickNeededHarvestResource(state: GameState): ResourceKey {
        if (state.resources.wood < 1500) return 'wood';
        if (state.resources.stone < 1500) return 'stone';
        if (state.resources.minerals < 900) return 'minerals';
        return 'wood';
    }

    private findHarvestTarget(state: GameState, resource: ResourceKey): Point | null {
        const centerX = Math.round(state.spawnX || 0);
        const centerZ = Math.round(state.spawnZ || 0);
        let best: { x: number; z: number; distance: number } | null = null;

        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (tile.markedForHarvest || tile.buildingType !== BuildingType.EMPTY) continue;
                const foliage = tile.foliage as any;
                const matches = resource === 'wood'
                    ? HARVESTABLE_TREES.includes(foliage)
                    : resource === 'stone'
                        ? HARVESTABLE_ROCKS.includes(foliage)
                        : foliage === 'GOLD_VEIN' || foliage === 'GOLD_VEIN_VAR';
                if (!matches) continue;

                const distance = Math.abs(tile.x - centerX) + Math.abs(tile.z - centerZ);
                if (!best || distance < best.distance) best = { x: tile.x, z: tile.z, distance };
            }
        }

        return best ? { x: best.x, z: best.z } : null;
    }

    private isReady(contract: Contract, state: GameState): boolean {
        const status = contract.status || 'AVAILABLE';
        if (status !== 'ACCEPTED' && status !== 'READY_TO_DELIVER') return false;
        return (state.resources[RESOURCE_KEY[contract.resource]] || 0) >= contract.amount;
    }

    private shouldAccept(contract: Contract, state: GameState): boolean {
        if ((contract.status || 'AVAILABLE') !== 'AVAILABLE') return false;
        const stock = state.resources[RESOURCE_KEY[contract.resource]] || 0;
        const coverage = stock / Math.max(1, contract.amount);
        if (coverage >= 0.7) return true;
        if (contract.resource === 'MINERALS' && this.hasBuildingOrInventory(state, BuildingType.WASH_PLANT)) return coverage >= 0.25 && contract.reward >= contract.penalty * 2;
        return false;
    }

    private queueCommand(ctx: FixedContext, state: GameState, type: GameCommand['type'], payload: any): void {
        state.commandQueue.push({
            id: ctx.getNextId?.('ai_cmd') || `ai_cmd_${Date.now()}_${type.toLowerCase()}`,
            type,
            payload,
            issuedAtTick: state.tickCount,
        });
    }

    private log(state: GameState, overseer: OverseerState, label: string): void {
        if (overseer.lastAction === label) return;
        overseer.lastAction = label;
        overseer.actionLog = [{ tick: state.tickCount, label }, ...overseer.actionLog].slice(0, 8);
        state.newsFeed.unshift({
            id: `ai_overseer_${Date.now()}_${state.tickCount}`,
            headline: `AI Overseer: ${label}`,
            type: 'NEUTRAL',
            timestamp: state.tickCount,
        });
        state.newsFeed = state.newsFeed.slice(0, 8);
    }
}
