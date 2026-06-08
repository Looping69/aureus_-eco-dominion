import { BaseSimSystem } from '../Simulation';
import { FixedContext, CommandContext, CommandResult } from '../../kernel/Types';
import { BuildingType, Contract, GameCommand, GameState, GridTile, SfxType } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { ChunkStore } from '../../space/ChunkStore';
import { HARVESTABLE_ROCKS, HARVESTABLE_TREES } from '../../utils/GameUtils';

type OverseerMode = 'OBSERVE' | 'CONTRACTS' | 'STABILITY' | 'GROWTH' | 'AUTOPILOT';

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

type ResourceKey = 'minerals' | 'gems' | 'wood' | 'stone';

type BuildIntent = {
    type: BuildingType;
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

const STARTER_SPINE: BuildIntent[] = [
    { type: BuildingType.STAFF_QUARTERS, reason: 'first shelter and worker recovery' },
    { type: BuildingType.STORAGE_DEPOT, reason: 'storage for deliveries and worker deposits' },
    { type: BuildingType.WASH_PLANT, reason: 'first mineral production chain' },
    { type: BuildingType.MINING_HEADFRAME, reason: 'stronger mineral production for contracts' },
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

        overseer.nextReviewAt = ctx.time + 4;
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

        const blockedAgents = state.agents.filter(agent => agent.statusTone === 'blocked' || hasActiveRouteCooldown(agent, state.tickCount));
        if (blockedAgents.length > 0) {
            const sample = blockedAgents[0];
            return {
                focus: 'Blocked agent route',
                recommendation: `${blockedAgents.length} agent${blockedAgents.length === 1 ? '' : 's'} cannot complete a route. ${sample.name}: ${sample.statusReason || 'No route to target.'}`,
                confidence: 0.88,
            };
        }

        const waitingAgents = state.agents.filter(agent => agent.statusTone === 'warning');
        if (waitingAgents.length > 0) {
            const sample = waitingAgents[0];
            return {
                focus: 'Agent needs attention',
                recommendation: `${waitingAgents.length} agent${waitingAgents.length === 1 ? '' : 's'} waiting on colony support. ${sample.name}: ${sample.statusReason || 'Needs support.'}`,
                confidence: 0.78,
            };
        }

        const stabilityIntent = this.getStabilityBuildIntent(state);
        if (stabilityIntent) {
            const def = BUILDINGS[stabilityIntent.type];
            return {
                focus: `Stability need: ${def.name}`,
                recommendation: `Build ${def.name} for ${stabilityIntent.reason}.`,
                confidence: 0.82,
            };
        }

        const starterIntent = this.getStarterBuildIntent(state);
        if (starterIntent) {
            const def = BUILDINGS[starterIntent.type];
            return {
                focus: `Starter spine: ${def.name}`,
                recommendation: `Next autonomous build: ${def.name} for ${starterIntent.reason}.`,
                confidence: 0.8,
            };
        }

        const available = state.contracts.find(contract => (contract.status || 'AVAILABLE') === 'AVAILABLE');
        if (available) {
            const stock = state.resources[RESOURCE_KEY[available.resource]] || 0;
            const coverage = Math.min(1, stock / Math.max(1, available.amount));
            return {
                focus: `Available contract: ${RESOURCE_LABEL[available.resource]}`,
                recommendation: coverage >= 0.5
                    ? `Accept the ${RESOURCE_LABEL[available.resource]} contract; current stock already covers ${Math.round(coverage * 100)}%.`
                    : `Prepare ${RESOURCE_LABEL[available.resource]} production before accepting that contract.`,
                confidence: coverage >= 0.5 ? 0.82 : 0.62,
            };
        }

        if (state.powerGrid?.deficit > 0) {
            return {
                focus: 'Power instability',
                recommendation: `Power deficit detected: ${Math.ceil(state.powerGrid.deficit)} units. Stabilize utilities before expanding production.`,
                confidence: 0.78,
            };
        }

        if (state.waterNetwork?.deficit > 0) {
            return {
                focus: 'Water instability',
                recommendation: `Water deficit detected: ${Math.ceil(state.waterNetwork.deficit)} units. Add supply or reduce demand before scaling.`,
                confidence: 0.76,
            };
        }

        const idleWorkers = state.agents.filter(agent => agent.state === 'IDLE' && agent.type !== 'ILLEGAL_MINER').length;
        if (idleWorkers > 0 && state.jobs.length > 0) {
            const stuckIdle = state.agents.find(agent => agent.state === 'IDLE' && agent.statusReason);
            return {
                focus: 'Workforce routing',
                recommendation: `${idleWorkers} worker${idleWorkers === 1 ? '' : 's'} idle while ${state.jobs.length} job${state.jobs.length === 1 ? '' : 's'} exist. ${stuckIdle?.statusReason || 'Inspect unreachable jobs, professions, or missing resources.'}`,
                confidence: 0.74,
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
            focus: 'Balanced operations',
            recommendation: 'No urgent bottleneck. Expand deliberately or switch AI to Pilot for hands-on colony support.',
            confidence: 0.58,
        };
    }

    private tryAct(ctx: FixedContext, state: GameState, overseer: OverseerState): void {
        if (overseer.mode === 'OBSERVE') return;
        if (state.commandQueue.some(command => String(command.id).startsWith('ai_cmd_'))) return;

        if (this.claimCompletedGoal(state, overseer)) return;

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
            const blockedAgents = state.agents.filter(agent => agent.statusTone === 'blocked' || hasActiveRouteCooldown(agent, state.tickCount)).length;
            if (blockedAgents > 0) {
                this.log(state, overseer, `Held expansion: ${blockedAgents} blocked agent route${blockedAgents === 1 ? '' : 's'}`);
                return;
            }

            const stabilityIntent = this.getStabilityBuildIntent(state);
            if (stabilityIntent && this.trySupportBuild(ctx, state, overseer, stabilityIntent)) return;
        }

        if (overseer.mode === 'GROWTH' || overseer.mode === 'AUTOPILOT') {
            const starterIntent = this.getStarterBuildIntent(state);
            if (starterIntent && this.trySupportBuild(ctx, state, overseer, starterIntent)) return;

            if (this.tryMarkUsefulHarvest(ctx, state, overseer)) return;
        }
    }

    private claimCompletedGoal(state: GameState, overseer: OverseerState): boolean {
        const goal = state.activeGoal;
        if (!goal?.completed) return false;

        if (goal.reward.type === 'AGT') {
            state.resources.agt += goal.reward.amount;
        } else {
            state.resources.gems += goal.reward.amount;
        }
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

    private getStarterBuildIntent(state: GameState): BuildIntent | null {
        for (const intent of STARTER_SPINE) {
            if (this.hasBuildingOrInventory(state, intent.type)) continue;
            return intent;
        }
        return null;
    }

    private getStabilityBuildIntent(state: GameState): BuildIntent | null {
        if ((state.powerGrid?.deficit || 0) > 0 || (state.powerGrid?.strandedDemand || 0) > 0) {
            if (!this.hasBuildingOrInventory(state, BuildingType.SOLAR_ARRAY)) {
                return { type: BuildingType.SOLAR_ARRAY, reason: 'clean early power capacity' };
            }
            return { type: BuildingType.POWER_LINE, reason: 'connecting stranded power demand' };
        }

        if ((state.waterNetwork?.deficit || 0) > 0) {
            if (!this.hasBuildingOrInventory(state, BuildingType.WATER_WELL)) {
                return { type: BuildingType.WATER_WELL, reason: 'basic water supply' };
            }
            return { type: BuildingType.PIPE, reason: 'connecting stranded water demand' };
        }

        return null;
    }

    private hasBuildingOrInventory(state: GameState, buildingType: BuildingType): boolean {
        return this.countPlacedBuildings(state, buildingType) > 0 || (state.inventory?.[buildingType] || 0) > 0;
    }

    private countPlacedBuildings(state: GameState, buildingType: BuildingType): number {
        let count = 0;
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (tile.buildingType !== buildingType) continue;
                if (!this.isStructureHead(tile)) continue;
                count++;
            }
        }
        return count;
    }

    private isStructureHead(tile: GridTile): boolean {
        return tile.structureHeadX === undefined || (tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ);
    }

    private trySupportBuild(ctx: FixedContext, state: GameState, overseer: OverseerState, intent: BuildIntent): boolean {
        const def = BUILDINGS[intent.type];
        if (!def || intent.type === BuildingType.EMPTY) return false;

        if ((state.inventory?.[intent.type] || 0) > 0) {
            const placement = this.findPlacement(state, intent.type);
            if (!placement) {
                this.log(state, overseer, `Could not place ${def.name}: no clear footprint`);
                return true;
            }
            this.queueCommand(ctx, state, 'PLACE_BUILDING', { x: placement.x, z: placement.z, buildingType: intent.type });
            this.log(state, overseer, `Placed ${def.name}`);
            return true;
        }

        const missing = this.getMissingBuildResources(state, intent.type);
        if (missing.length === 0) {
            this.queueCommand(ctx, state, 'BUY_BUILDING', { buildingType: intent.type, cost: def.cost });
            this.log(state, overseer, `Bought ${def.name}`);
            return true;
        }

        const imported = this.tryImportMissingResource(ctx, state, overseer, missing);
        if (!imported) {
            this.log(state, overseer, `Waiting for resources to buy ${def.name}`);
        }
        return true;
    }

    private getMissingBuildResources(state: GameState, buildingType: BuildingType): Array<{ resource: ResourceKey; amount: number }> {
        const def = BUILDINGS[buildingType];
        if (!def?.costs) {
            return state.resources.agt >= def.cost ? [] : [{ resource: 'minerals', amount: 0 }];
        }

        return Object.entries(def.costs)
            .map(([resource, amount]) => ({
                resource: resource as ResourceKey,
                amount: Math.ceil(Math.max(0, Number(amount) - Number((state.resources as any)[resource] || 0))),
            }))
            .filter(item => item.amount > 0 && ['minerals', 'gems', 'wood', 'stone'].includes(item.resource));
    }

    private tryImportMissingResource(ctx: FixedContext, state: GameState, overseer: OverseerState, missing: Array<{ resource: ResourceKey; amount: number }>): boolean {
        const target = missing.find(item => item.resource !== 'gems') || missing[0];
        if (!target || target.amount <= 0) return false;
        if (state.resources.agt < 500) return false;

        const amount = Math.max(25, Math.min(250, target.amount));
        this.queueCommand(ctx, state, 'BUY_RESOURCE', { resource: target.resource, amount });
        this.log(state, overseer, `Imported ${amount} ${BUILD_RESOURCE_LABEL[target.resource]}`);
        return true;
    }

    private findPlacement(state: GameState, buildingType: BuildingType): { x: number; z: number } | null {
        const def = BUILDINGS[buildingType];
        if (!def) return null;

        const width = def.width || 1;
        const depth = def.depth || 1;
        const centerX = Math.round(state.spawnX || 0);
        const centerZ = Math.round(state.spawnZ || 0);

        for (let radius = 2; radius <= 18; radius++) {
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

    private tryMarkUsefulHarvest(ctx: FixedContext, state: GameState, overseer: OverseerState): boolean {
        if (state.jobs.length > state.agents.length) return false;

        const resource = this.pickNeededHarvestResource(state);
        const target = this.findHarvestTarget(state, resource);
        if (!target) return false;

        this.queueCommand(ctx, state, 'MARK_HARVEST', { x: target.x, z: target.z });
        this.log(state, overseer, `Marked ${resource} harvest target`);
        return true;
    }

    private pickNeededHarvestResource(state: GameState): ResourceKey {
        if (state.resources.wood < 600) return 'wood';
        if (state.resources.stone < 600) return 'stone';
        if (state.resources.minerals < 250) return 'minerals';
        return 'wood';
    }

    private findHarvestTarget(state: GameState, resource: ResourceKey): { x: number; z: number } | null {
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
                if (!best || distance < best.distance) {
                    best = { x: tile.x, z: tile.z, distance };
                }
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
        if (coverage >= 0.8) return true;
        return contract.resource === 'MINERALS' && coverage >= 0.5 && contract.reward >= contract.penalty * 3;
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
