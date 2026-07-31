import { BaseSimSystem } from '../Simulation';
import { FixedContext, CommandContext, CommandResult } from '../../kernel/Types';
import { BuildingType, Contract, Era, GameCommand, GameState, GridTile, SfxType } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { ChunkStore } from '../../space/ChunkStore';
import { HARVESTABLE_ROCKS, HARVESTABLE_TREES } from '../../utils/GameUtils';
import {
    createGameCommandCandidate,
    createGameCommandCandidateEnvelope,
    createGameCommandCandidateId,
    GAME_COMMAND_CANDIDATE_SOURCES,
} from '../../game-definition';

type OverseerMode = 'OBSERVE' | 'CONTRACTS' | 'STABILITY' | 'GROWTH' | 'AUTOPILOT';
type OverseerPilotProvider = 'HEURISTIC' | 'LOCAL_QWEN';
type ResourceKey = 'minerals' | 'gems' | 'wood' | 'stone';
type Point = { x: number; z: number };
type PlacementZone = 'CORE' | 'RESIDENTIAL' | 'PRODUCTION' | 'UTILITY' | 'ECO' | 'LOGISTICS';

type OverseerState = {
    enabled: boolean;
    mode: OverseerMode;
    autoAct: boolean;
    pilotProvider: OverseerPilotProvider;
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

const DEFAULT_OVERSEER: OverseerState = {
    enabled: true,
    mode: 'OBSERVE',
    autoAct: false,
    pilotProvider: 'HEURISTIC',
    confidence: 0.55,
    currentFocus: 'Reading the colony state',
    recommendation: 'Watching contracts, utilities, workforce, and progression before acting.',
    lastAction: null,
    nextReviewAt: 0,
    actionLog: [],
};

const HEURISTIC_OVERSEER_COMMAND_REASON = 'AI Overseer heuristic autopilot';

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

const PRODUCTION_TYPES = new Set<BuildingType>([
    BuildingType.WASH_PLANT,
    BuildingType.MINING_HEADFRAME,
    BuildingType.SAWMILL,
    BuildingType.STONE_QUARRY,
    BuildingType.ORE_FOUNDRY,
    BuildingType.WORKSHOP,
    BuildingType.GEM_REFINERY,
    BuildingType.RECYCLING_PLANT,
]);

const UTILITY_TYPES = new Set<BuildingType>([
    BuildingType.SOLAR_ARRAY,
    BuildingType.WATER_WELL,
    BuildingType.WIND_TURBINE,
    BuildingType.GEOTHERMAL_PLANT,
    BuildingType.RESERVOIR,
    BuildingType.WASTE_TREATMENT,
]);

const RESIDENTIAL_TYPES = new Set<BuildingType>([
    BuildingType.STAFF_QUARTERS,
    BuildingType.CANTEEN,
    BuildingType.MEDICAL_BAY,
    BuildingType.TRAINING_CENTER,
    BuildingType.SECURITY_POST,
    BuildingType.SOCIAL_HUB,
]);

const ECO_TYPES = new Set<BuildingType>([
    BuildingType.COMMUNITY_GARDEN,
    BuildingType.NATURE_RESERVE,
    BuildingType.HYDROPONICS,
    BuildingType.SAFARI_LODGE,
    BuildingType.GREEN_TECH_LAB,
    BuildingType.MONUMENT,
    BuildingType.SPACEPORT,
]);

const LOGISTICS_TYPES = new Set<BuildingType>([
    BuildingType.STORAGE_DEPOT,
    BuildingType.STOCKPILE,
    BuildingType.DISTRIBUTION_HUB,
    BuildingType.TRAIN_STATION,
    BuildingType.DRONE_DEPOT,
]);

const PLACEMENT_SEARCH_RADIUS = 18;
const FALLBACK_SEARCH_RADIUS = 38;
const EXCAVATION_RESERVE_OFFSET: Point = { x: 9, z: 9 };
const EXCAVATION_RESERVE_RADIUS = 5;

const BUILD_PLAN: BuildIntent[] = [
    { type: BuildingType.STAFF_QUARTERS, reason: 'give the first crew beds and recovery', desiredCount: 1 },
    { type: BuildingType.STORAGE_DEPOT, reason: 'stop resources from becoming invisible waste', desiredCount: 1 },
    { type: BuildingType.STOCKPILE, reason: 'reserve a rubble and material yard before open-pit work begins', desiredCount: 1 },
    { type: BuildingType.SOLAR_ARRAY, reason: 'provide clean starter power before demand rises', desiredCount: 1 },
    { type: BuildingType.WATER_WELL, reason: 'provide starter water before demand rises', desiredCount: 1 },
    { type: BuildingType.WASH_PLANT, reason: 'start the first mineral production chain', desiredCount: 1 },
    { type: BuildingType.MINING_HEADFRAME, reason: 'increase mineral output for contracts', desiredCount: 1 },
    { type: BuildingType.CANTEEN, reason: 'feed workers so they keep moving', desiredCount: 1 },
    { type: BuildingType.SAWMILL, reason: 'produce construction wood locally', desiredCount: 1 },
    { type: BuildingType.STONE_QUARRY, reason: 'produce construction stone locally', desiredCount: 1 },
    { type: BuildingType.SOLAR_ARRAY, reason: 'increase starter power capacity', desiredCount: 3 },
    { type: BuildingType.WATER_WELL, reason: 'increase starter water capacity', desiredCount: 2 },
    { type: BuildingType.STAFF_QUARTERS, reason: 'increase worker capacity', desiredCount: 3, minEra: Era.GROWTH },
    { type: BuildingType.STOCKPILE, reason: 'expand rubble and storage capacity for bigger contracts', desiredCount: 2, minEra: Era.GROWTH },
    { type: BuildingType.WIND_TURBINE, reason: 'lift eco score while growing power', desiredCount: 2, minEra: Era.GROWTH },
    { type: BuildingType.COMMUNITY_GARDEN, reason: 'earn trust before heavier industry', desiredCount: 2, minEra: Era.GROWTH },
    { type: BuildingType.MEDICAL_BAY, reason: 'support a larger workforce', desiredCount: 1, minEra: Era.GROWTH },
    { type: BuildingType.TRAINING_CENTER, reason: 'make workers better at their jobs', desiredCount: 1, minEra: Era.GROWTH },
    { type: BuildingType.SECURITY_POST, reason: 'protect trust and settlement safety', desiredCount: 1, minEra: Era.GROWTH },
    { type: BuildingType.SOCIAL_HUB, reason: 'raise morale and social trust', desiredCount: 1, minEra: Era.GROWTH },
    { type: BuildingType.ORE_FOUNDRY, reason: 'begin industrial material production', desiredCount: 1, minEra: Era.INDUSTRY },
    { type: BuildingType.WORKSHOP, reason: 'unlock machine parts and automation support', desiredCount: 1, minEra: Era.INDUSTRY },
    { type: BuildingType.DISTRIBUTION_HUB, reason: 'improve logistics throughput', desiredCount: 1, minEra: Era.INDUSTRY },
    { type: BuildingType.TRAIN_STATION, reason: 'open regional bulk logistics', desiredCount: 1, minEra: Era.INDUSTRY },
    { type: BuildingType.GEM_REFINERY, reason: 'produce premium contract resources', desiredCount: 1, minEra: Era.INDUSTRY },
    { type: BuildingType.RECYCLING_PLANT, reason: 'clean up industry while still producing', desiredCount: 1, minEra: Era.INDUSTRY },
    { type: BuildingType.GEOTHERMAL_PLANT, reason: 'stabilize late-game power', desiredCount: 1, minEra: Era.SUSTAINABILITY },
    { type: BuildingType.WASTE_TREATMENT, reason: 'repair ecological damage', desiredCount: 1, minEra: Era.SUSTAINABILITY },
    { type: BuildingType.NATURE_RESERVE, reason: 'restore trust and the land', desiredCount: 2, minEra: Era.SUSTAINABILITY },
    { type: BuildingType.HYDROPONICS, reason: 'support sustainable food systems', desiredCount: 1, minEra: Era.SUSTAINABILITY },
    { type: BuildingType.DRONE_DEPOT, reason: 'automate late-game delivery', desiredCount: 1, minEra: Era.SUSTAINABILITY },
    { type: BuildingType.RESERVOIR, reason: 'secure large-scale water reserves', desiredCount: 1, minEra: Era.SUSTAINABILITY },
    { type: BuildingType.MONUMENT, reason: 'mark prosperity victory', desiredCount: 1, minEra: Era.PROSPERITY },
    { type: BuildingType.SPACEPORT, reason: 'complete the final export economy', desiredCount: 1, minEra: Era.PROSPERITY },
    { type: BuildingType.SAFARI_LODGE, reason: 'turn recovered land into prosperity income', desiredCount: 1, minEra: Era.PROSPERITY },
    { type: BuildingType.GREEN_TECH_LAB, reason: 'finish planetary restoration technology', desiredCount: 1, minEra: Era.PROSPERITY },
];

function getOverseer(state: GameState): OverseerState {
    const existing = (state as any).aiOverseer as Partial<OverseerState> | undefined;
    const normalized: OverseerState = {
        ...DEFAULT_OVERSEER,
        ...existing,
        mode: ['OBSERVE', 'CONTRACTS', 'STABILITY', 'GROWTH', 'AUTOPILOT'].includes(existing?.mode as string)
            ? existing!.mode as OverseerMode
            : DEFAULT_OVERSEER.mode,
        pilotProvider: existing?.pilotProvider === 'LOCAL_QWEN' ? 'LOCAL_QWEN' : 'HEURISTIC',
        actionLog: Array.isArray(existing?.actionLog) ? existing!.actionLog!.slice(0, 8) : [],
    };
    (state as any).aiOverseer = normalized;
    return normalized;
}

export class AIOverseerSystem extends BaseSimSystem {
    readonly id = 'ai-overseer';
    readonly priority = 9;

    tick(ctx: FixedContext, state: GameState): void {
        const overseer = getOverseer(state);
        if (!overseer.enabled) return;
        if (ctx.time < overseer.nextReviewAt) return;

        const localQwenPilot = overseer.mode === 'AUTOPILOT' && overseer.pilotProvider === 'LOCAL_QWEN';
        overseer.nextReviewAt = ctx.time + (overseer.mode === 'AUTOPILOT' && overseer.autoAct ? 1.25 : 4);
        const insight = localQwenPilot ? this.getLocalQwenPilotInsight(overseer) : this.analyze(state);
        overseer.currentFocus = insight.focus;
        overseer.recommendation = insight.recommendation;
        overseer.confidence = insight.confidence;

        if (overseer.autoAct && !localQwenPilot) this.tryAct(ctx, state, overseer);
    }

    handleCommand(cmd: GameCommand, _ctx: CommandContext, state: GameState): CommandResult | null {
        if ((cmd.type as string) !== 'SET_AI_OVERSEER') return null;
        const overseer = getOverseer(state);
        const payload = cmd.payload || {};
        if (typeof payload.enabled === 'boolean') overseer.enabled = payload.enabled;
        if (typeof payload.autoAct === 'boolean') overseer.autoAct = payload.autoAct;
        if (['OBSERVE', 'CONTRACTS', 'STABILITY', 'GROWTH', 'AUTOPILOT'].includes(payload.mode)) overseer.mode = payload.mode;
        if (payload.pilotProvider === 'LOCAL_QWEN' || payload.pilotProvider === 'HEURISTIC') overseer.pilotProvider = payload.pilotProvider;
        overseer.nextReviewAt = 0;
        this.log(state, overseer, `AI mode: ${overseer.mode}${overseer.mode === 'AUTOPILOT' && overseer.pilotProvider === 'LOCAL_QWEN' ? ' via Local Qwen' : overseer.autoAct ? ' with auto act' : ''}`);
        return { ok: true };
    }

    private getLocalQwenPilotInsight(overseer: OverseerState): { focus: string; recommendation: string; confidence: number } {
        return {
            focus: 'Local Qwen pilot',
            recommendation: overseer.autoAct
                ? 'Browser-local Qwen owns Pilot mode and is issuing whitelisted game commands from the UI loop.'
                : 'Pilot mode is assigned to Local Qwen. Enable auto act to let it issue whitelisted commands.',
            confidence: 0.72,
        };
    }

    private analyze(state: GameState): { focus: string; recommendation: string; confidence: number } {
        const owned = this.getOwnedBuildingToPlace(state);
        if (owned) {
            const def = BUILDINGS[owned.type];
            return { focus: `Place ${def.name}`, recommendation: `Pilot has ${def.name} in inventory and will place it only if the colony plan still needs one.`, confidence: 0.9 };
        }

        const ready = state.contracts.find(contract => this.isReady(contract, state));
        if (ready) {
            return { focus: `Ready delivery: ${RESOURCE_LABEL[ready.resource]}`, recommendation: `Deliver ${ready.amount} ${RESOURCE_LABEL[ready.resource]} for ${ready.reward.toLocaleString()} AGT.`, confidence: 0.94 };
        }

        const intent = this.getNextBuildIntent(state);
        if (intent) {
            const def = BUILDINGS[intent.type];
            return { focus: `Next build: ${def.name}`, recommendation: `Pilot will buy and place ${def.name} to ${intent.reason}.`, confidence: 0.86 };
        }

        const available = state.contracts.find(contract => (contract.status || 'AVAILABLE') === 'AVAILABLE');
        if (available) {
            return { focus: `Available contract: ${RESOURCE_LABEL[available.resource]}`, recommendation: `Pilot is checking stock before accepting ${available.amount} ${RESOURCE_LABEL[available.resource]}.`, confidence: 0.7 };
        }

        return { focus: 'Builder-first autopilot', recommendation: 'Pilot will keep building the plan, then use contracts and harvest orders to fund the next move.', confidence: 0.64 };
    }

    private tryAct(ctx: FixedContext, state: GameState, overseer: OverseerState): void {
        if (overseer.mode === 'OBSERVE') return;
        if (state.commandQueue.some(command => this.isQueuedHeuristicCommand(command))) return;

        if (this.claimCompletedGoal(state, overseer)) return;

        if (overseer.mode === 'AUTOPILOT' || overseer.mode === 'GROWTH' || overseer.mode === 'STABILITY') {
            const owned = this.getOwnedBuildingToPlace(state);
            if (owned && this.tryBuild(ctx, state, overseer, owned)) return;

            const intent = this.getNextBuildIntent(state);
            if (intent && this.tryBuild(ctx, state, overseer, intent)) return;
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

        if (this.tryRaiseAgt(ctx, state, overseer, 10000)) return;
        if (this.tryMarkUsefulHarvest(ctx, state, overseer)) return;
    }

    private getOwnedBuildingToPlace(state: GameState): BuildIntent | null {
        for (const intent of BUILD_PLAN) {
            if ((state.inventory?.[intent.type] || 0) <= 0 || !this.isIntentAvailable(state, intent)) continue;
            if (this.countPlacedBuildings(state, intent.type) >= (intent.desiredCount || 1)) continue;
            return intent;
        }

        for (const [key, count] of Object.entries(state.inventory || {})) {
            const type = key as BuildingType;
            if (!count || count <= 0 || type === BuildingType.EMPTY || INFRASTRUCTURE_TYPES.has(type)) continue;
            const def = BUILDINGS[type];
            if (!def || !this.isEraAvailable(state, def.era || Era.SETTLEMENT)) continue;
            if (this.countPlacedBuildings(state, type) >= this.getDesiredCountForType(state, type)) continue;
            return { type, reason: 'place owned inventory only when it still fits the colony plan' };
        }

        return null;
    }

    private getNextBuildIntent(state: GameState): BuildIntent | null {
        if ((state.powerGrid?.deficit || 0) > 0 && this.countPlacedAndOwned(state, BuildingType.SOLAR_ARRAY) < 3) {
            return { type: BuildingType.SOLAR_ARRAY, reason: 'cover a power shortfall without road spam', desiredCount: 3 };
        }
        if ((state.waterNetwork?.deficit || 0) > 0 && this.countPlacedAndOwned(state, BuildingType.WATER_WELL) < 2) {
            return { type: BuildingType.WATER_WELL, reason: 'cover a water shortfall without pipe spam', desiredCount: 2 };
        }
        if (this.getStoragePressure(state) > 0.82 && this.isEraAvailable(state, Era.GROWTH)) {
            return { type: BuildingType.STOCKPILE, reason: 'storage is close to capacity', desiredCount: this.countPlacedAndOwned(state, BuildingType.STOCKPILE) + 1 };
        }

        for (const intent of BUILD_PLAN) {
            if (!this.isIntentAvailable(state, intent)) continue;
            if (this.countPlacedAndOwned(state, intent.type) >= (intent.desiredCount || 1)) continue;
            return intent;
        }
        return null;
    }

    private tryBuild(ctx: FixedContext, state: GameState, overseer: OverseerState, intent: BuildIntent): boolean {
        const def = BUILDINGS[intent.type];
        if (!def || !this.isIntentAvailable(state, intent)) return false;

        if ((state.inventory?.[intent.type] || 0) > 0) {
            const placement = this.findPlacement(state, intent.type);
            if (!placement) {
                this.log(state, overseer, `No planned footprint for ${def.name}; preserving mine space and clear paths`);
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
        if (missing.length > 0) {
            if (!this.tryImportMissingResource(ctx, state, overseer, missing)) {
                this.log(state, overseer, `Waiting for resources to buy ${def.name}`);
            }
            return true;
        }

        this.queueCommand(ctx, state, 'BUY_BUILDING', { buildingType: intent.type, cost: def.cost });
        this.log(state, overseer, `Bought ${def.name}`);
        return true;
    }

    private findPlacement(state: GameState, type: BuildingType): Point | null {
        const def = BUILDINGS[type];
        if (!def) return null;
        const width = def.width || 1;
        const depth = def.depth || 1;
        const anchors = this.getPlacementAnchors(state, type);

        for (const anchor of anchors) {
            const found = this.searchFrom(state, type, anchor.x, anchor.z, width, depth, PLACEMENT_SEARCH_RADIUS);
            if (found) return found;
        }

        const centerX = Math.round(state.spawnX || 0);
        const centerZ = Math.round(state.spawnZ || 0);
        return this.searchFrom(state, type, centerX, centerZ, width, depth, FALLBACK_SEARCH_RADIUS);
    }

    private searchFrom(state: GameState, type: BuildingType, originX: number, originZ: number, width: number, depth: number, maxRadius: number): Point | null {
        let best: { point: Point; score: number } | null = null;
        for (let radius = 0; radius <= maxRadius; radius++) {
            for (let dz = -radius; dz <= radius; dz++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
                    const x = originX + dx;
                    const z = originZ + dz;
                    if (!this.canPlaceAt(state, type, x, z, width, depth)) continue;
                    const score = this.scorePlacement(state, type, x, z, originX, originZ, width, depth);
                    if (!best || score < best.score) best = { point: { x, z }, score };
                }
            }
        }
        return best?.point || null;
    }

    private canPlaceAt(state: GameState, type: BuildingType, x: number, z: number, width: number, depth: number): boolean {
        const def = BUILDINGS[type];
        if (!def) return false;
        for (let dz = 0; dz < depth; dz++) {
            for (let dx = 0; dx < width; dx++) {
                const worldX = x + dx;
                const worldZ = z + dz;
                if (this.isExcavationReserveTile(state, worldX, worldZ)) return false;
                const tile = ChunkStore.getTile(state.chunks, worldX, worldZ);
                if (!tile || tile.locked || tile.isUnderConstruction) return false;
                if ((tile as any).openPitDepth > 0 || (tile.foliage as any) === 'ROCK_PEBBLE') return false;
                const isEmpty = tile.buildingType === BuildingType.EMPTY;
                const isAllowedWater = tile.buildingType === BuildingType.POND && Boolean(def.waterPlaceable);
                if (!isEmpty && !isAllowedWater) return false;
            }
        }
        return true;
    }

    private scorePlacement(state: GameState, type: BuildingType, x: number, z: number, originX: number, originZ: number, width: number, depth: number): number {
        const distanceToAnchor = Math.abs(x - originX) + Math.abs(z - originZ);
        const reserve = this.getExcavationReserve(state);
        const distanceToReserve = Math.abs(x - reserve.x) + Math.abs(z - reserve.z);
        const reservePenalty = distanceToReserve < EXCAVATION_RESERVE_RADIUS + 5 ? (EXCAVATION_RESERVE_RADIUS + 5 - distanceToReserve) * 20 : 0;
        const sameTypePenalty = this.countNearbyBuildings(state, type, x, z, width, depth, 3) * 4;
        const crowdingPenalty = this.countNearbyBuildings(state, null, x, z, width, depth, 1) * 8;
        return distanceToAnchor + reservePenalty + sameTypePenalty + crowdingPenalty;
    }

    private countNearbyBuildings(state: GameState, type: BuildingType | null, x: number, z: number, width: number, depth: number, margin: number): number {
        let count = 0;
        for (let worldZ = z - margin; worldZ < z + depth + margin; worldZ++) {
            for (let worldX = x - margin; worldX < x + width + margin; worldX++) {
                if (worldX >= x && worldX < x + width && worldZ >= z && worldZ < z + depth) continue;
                const tile = ChunkStore.getTile(state.chunks, worldX, worldZ);
                if (!tile || tile.buildingType === BuildingType.EMPTY || !this.isStructureHead(tile)) continue;
                if (type && tile.buildingType !== type) continue;
                count++;
            }
        }
        return count;
    }

    private getPlacementAnchors(state: GameState, type: BuildingType): Point[] {
        const centerX = Math.round(state.spawnX || 0);
        const centerZ = Math.round(state.spawnZ || 0);
        const zone = this.getPlacementZone(type);
        const offsets: Record<PlacementZone, Point[]> = {
            CORE: [{ x: -2, z: -2 }, { x: 3, z: -2 }, { x: -2, z: 3 }],
            RESIDENTIAL: [{ x: -7, z: -2 }, { x: -7, z: 5 }, { x: -12, z: 1 }],
            PRODUCTION: [{ x: 8, z: -3 }, { x: 13, z: -2 }, { x: 9, z: -8 }],
            UTILITY: [{ x: 2, z: -10 }, { x: -4, z: -11 }, { x: 8, z: -12 }],
            ECO: [{ x: -9, z: 10 }, { x: -14, z: 12 }, { x: -4, z: 13 }],
            LOGISTICS: [{ x: 3, z: 4 }, { x: -3, z: 5 }, { x: 5, z: 8 }],
        };
        return offsets[zone].map(offset => ({ x: centerX + offset.x, z: centerZ + offset.z }));
    }

    private getPlacementZone(type: BuildingType): PlacementZone {
        if (PRODUCTION_TYPES.has(type)) return 'PRODUCTION';
        if (UTILITY_TYPES.has(type)) return 'UTILITY';
        if (RESIDENTIAL_TYPES.has(type)) return 'RESIDENTIAL';
        if (ECO_TYPES.has(type)) return 'ECO';
        if (LOGISTICS_TYPES.has(type)) return 'LOGISTICS';
        return 'CORE';
    }

    private getExcavationReserve(state: GameState): Point {
        return {
            x: Math.round(state.spawnX || 0) + EXCAVATION_RESERVE_OFFSET.x,
            z: Math.round(state.spawnZ || 0) + EXCAVATION_RESERVE_OFFSET.z,
        };
    }

    private isExcavationReserveTile(state: GameState, x: number, z: number): boolean {
        const reserve = this.getExcavationReserve(state);
        return Math.abs(x - reserve.x) <= EXCAVATION_RESERVE_RADIUS && Math.abs(z - reserve.z) <= EXCAVATION_RESERVE_RADIUS;
    }

    private getDesiredCountForType(state: GameState, type: BuildingType): number {
        const matching = BUILD_PLAN.filter(intent => intent.type === type && this.isIntentAvailable(state, intent));
        if (matching.length === 0) return 1;
        return Math.max(...matching.map(intent => intent.desiredCount || 1));
    }

    private getPlacedHeads(state: GameState): GridTile[] {
        return Object.values(state.chunks)
            .flatMap(chunk => chunk.tiles)
            .filter(tile => tile.buildingType !== BuildingType.EMPTY && this.isStructureHead(tile));
    }

    private countPlacedBuildings(state: GameState, type: BuildingType): number {
        return this.getPlacedHeads(state).filter(tile => tile.buildingType === type).length;
    }

    private countPlacedAndOwned(state: GameState, type: BuildingType): number {
        return this.countPlacedBuildings(state, type) + (state.inventory?.[type] || 0);
    }

    private isStructureHead(tile: GridTile): boolean {
        return tile.structureHeadX === undefined || (tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ);
    }

    private isIntentAvailable(state: GameState, intent: BuildIntent): boolean {
        const def = BUILDINGS[intent.type];
        if (!def || intent.type === BuildingType.EMPTY) return false;
        return this.isEraAvailable(state, intent.minEra || def.era || Era.SETTLEMENT);
    }

    private isEraAvailable(state: GameState, era: Era): boolean {
        return ERA_ORDER[state.currentEra] >= ERA_ORDER[era] || Boolean(state.unlockedEras?.includes(era));
    }

    private hasEnoughAgtForBuild(state: GameState, type: BuildingType): boolean {
        return state.resources.agt >= this.getAgtCost(type);
    }

    private getAgtCost(type: BuildingType): number {
        const def = BUILDINGS[type];
        return Number(def?.costs?.agt ?? def?.cost ?? 0);
    }

    private getMissingBuildResources(state: GameState, type: BuildingType): Array<{ resource: ResourceKey; amount: number }> {
        const def = BUILDINGS[type];
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
        const sellTarget = (['minerals', 'stone', 'wood', 'gems'] as ResourceKey[])
            .find(resource => state.resources[resource] > this.getReserveForResource(resource));
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
        if (!target || target.amount <= 0 || state.resources.agt < 500) return false;
        const amount = Math.max(25, Math.min(400, target.amount));
        this.queueCommand(ctx, state, 'BUY_RESOURCE', { resource: target.resource, amount });
        this.log(state, overseer, `Imported ${amount} ${BUILD_RESOURCE_LABEL[target.resource]}`);
        return true;
    }

    private getStoragePressure(state: GameState): number {
        const cap = Math.max(1, state.resources.maxCapacity || 1);
        return (state.resources.minerals + state.resources.wood + state.resources.stone) / cap;
    }

    private tryMarkUsefulHarvest(ctx: FixedContext, state: GameState, overseer: OverseerState): boolean {
        if (state.jobs.length > state.agents.length + 3) return false;
        const resource = state.resources.wood < 1500 ? 'wood' : state.resources.stone < 1500 ? 'stone' : 'minerals';
        const target = this.findHarvestTarget(state, resource);
        if (!target) return false;
        this.queueCommand(ctx, state, 'MARK_HARVEST', { x: target.x, z: target.z });
        this.log(state, overseer, `Marked ${resource} harvest target`);
        return true;
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
        return contract.resource === 'MINERALS'
            && this.countPlacedAndOwned(state, BuildingType.WASH_PLANT) > 0
            && coverage >= 0.25
            && contract.reward >= contract.penalty * 2;
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

    private isQueuedHeuristicCommand(command: GameCommand): boolean {
        return (command as any).source === GAME_COMMAND_CANDIDATE_SOURCES.HEURISTIC_OVERSEER || String(command.id).startsWith('ai_cmd_');
    }

    private queueCommand(ctx: FixedContext, state: GameState, type: GameCommand['type'], payload: any): void {
        const issuedAtTick = state.tickCount;
        const candidate = createGameCommandCandidate(type, payload, GAME_COMMAND_CANDIDATE_SOURCES.HEURISTIC_OVERSEER, HEURISTIC_OVERSEER_COMMAND_REASON);
        const commandId = ctx.getNextId?.('ai_cmd') || createGameCommandCandidateId(
            GAME_COMMAND_CANDIDATE_SOURCES.HEURISTIC_OVERSEER,
            type,
            issuedAtTick,
            state.commandQueue.length,
        );
        const command = createGameCommandCandidateEnvelope(candidate, commandId, issuedAtTick);
        state.commandQueue.push(command as GameCommand);
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
