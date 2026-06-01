
import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import {
    BuildingType,
    FactoryCorridorState,
    FactoryNodeState,
    FactoryPacketState,
    FactoryPacketTransportMode,
    FactoryPlannerRecommendation,
    FactoryPressurePoint,
    FactoryPressureState,
    FactoryResourceType,
    FactorySectorState,
    FactoryState,
    GameState,
} from '../../../types';
import { updateWaterConnectivity } from '../../utils/GameUtils';
import { ChunkStore } from '../../space/ChunkStore';

export class LogisticsSystem extends BaseSimSystem {
    readonly id = 'logistics';
    readonly priority = 20;

    private lastExplorationUpdate = 0;
    private lastWaterUpdate = 0;
    private lastFactoryUpdate = 0;
    private readonly FACTORY_INTERVAL = 0.25;
    private readonly MAX_ROUTE_DEPTH = 14;
    private readonly MAX_DRONE_RADIUS = 4;
    private readonly DRONE_DEPOT_RADIUS = 6;
    private readonly SECTOR_SIZE = 18;
    private readonly BELT_TRAVEL_SPEED = 1.8;
    private readonly RAIL_TRAVEL_SPEED = 2.7;
    private readonly DRONE_TRAVEL_SPEED = 2.2;
    private readonly DRONE_SOFT_CAP = 3;
    private readonly DRONE_HARD_CAP = 6;

    tick(ctx: FixedContext, state: GameState): void {
        const chunks = state.chunks;
        if (!chunks) return;

        const factory = this.getFactoryState(state);
        this.advancePackets(factory, ctx.fixedDt || 1 / 60);

        if (ctx.time - this.lastExplorationUpdate > 0.2) {
            this.lastExplorationUpdate = ctx.time;
            this.updateExploration(state);
        }

        if (ctx.time - this.lastWaterUpdate > 1.0) {
            this.lastWaterUpdate = ctx.time;
            updateWaterConnectivity(state.chunks);
        }

        if (ctx.time - this.lastFactoryUpdate > this.FACTORY_INTERVAL) {
            this.lastFactoryUpdate = ctx.time;
            this.syncFactoryNodes(state, factory);
            this.routeFactoryResources(state, factory);
        }
    }

    private getFactoryState(state: GameState): FactoryState {
        if (!state.factory) {
            state.factory = {
                nodes: {},
                packets: [],
                throughput: 0,
                backlog: 0,
                stalledNodes: 0,
                lastNetworkTick: 0,
                sectors: [],
                regionalThroughput: 0,
                dronePressure: 0,
                droneTrips: 0,
                droneCharge: 1,
                droneUpkeep: 0,
                rechargePads: 0,
                pressure: {
                    routeDebt: 0,
                    underfedProcessors: 0,
                    hotspots: 0,
                    bottlenecks: [],
                    pinnedKeys: [],
                    emergencyReliefSectors: [],
                    recommendations: [],
                    efficiencyPenalty: 0,
                    corridors: [],
                },
            };
        }

        if (!state.factory.packets) {
            state.factory.packets = [];
        }
        if (state.factory.regionalThroughput === undefined) {
            state.factory.regionalThroughput = 0;
        }
        if (state.factory.dronePressure === undefined) {
            state.factory.dronePressure = 0;
        }
        if (state.factory.droneTrips === undefined) {
            state.factory.droneTrips = 0;
        }
        if (state.factory.droneCharge === undefined) {
            state.factory.droneCharge = 1;
        }
        if (state.factory.droneUpkeep === undefined) {
            state.factory.droneUpkeep = 0;
        }
        if (state.factory.rechargePads === undefined) {
            state.factory.rechargePads = 0;
        }
        if (!state.factory.sectors) {
            state.factory.sectors = [];
        }
        if (!state.factory.pressure) {
            state.factory.pressure = {
                routeDebt: 0,
                underfedProcessors: 0,
                hotspots: 0,
                bottlenecks: [],
                pinnedKeys: [],
                emergencyReliefSectors: [],
                recommendations: [],
                efficiencyPenalty: 0,
                corridors: [],
            };
        }
        if (!state.factory.pressure.corridors) {
            state.factory.pressure.corridors = [];
        }

        return state.factory;
    }

    private advancePackets(factory: FactoryState, dt: number): void {
        factory.packets = factory.packets
            .map((packet) => ({
                ...packet,
                progress: packet.progress + dt * packet.speed,
            }))
            .filter((packet) => packet.progress < 1);
    }

    private isFactoryBuilding(type: BuildingType): boolean {
        return [
            BuildingType.MINING_HEADFRAME,
            BuildingType.WASH_PLANT,
            BuildingType.RECYCLING_PLANT,
            BuildingType.ORE_FOUNDRY,
            BuildingType.GEM_REFINERY,
            BuildingType.SAWMILL,
            BuildingType.STONE_QUARRY,
            BuildingType.WORKSHOP,
            BuildingType.GREEN_TECH_LAB,
            BuildingType.RAIL_LINE,
            BuildingType.STORAGE_DEPOT,
            BuildingType.STOCKPILE,
            BuildingType.TRAIN_STATION,
            BuildingType.DRONE_DEPOT,
            BuildingType.DISTRIBUTION_HUB,
        ].includes(type);
    }

    private isDroneHub(type: BuildingType): boolean {
        return [BuildingType.TRAIN_STATION, BuildingType.DRONE_DEPOT].includes(type);
    }

    private getNodeMode(type: BuildingType): FactoryNodeState['mode'] | null {
        if ([BuildingType.RAIL_LINE, BuildingType.DISTRIBUTION_HUB, BuildingType.TRAIN_STATION, BuildingType.DRONE_DEPOT].includes(type)) return 'TRANSPORT';
        if ([BuildingType.STORAGE_DEPOT, BuildingType.STOCKPILE].includes(type)) return 'SINK';
        if ([BuildingType.WASH_PLANT, BuildingType.RECYCLING_PLANT, BuildingType.ORE_FOUNDRY, BuildingType.GEM_REFINERY, BuildingType.WORKSHOP, BuildingType.GREEN_TECH_LAB].includes(type)) return 'PROCESSOR';
        if ([BuildingType.MINING_HEADFRAME, BuildingType.SAWMILL, BuildingType.STONE_QUARRY].includes(type)) return 'SOURCE';
        return null;
    }

    private syncFactoryNodes(state: GameState, factory: FactoryState): void {
        const seen = new Set<string>();

        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (tile.isUnderConstruction) continue;
                if (tile.structureHeadX !== undefined && (tile.x !== tile.structureHeadX || tile.z !== tile.structureHeadZ)) continue;
                if (!this.isFactoryBuilding(tile.buildingType)) continue;

                const mode = this.getNodeMode(tile.buildingType);
                if (!mode) continue;

                const key = `${tile.x},${tile.z}`;
                seen.add(key);

                const existing = factory.nodes[key];
                if (!existing || existing.buildingType !== tile.buildingType || existing.mode !== mode) {
                    factory.nodes[key] = {
                        key,
                        x: tile.x,
                        z: tile.z,
                        buildingType: tile.buildingType,
                        mode,
                        buffer: existing?.buffer || {},
                        inputBuffer: existing?.inputBuffer || {},
                        stalledTicks: existing?.stalledTicks || 0,
                        lastActiveTick: existing?.lastActiveTick || state.tickCount,
                        sectorName: tile.buildingType === BuildingType.TRAIN_STATION ? this.getRegionalSectorName(tile.x, tile.z) : undefined,
                    };
                    continue;
                }

                factory.nodes[key].sectorName = tile.buildingType === BuildingType.TRAIN_STATION
                    ? this.getRegionalSectorName(tile.x, tile.z)
                    : undefined;
            }
        }

        Object.keys(factory.nodes).forEach((key) => {
            if (!seen.has(key)) {
                delete factory.nodes[key];
            }
        });

        factory.packets = factory.packets.filter((packet) => factory.nodes[packet.fromKey] && factory.nodes[packet.toKey]);
    }

    private routeFactoryResources(state: GameState, factory: FactoryState): void {
        const pendingInbound: Array<{ to: FactoryNodeState; resource: FactoryResourceType; amount: number; target: 'buffer' | 'input' }> = [];
        let throughput = 0;
        let stalledNodes = 0;
        let regionalThroughput = 0;
        let dronePressureTotal = 0;
        let droneTrips = 0;
        let routeDebt = 0;
        const bottlenecks: FactoryPressurePoint[] = [];

        for (const node of Object.values(factory.nodes)) {
            for (const [resource, rawAmount] of Object.entries(node.buffer) as Array<[FactoryResourceType, number]>) {
                if (!rawAmount || rawAmount < 0.25) continue;

                const route = this.findRoute(factory, node, resource);
                if (!route) {
                    stalledNodes++;
                    routeDebt += rawAmount;
                    node.stalledTicks += 1;
                    this.pushPressurePoint(factory, bottlenecks, {
                        key: node.key,
                        buildingType: node.buildingType,
                        reason: 'ROUTE_DEBT',
                        severity: rawAmount + (node.stalledTicks * 0.5),
                        detail: `${resource} backed up with no route`,
                        resource,
                        sectorName: this.getNodeSector(factory, node),
                    });
                    continue;
                }

                const transportMode = this.getPacketTransportMode(node, route.node);
                const transferBudget = Math.max(0.75, this.getTransferBudget(node) + this.getSectorTransferBias(factory, node, route.node, transportMode));
                let amount = Math.min(rawAmount, transferBudget, this.getCapacityLeft(route.node, route.target));
                if (transportMode === 'DRONE') {
                    const droneAnchor = this.getDroneAnchor(factory, node, route.node);
                    amount = Math.min(amount, this.getDroneTransferBudget(factory, droneAnchor));
                    if (amount > 0) {
                        droneTrips += 1;
                        dronePressureTotal += this.getDronePressure(factory, droneAnchor);
                    }
                }
                if (amount <= 0) continue;

                node.buffer[resource] = rawAmount - amount;
                if (node.buffer[resource]! <= 0.001) {
                    delete node.buffer[resource];
                }

                if (route.node.mode === 'SINK') {
                    this.depositResource(state, resource, amount);
                } else {
                    pendingInbound.push({ to: route.node, resource, amount, target: route.target });
                }

                const sectorFrom = this.getPacketSector(factory, node, route.node, transportMode);
                const sectorTo = this.getPacketSector(factory, route.node, node, transportMode);
                if (transportMode === 'RAIL' && sectorFrom && sectorTo && sectorFrom !== sectorTo) {
                    regionalThroughput += amount;
                }

                factory.packets.push({
                    id: `${state.tickCount}-${node.key}-${route.node.key}-${resource}`,
                    resource,
                    amount,
                    fromKey: node.key,
                    toKey: route.node.key,
                    progress: 0,
                    speed: this.getPacketSpeed(transportMode),
                    transportMode,
                    sectorFrom,
                    sectorTo,
                });
                if (factory.packets.length > 128) {
                    factory.packets.splice(0, factory.packets.length - 128);
                }

                node.stalledTicks = 0;
                route.node.stalledTicks = Math.max(0, route.node.stalledTicks - 1);
                node.lastActiveTick = state.tickCount;
                route.node.lastActiveTick = state.tickCount;
                throughput += amount;
            }
        }

        for (const inbound of pendingInbound) {
            const bucket = inbound.target === 'input' ? inbound.to.inputBuffer : inbound.to.buffer;
            bucket[inbound.resource] = (bucket[inbound.resource] || 0) + inbound.amount;
        }

        factory.throughput = throughput / this.FACTORY_INTERVAL;
        factory.sectors = this.summarizeSectors(factory);
        factory.regionalThroughput = regionalThroughput / this.FACTORY_INTERVAL;
        factory.rechargePads = this.countRechargePads(factory);
        factory.droneTrips = droneTrips;
        factory.droneCharge = this.getDroneCharge(factory.rechargePads || 0, droneTrips);
        factory.droneUpkeep = this.getDroneUpkeep(droneTrips, factory.rechargePads || 0);
        factory.dronePressure = droneTrips > 0 ? dronePressureTotal / droneTrips : 0;
        factory.stalledNodes = stalledNodes;
        factory.backlog = Object.values(factory.nodes).reduce((sum, node) => {
            const out = Object.values(node.buffer).reduce((acc, value) => acc + (value || 0), 0);
            const input = Object.values(node.inputBuffer).reduce((acc, value) => acc + (value || 0), 0);
            return sum + out + input;
        }, 0);
        factory.pressure = this.buildFactoryPressure(factory, routeDebt, stalledNodes, bottlenecks);
        factory.lastNetworkTick = state.tickCount;
    }

    private findRoute(factory: FactoryState, origin: FactoryNodeState, resource: FactoryResourceType): { node: FactoryNodeState; target: 'buffer' | 'input' } | null {
        const visited = new Set<string>([origin.key]);
        const queue: Array<{ key: string; depth: number }> = [{ key: origin.key, depth: 0 }];
        let best: { node: FactoryNodeState; target: 'buffer' | 'input'; score: number } | null = null;

        while (queue.length > 0) {
            const current = queue.shift()!;
            const node = factory.nodes[current.key];
            if (!node) continue;

            for (const neighbor of this.getNeighbors(factory, node)) {
                if (visited.has(neighbor.key)) continue;
                visited.add(neighbor.key);

                const nextDepth = current.depth + 1;
                const acceptTarget = this.getAcceptTarget(neighbor, resource);
                if (acceptTarget) {
                    const score = this.scoreRouteCandidate(factory, origin, neighbor, resource, acceptTarget, nextDepth);
                    if (!best || score > best.score) {
                        best = { node: neighbor, target: acceptTarget, score };
                    }
                }

                if (neighbor.mode === 'TRANSPORT' && current.depth < this.MAX_ROUTE_DEPTH) {
                    queue.push({ key: neighbor.key, depth: nextDepth });
                }
            }
        }

        return best ? { node: best.node, target: best.target } : null;
    }

    private scoreRouteCandidate(
        factory: FactoryState,
        origin: FactoryNodeState,
        candidate: FactoryNodeState,
        resource: FactoryResourceType,
        target: 'buffer' | 'input',
        depth: number
    ): number {
        let score = 100 - (depth * 7) + this.getCapacityLeft(candidate, target) * 0.45;
        const transportMode = this.getPacketTransportMode(origin, candidate);
        const originSectorName = this.getNodeSector(factory, origin);
        const destinationSectorName = this.getNodeSector(factory, candidate);
        const originSector = originSectorName ? this.getSectorProfile(factory, originSectorName) : undefined;
        const destinationSector = destinationSectorName ? this.getSectorProfile(factory, destinationSectorName) : undefined;

        if (target === 'input') score += 3;
        if (candidate.mode === 'TRANSPORT') score += 2;
        if (destinationSector?.importFocus === resource) score += 7;
        if (originSector?.exportFocus === resource) score += 4;
        if (destinationSector?.directive === 'IMPORT') score += 5;
        if (originSector?.directive === 'EXPORT') score += 4;
        if (destinationSector?.priorityResource === resource) score += destinationSector.directive === 'IMPORT' ? 12 : 6;
        if (originSector?.priorityResource === resource) score += originSector.directive === 'EXPORT' ? 10 : 5;
        if (destinationSectorName && this.getEmergencyReliefSectors(factory).includes(destinationSectorName)) {
            score += destinationSector?.importFocus === resource ? 10 : 5;
        }
        if (this.getPinnedKeys(factory).includes(candidate.key) && target === 'input') {
            score += 7;
        }

        if (destinationSector?.flowMode === 'SURGE') score += 4;
        if (destinationSector?.flowMode === 'STABLE' && target === 'input') score += 2;
        if (originSector?.flowMode === 'SURGE') score += 2;
        if ((destinationSector?.satisfaction || 1) < 0.35) score += 6;
        if ((destinationSector?.bonusChain || 0) >= 3 && transportMode === 'RAIL') score += 2;

        const congestionPenalty = this.getCongestionPenalty(destinationSector, transportMode) + (originSector?.congestionLevel || 0) * 2;
        score -= congestionPenalty;
        score += this.getSectorContractPull(destinationSector, resource);

        if (transportMode === 'RAIL' && originSectorName && destinationSectorName && originSectorName !== destinationSectorName) {
            score += 5;
        }

        if (transportMode === 'DRONE') {
            const droneAnchor = this.getDroneAnchor(factory, origin, candidate);
            score -= this.getDronePressure(factory, droneAnchor) * 10;
        }

        return score;
    }

    private getCongestionPenalty(sector: FactorySectorState | undefined, mode: FactoryPacketTransportMode): number {
        if (!sector) return 0;
        const level = sector.congestionLevel || 0;
        const satisfactionPenalty = Math.max(0, 0.45 - (sector.satisfaction || 0.45)) * 8;
        if (sector.congestionPolicy === 'SAFE') return level * (mode === 'DRONE' ? 11 : 9) + satisfactionPenalty;
        if (sector.congestionPolicy === 'AGGRESSIVE') return level * (mode === 'DRONE' ? 3 : 2.5) + (satisfactionPenalty * 0.35);
        return level * (mode === 'DRONE' ? 7 : 5.5) + (satisfactionPenalty * 0.7);
    }

    private getSectorContractPull(sector: FactorySectorState | undefined, resource: FactoryResourceType): number {
        if (!sector) return 0;
        if (sector.contractResource !== resource) return 0;
        const target = sector.contractTarget || 0;
        if (target <= 0) return 0;
        const progress = Math.min(target, sector.contractProgress || 0);
        const unmetRatio = Math.max(0, 1 - (progress / target));
        const basePull = sector.importFocus === resource ? 16 : 9;
        const missedPressure = Math.min(6, (sector.missedQuotaTicks || 0) * 0.8);
        return unmetRatio * (basePull + missedPressure);
    }

    private getSectorTransferBias(
        factory: FactoryState,
        origin: FactoryNodeState,
        destination: FactoryNodeState,
        transportMode: FactoryPacketTransportMode
    ): number {
        const sectors = [
            this.getNodeSector(factory, origin),
            this.getNodeSector(factory, destination),
        ]
            .filter(Boolean)
            .map((name) => this.getSectorProfile(factory, name!))
            .filter(Boolean) as FactorySectorState[];

        let bias = 0;
        for (const sector of sectors) {
            if (sector.flowMode === 'SURGE') bias += transportMode === 'RAIL' ? 1.5 : 1;
            if (sector.flowMode === 'STABLE') bias -= 0.35;
            if (sector.congestionPolicy === 'AGGRESSIVE') bias += 0.6;
            if (sector.congestionPolicy === 'SAFE') bias -= 0.45;
            if ((sector.satisfaction || 1) < 0.4) bias += 0.9;
            if ((sector.bonusChain || 0) >= 2 && transportMode === 'RAIL') bias += 0.55;
            if (this.getEmergencyReliefSectors(factory).includes(sector.name)) bias += 0.75;
        }

        return bias;
    }

    private buildFactoryPressure(
        factory: FactoryState,
        routeDebt: number,
        stalledNodes: number,
        seedBottlenecks: FactoryPressurePoint[]
    ): FactoryPressureState {
        const bottlenecks = [...seedBottlenecks];
        let underfedProcessors = 0;
        let hotspots = 0;

        for (const node of Object.values(factory.nodes)) {
            const totalBuffered = this.getNodeBufferAmount(node.buffer) + this.getNodeBufferAmount(node.inputBuffer);
            if (node.stalledTicks >= 2 || totalBuffered >= 14) {
                hotspots += 1;
                this.pushPressurePoint(factory, bottlenecks, {
                    key: node.key,
                    buildingType: node.buildingType,
                    reason: 'CONGESTION',
                    severity: totalBuffered + (node.stalledTicks * 2),
                    detail: `Buffer ${Math.round(totalBuffered)} · stalled ${node.stalledTicks}`,
                    sectorName: this.getNodeSector(factory, node),
                });
            }

            const requiredInputs = this.getRequiredInputs(node);
            const missingInputs = requiredInputs.filter((resource) => (node.inputBuffer[resource] || 0) < 1);
            if (missingInputs.length > 0) {
                underfedProcessors += 1;
                this.pushPressurePoint(factory, bottlenecks, {
                    key: node.key,
                    buildingType: node.buildingType,
                    reason: 'UNDERFED',
                    severity: (missingInputs.length * 6) + node.stalledTicks + totalBuffered,
                    detail: `Waiting on ${missingInputs.join(', ')}`,
                    resource: missingInputs[0],
                    sectorName: this.getNodeSector(factory, node),
                });
            }
        }

        const totalHotspots = Math.max(hotspots, stalledNodes);
        const pinnedKeys = this.getPinnedKeys(factory);
        const emergencyReliefSectors = this.getEmergencyReliefSectors(factory);
        const corridors = this.buildCorridorInsights(factory, bottlenecks);
        const recommendations = this.buildPlannerRecommendations(bottlenecks, pinnedKeys, emergencyReliefSectors, {
            routeDebt,
            underfedProcessors,
            hotspots: totalHotspots,
        }, corridors);
        const chronicDebt = Math.max(0, routeDebt - 10);
        const chronicUnderfed = Math.max(0, underfedProcessors - 1);
        const chronicHotspots = Math.max(0, hotspots - 1);
        const efficiencyPenalty = Math.min(
            0.28,
            (chronicDebt * 0.0035) + (chronicUnderfed * 0.025) + (chronicHotspots * 0.015) - (emergencyReliefSectors.length * 0.012)
        );

        return {
            routeDebt: Math.round(routeDebt * 10) / 10,
            underfedProcessors,
            hotspots: totalHotspots,
            bottlenecks: bottlenecks.slice(0, 6),
            pinnedKeys,
            emergencyReliefSectors,
            recommendations,
            efficiencyPenalty: Math.max(0, Math.round(efficiencyPenalty * 100) / 100),
            corridors,
        };
    }

    private pushPressurePoint(factory: FactoryState, bottlenecks: FactoryPressurePoint[], point: FactoryPressurePoint): void {
        const pinned = this.getPinnedKeys(factory).includes(point.key);
        const relief = point.sectorName ? this.getEmergencyReliefSectors(factory).includes(point.sectorName) : false;
        bottlenecks.push({
            ...point,
            severity: point.severity + (pinned ? 4 : 0) + (relief ? 2 : 0),
        });
        bottlenecks.sort((a, b) => b.severity - a.severity);
        if (bottlenecks.length > 6) {
            bottlenecks.length = 6;
        }
    }

    private buildCorridorInsights(factory: FactoryState, bottlenecks: FactoryPressurePoint[]): FactoryCorridorState[] {
        const previousByName = new Map((factory.pressure?.corridors || []).map((corridor) => [corridor.sectorName, corridor]));

        return (factory.sectors || [])
            .map((sector) => {
                const previous = previousByName.get(sector.name);
                const throughput = Math.round((sector.throughput || 0) * 10) / 10;
                const history = [...(previous?.history || []).slice(-5), throughput];
                const baselineThroughput = Math.round(((history[0] ?? throughput) || 0) * 10) / 10;
                const trend = this.getCorridorTrend(history);
                const improvement = Math.round((throughput - baselineThroughput) * 10) / 10;
                const routeDebtShare = Math.round(this.getCorridorRouteDebtShare(bottlenecks, sector.name) * 10) / 10;
                const underfedProcessors = bottlenecks.filter((point) => point.reason === 'UNDERFED' && point.sectorName === sector.name).length;
                const hotspots = bottlenecks.filter((point) => point.reason === 'CONGESTION' && point.sectorName === sector.name).length;
                const recommendedBuilding = this.getCorridorSuggestedBuilding(routeDebtShare, underfedProcessors, hotspots);

                return {
                    id: `corridor:${sector.name}`,
                    sectorName: sector.name,
                    anchorKey: this.getCorridorAnchorKey(factory, sector.name) || previous?.anchorKey || `${sector.name}:anchor`,
                    throughput,
                    baselineThroughput,
                    history,
                    trend,
                    improvement,
                    routeDebtShare,
                    underfedProcessors,
                    hotspots,
                    congestionLevel: Math.round((sector.congestionLevel || 0) * 100) / 100,
                    satisfaction: Math.round((sector.satisfaction ?? 0.72) * 100) / 100,
                    bonusChain: sector.bonusChain || 0,
                    recommendedBuilding,
                    followThrough: this.getCorridorFollowThrough(sector.name, routeDebtShare, underfedProcessors, hotspots, trend, improvement),
                };
            })
            .sort((a, b) => this.getCorridorPriorityScore(b) - this.getCorridorPriorityScore(a))
            .slice(0, 4);
    }

    private getCorridorTrend(history: number[]): FactoryCorridorState['trend'] {
        if (!history || history.length < 2) return 'FLAT';
        const latest = history[history.length - 1];
        const previousAverage = history.slice(0, -1).reduce((sum, value) => sum + value, 0) / (history.length - 1);
        const delta = latest - previousAverage;
        if (delta > 1.5) return 'UP';
        if (delta < -1.5) return 'DOWN';
        return 'FLAT';
    }

    private getCorridorRouteDebtShare(bottlenecks: FactoryPressurePoint[], sectorName: string): number {
        return bottlenecks
            .filter((point) => point.reason === 'ROUTE_DEBT' && point.sectorName === sectorName)
            .reduce((sum, point) => sum + point.severity, 0);
    }

    private getCorridorSuggestedBuilding(routeDebtShare: number, underfedProcessors: number, hotspots: number): BuildingType {
        if (routeDebtShare >= 8) return BuildingType.RAIL_LINE;
        if (underfedProcessors > 0) return BuildingType.DRONE_DEPOT;
        if (hotspots > 0) return BuildingType.DISTRIBUTION_HUB;
        return BuildingType.TRAIN_STATION;
    }

    private getCorridorPriorityScore(corridor: FactoryCorridorState): number {
        return corridor.routeDebtShare
            + (corridor.underfedProcessors * 8)
            + (corridor.hotspots * 6)
            + (corridor.congestionLevel * 12)
            + ((1 - corridor.satisfaction) * 10)
            - corridor.improvement;
    }

    private getCorridorAnchorKey(factory: FactoryState, sectorName: string): string | undefined {
        const sectorNodes = Object.values(factory.nodes).filter((node) => this.getNodeSector(factory, node) === sectorName);
        return sectorNodes.find((node) => node.buildingType === BuildingType.TRAIN_STATION)?.key
            || sectorNodes.find((node) => node.buildingType === BuildingType.RAIL_LINE)?.key
            || sectorNodes.find((node) => node.buildingType === BuildingType.DRONE_DEPOT)?.key
            || sectorNodes[0]?.key;
    }

    private getCorridorFollowThrough(
        sectorName: string,
        routeDebtShare: number,
        underfedProcessors: number,
        hotspots: number,
        trend: FactoryCorridorState['trend'],
        improvement: number
    ): string {
        if (routeDebtShare >= 8) {
            return `Anchor fresh rail in ${sectorName} until route debt falls back under the lane budget.`;
        }
        if (underfedProcessors > 0) {
            return `Chain depot relief into hungry processors until ${underfedProcessors} cluster${underfedProcessors === 1 ? '' : 's'} clear.`;
        }
        if (hotspots > 0) {
            return `Bleed buffer pressure before ${sectorName} drops into another satisfaction dip.`;
        }
        if (trend === 'UP') {
            return `Flow is improving by ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}. Hold the lane steady and protect the quota streak.`;
        }
        if (trend === 'DOWN') {
            return `Throughput is sliding by ${improvement.toFixed(1)}. Re-center capacity here before the next miss lands.`;
        }
        return `Keep ${sectorName} balanced and only intervene if debt or underfed pressure returns.`;
    }

    private buildPlannerRecommendations(
        bottlenecks: FactoryPressurePoint[],
        pinnedKeys: string[],
        emergencyReliefSectors: string[],
        metrics: { routeDebt: number; underfedProcessors: number; hotspots: number },
        corridors: FactoryCorridorState[]
    ): FactoryPlannerRecommendation[] {
        const routeDebtPoint = bottlenecks.find((point) => point.reason === 'ROUTE_DEBT');
        const underfedPoint = bottlenecks.find((point) => point.reason === 'UNDERFED');
        const congestionPoint = bottlenecks.find((point) => point.reason === 'CONGESTION');
        const routeDebtCorridor = this.findRecommendationCorridor(corridors, routeDebtPoint);
        const underfedCorridor = this.findRecommendationCorridor(corridors, underfedPoint);
        const congestionCorridor = this.findRecommendationCorridor(corridors, congestionPoint);
        const recommendations: FactoryPlannerRecommendation[] = [];

        if (routeDebtPoint) {
            recommendations.push(this.buildScopedRecommendation(
                routeDebtPoint,
                'Reinforce rail corridor',
                `Chronic route debt ${Math.round(metrics.routeDebt)} is choking ${routeDebtPoint.sectorName || 'the main transfer lane'} while corridor flow is ${this.getCorridorTrendLabel(routeDebtCorridor?.trend)}.`,
                routeDebtCorridor?.recommendedBuilding || this.getSuggestedBuilding(routeDebtPoint),
                pinnedKeys,
                emergencyReliefSectors,
                routeDebtCorridor
            ));
        }

        if (underfedPoint) {
            recommendations.push(this.buildScopedRecommendation(
                underfedPoint,
                'Stabilize processor cluster',
                `Processors are idling on ${underfedPoint.resource || 'critical inputs'} across ${metrics.underfedProcessors} stressed clusters, and the feeder lane is ${this.getCorridorTrendLabel(underfedCorridor?.trend)}.`,
                underfedCorridor?.recommendedBuilding || this.getSuggestedBuilding(underfedPoint),
                pinnedKeys,
                emergencyReliefSectors,
                underfedCorridor
            ));
        }

        if (congestionPoint) {
            recommendations.push(this.buildScopedRecommendation(
                congestionPoint,
                'Expand depot relief',
                `Buffers are pooling faster than the hub can clear them across ${metrics.hotspots} hotspot${metrics.hotspots === 1 ? '' : 's'}, and the lane is ${this.getCorridorTrendLabel(congestionCorridor?.trend)}.`,
                congestionCorridor?.recommendedBuilding || this.getSuggestedBuilding(congestionPoint),
                pinnedKeys,
                emergencyReliefSectors,
                congestionCorridor
            ));
        }

        return recommendations.slice(0, 4);
    }

    private findRecommendationCorridor(
        corridors: FactoryCorridorState[],
        point?: FactoryPressurePoint
    ): FactoryCorridorState | undefined {
        if (!point) return corridors[0];
        return corridors.find((corridor) => point.sectorName && corridor.sectorName === point.sectorName)
            || corridors.find((corridor) => corridor.anchorKey === point.key)
            || corridors[0];
    }

    private getCorridorTrendLabel(trend?: FactoryCorridorState['trend']): string {
        if (trend === 'UP') return 'recovering';
        if (trend === 'DOWN') return 'slipping';
        return 'holding flat';
    }

    private buildScopedRecommendation(
        point: FactoryPressurePoint,
        title: string,
        lead: string,
        suggestedBuilding: BuildingType,
        pinnedKeys: string[],
        emergencyReliefSectors: string[],
        corridor?: FactoryCorridorState
    ): FactoryPlannerRecommendation {
        const isPinned = pinnedKeys.includes(point.key);
        const isRelief = point.sectorName ? emergencyReliefSectors.includes(point.sectorName) : false;
        const flags = [isPinned ? 'pinned' : '', isRelief ? 'relief' : ''].filter(Boolean).join(' · ');
        const corridorDetail = corridor ? ` · anchor ${corridor.anchorKey} · ${corridor.followThrough}` : '';

        return {
            id: `${point.reason}:${point.key}:${point.resource || 'none'}`,
            title,
            detail: `${lead} ${point.detail}${corridorDetail}${flags ? ` · ${flags}` : ''}`.trim(),
            reason: point.reason,
            severity: point.severity,
            targetKey: corridor?.anchorKey || point.key,
            sectorName: point.sectorName,
            resource: point.resource,
            suggestedBuilding: corridor?.recommendedBuilding || suggestedBuilding,
        };
    }

    private getSuggestedBuilding(point: FactoryPressurePoint): BuildingType {
        if (point.reason === 'ROUTE_DEBT') {
            return BuildingType.RAIL_LINE;
        }
        if (point.reason === 'UNDERFED') {
            return point.sectorName ? BuildingType.DRONE_DEPOT : BuildingType.STORAGE_DEPOT;
        }
        return point.sectorName ? BuildingType.DRONE_DEPOT : BuildingType.TRAIN_STATION;
    }

    private getPinnedKeys(factory: FactoryState): string[] {
        return factory.pressure?.pinnedKeys || [];
    }

    private getEmergencyReliefSectors(factory: FactoryState): string[] {
        return factory.pressure?.emergencyReliefSectors || [];
    }

    private getRequiredInputs(node: FactoryNodeState): FactoryResourceType[] {
        if ([BuildingType.WASH_PLANT, BuildingType.RECYCLING_PLANT].includes(node.buildingType)) {
            return ['ORE'];
        }
        if (node.buildingType === BuildingType.ORE_FOUNDRY) {
            return ['CONCENTRATE', 'STONE'];
        }
        if (node.buildingType === BuildingType.GEM_REFINERY) {
            return ['CONCENTRATE'];
        }
        if (node.buildingType === BuildingType.WORKSHOP) {
            return ['REFINED_MATERIALS', 'WOOD', 'ALLOYS'];
        }
        if (node.buildingType === BuildingType.GREEN_TECH_LAB) {
            return ['REFINED_MATERIALS', 'ALLOYS', 'MACHINE_PARTS'];
        }
        return [];
    }

    private getNodeBufferAmount(buffer: Partial<Record<FactoryResourceType, number>>): number {
        return Object.values(buffer).reduce((sum, value) => sum + (value || 0), 0);
    }

    private getNeighbors(factory: FactoryState, node: FactoryNodeState): FactoryNodeState[] {
        const keys = [
            `${node.x + 1},${node.z}`,
            `${node.x - 1},${node.z}`,
            `${node.x},${node.z + 1}`,
            `${node.x},${node.z - 1}`,
        ];

        const neighborMap = new Map<string, FactoryNodeState>();
        keys.map((key) => factory.nodes[key]).filter(Boolean).forEach((neighbor) => {
            neighborMap.set(neighbor.key, neighbor);
        });

        if (node.buildingType === BuildingType.TRAIN_STATION) {
            this.findRailLinkedStations(factory, node).forEach((neighbor) => neighborMap.set(neighbor.key, neighbor));
        }
        if (this.isDroneHub(node.buildingType)) {
            this.findDroneServedNodes(factory, node).forEach((neighbor) => neighborMap.set(neighbor.key, neighbor));
        }

        return Array.from(neighborMap.values());
    }

    private findRailLinkedStations(factory: FactoryState, origin: FactoryNodeState): FactoryNodeState[] {
        const linked: FactoryNodeState[] = [];
        const visited = new Set<string>([origin.key]);
        const queue: FactoryNodeState[] = [origin];

        while (queue.length > 0) {
            const current = queue.shift()!;
            const keys = [
                `${current.x + 1},${current.z}`,
                `${current.x - 1},${current.z}`,
                `${current.x},${current.z + 1}`,
                `${current.x},${current.z - 1}`,
            ];

            for (const key of keys) {
                if (visited.has(key)) continue;
                const next = factory.nodes[key];
                if (!next) continue;
                if (![BuildingType.RAIL_LINE, BuildingType.TRAIN_STATION].includes(next.buildingType)) continue;

                visited.add(key);
                if (next.buildingType === BuildingType.TRAIN_STATION && next.key !== origin.key) {
                    linked.push(next);
                    continue;
                }

                queue.push(next);
            }
        }

        return linked;
    }

    private findDroneServedNodes(factory: FactoryState, origin: FactoryNodeState): FactoryNodeState[] {
        const linked: FactoryNodeState[] = [];
        const serviceRadius = this.getDroneServiceRadius(origin);

        for (const node of Object.values(factory.nodes)) {
            if (node.key === origin.key) continue;
            if (node.mode === 'TRANSPORT') continue;

            const manhattanDistance = Math.abs(node.x - origin.x) + Math.abs(node.z - origin.z);
            if (manhattanDistance <= serviceRadius) {
                linked.push(node);
            }
        }

        return linked;
    }

    private getAcceptTarget(node: FactoryNodeState, resource: FactoryResourceType): 'buffer' | 'input' | null {
        if (node.mode === 'TRANSPORT') {
            return this.getCapacityLeft(node, 'buffer') > 0 ? 'buffer' : null;
        }

        if (node.mode === 'SINK') {
            return ['MINERALS', 'WOOD', 'STONE', 'GEMS', 'REFINED_MATERIALS', 'ALLOYS', 'MACHINE_PARTS', 'AUTOMATION_KITS'].includes(resource)
                ? 'buffer'
                : null;
        }

        if (node.mode !== 'PROCESSOR') return null;

        if ([BuildingType.WASH_PLANT, BuildingType.RECYCLING_PLANT].includes(node.buildingType)) {
            return resource === 'ORE' && this.getCapacityLeft(node, 'input') > 0 ? 'input' : null;
        }

        if (node.buildingType === BuildingType.ORE_FOUNDRY) {
            return (resource === 'CONCENTRATE' || resource === 'STONE') && this.getCapacityLeft(node, 'input') > 0 ? 'input' : null;
        }

        if (node.buildingType === BuildingType.GEM_REFINERY) {
            return resource === 'CONCENTRATE' && this.getCapacityLeft(node, 'input') > 0 ? 'input' : null;
        }

        if (node.buildingType === BuildingType.WORKSHOP) {
            return (resource === 'REFINED_MATERIALS' || resource === 'WOOD' || resource === 'ALLOYS') && this.getCapacityLeft(node, 'input') > 0
                ? 'input'
                : null;
        }

        if (node.buildingType === BuildingType.GREEN_TECH_LAB) {
            return (resource === 'REFINED_MATERIALS' || resource === 'ALLOYS' || resource === 'MACHINE_PARTS') && this.getCapacityLeft(node, 'input') > 0
                ? 'input'
                : null;
        }

        return null;
    }

    private getTransferBudget(node: FactoryNodeState): number {
        if (node.buildingType === BuildingType.TRAIN_STATION) return 12;
        if (node.buildingType === BuildingType.DRONE_DEPOT) return 8;
        if (node.buildingType === BuildingType.DISTRIBUTION_HUB) return 6;
        if (node.buildingType === BuildingType.RAIL_LINE) return 4;
        return 3;
    }

    private getCapacityLeft(node: FactoryNodeState, target: 'buffer' | 'input'): number {
        const cap = node.buildingType === BuildingType.TRAIN_STATION
            ? 36
            : node.buildingType === BuildingType.DRONE_DEPOT
                ? 28
                : node.buildingType === BuildingType.DISTRIBUTION_HUB
                    ? 24
                    : node.mode === 'TRANSPORT'
                        ? 10
                        : 20;
        const active = target === 'input' ? node.inputBuffer : node.buffer;
        const used = Object.values(active).reduce((sum, value) => sum + (value || 0), 0);
        return Math.max(0, cap - used);
    }

    private getPacketTransportMode(origin: FactoryNodeState, destination: FactoryNodeState): FactoryPacketTransportMode {
        if (this.isDroneHub(origin.buildingType) && destination.mode !== 'TRANSPORT') return 'DRONE';
        if (this.isDroneHub(destination.buildingType) && origin.mode !== 'TRANSPORT') return 'DRONE';
        if (origin.buildingType === BuildingType.TRAIN_STATION || destination.buildingType === BuildingType.TRAIN_STATION) return 'RAIL';
        if (origin.buildingType === BuildingType.RAIL_LINE || destination.buildingType === BuildingType.RAIL_LINE) return 'RAIL';
        return 'BELT';
    }

    private getPacketSpeed(mode: FactoryPacketTransportMode): number {
        if (mode === 'RAIL') return this.RAIL_TRAVEL_SPEED;
        if (mode === 'DRONE') return this.DRONE_TRAVEL_SPEED;
        return this.BELT_TRAVEL_SPEED;
    }

    private getRegionalSectorName(x: number, z: number): string {
        const regionX = Math.floor(x / this.SECTOR_SIZE);
        const regionZ = Math.floor(z / this.SECTOR_SIZE);
        const northSouth = regionZ < 0 ? 'North' : regionZ > 0 ? 'South' : 'Central';
        const eastWest = regionX < 0 ? 'West' : regionX > 0 ? 'East' : 'Crown';
        const landmarks = ['Basin', 'Spur', 'Reach', 'Yard', 'Escarpment', 'Works'];
        const prefix = [northSouth, eastWest]
            .filter((part) => part !== 'Central' && part !== 'Crown')
            .join(' ');
        const landmark = landmarks[Math.abs(regionX * 7 + regionZ * 11) % landmarks.length];
        return `${prefix || 'Central'} ${landmark}`;
    }

    private summarizeSectors(factory: FactoryState): FactorySectorState[] {
        const throughputBySector = new Map<string, number>();
        const stationCountBySector = new Map<string, number>();
        const contractProgressBySector = new Map<string, number>();
        const dronePressureBySector = new Map<string, number>();
        const previousByName = new Map((factory.sectors || []).map((sector) => [sector.name, sector]));

        Object.values(factory.nodes)
            .filter((node) => node.buildingType === BuildingType.TRAIN_STATION && node.sectorName)
            .forEach((node) => {
                const name = node.sectorName!;
                stationCountBySector.set(name, (stationCountBySector.get(name) || 0) + 1);
                dronePressureBySector.set(name, (dronePressureBySector.get(name) || 0) + this.getDronePressure(factory, node));
            });

        factory.packets
            .filter((packet) => packet.transportMode === 'RAIL' && packet.sectorFrom && packet.sectorTo && packet.sectorFrom !== packet.sectorTo)
            .forEach((packet) => {
                throughputBySector.set(packet.sectorFrom!, (throughputBySector.get(packet.sectorFrom!) || 0) + packet.amount);
                throughputBySector.set(packet.sectorTo!, (throughputBySector.get(packet.sectorTo!) || 0) + packet.amount);

                const previousDestination = previousByName.get(packet.sectorTo!);
                if (previousDestination?.contractResource === packet.resource) {
                    contractProgressBySector.set(packet.sectorTo!, (contractProgressBySector.get(packet.sectorTo!) || 0) + packet.amount);
                }
            });

        return Array.from(stationCountBySector.entries()).map(([name, stationCount]) =>
            this.buildSectorProfile(
                name,
                stationCount,
                throughputBySector.get(name) || 0,
                contractProgressBySector.get(name) || 0,
                dronePressureBySector.get(name) || 0,
                previousByName.get(name)
            )
        );
    }

    private buildSectorProfile(
        name: string,
        stationCount: number,
        throughput: number,
        contractProgress: number,
        dronePressure: number,
        previous?: FactorySectorState
    ): FactorySectorState {
        const exportFocuses: FactoryResourceType[] = ['MINERALS', 'WOOD', 'STONE', 'GEMS', 'REFINED_MATERIALS', 'ALLOYS'];
        const importFocuses: FactoryResourceType[] = ['WOOD', 'STONE', 'MINERALS', 'MACHINE_PARTS', 'AUTOMATION_KITS', 'ALLOYS'];
        const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const exportFocus = exportFocuses[hash % exportFocuses.length];
        const importFocus = importFocuses[(hash + 3) % importFocuses.length];
        const directive = previous?.directive || 'BALANCED';
        const priorityResource = previous?.priorityResource || (directive === 'IMPORT' ? importFocus : exportFocus);
        const flowMode = previous?.flowMode || 'STABLE';
        const congestionPolicy = previous?.congestionPolicy || 'BALANCED';
        const defaultContractResource = directive === 'EXPORT' ? exportFocus : importFocus;
        const contractResource = previous?.contractResource || defaultContractResource;
        const contractTarget = previous?.contractTarget || (18 + stationCount * 8 + Math.round(throughput * 0.35));
        const congestionLevel = Math.max(0, Math.min(1, (throughput / Math.max(18, stationCount * 18)) + (dronePressure * 0.55)));
        const cappedProgress = Math.min(contractTarget, contractProgress);
        const completion = contractTarget > 0 ? cappedProgress / contractTarget : 0;
        const previousSatisfaction = previous?.satisfaction ?? 0.72;
        const previousBonusChain = previous?.bonusChain ?? 0;
        const previousMissedTicks = previous?.missedQuotaTicks ?? 0;

        let satisfaction = previousSatisfaction;
        let bonusChain = previousBonusChain;
        let missedQuotaTicks = previousMissedTicks;

        if (completion >= 1) {
            bonusChain = Math.min(5, previousBonusChain + 1);
            missedQuotaTicks = 0;
            satisfaction = Math.min(1, previousSatisfaction + 0.12 + (bonusChain * 0.01));
        } else if (completion >= 0.7) {
            bonusChain = Math.max(0, previousBonusChain - 0);
            missedQuotaTicks = Math.max(0, previousMissedTicks - 1);
            satisfaction = Math.min(1, Math.max(0.48, previousSatisfaction + 0.02));
        } else if (completion >= 0.4) {
            bonusChain = Math.max(0, previousBonusChain - 1);
            missedQuotaTicks = previousMissedTicks + 1;
            satisfaction = Math.max(0.18, previousSatisfaction - 0.08);
        } else {
            bonusChain = 0;
            missedQuotaTicks = previousMissedTicks + 2;
            satisfaction = Math.max(0.05, previousSatisfaction - 0.16);
        }

        return {
            name,
            exportFocus,
            importFocus,
            exportBonus: 0.06 + ((hash % 4) * 0.02),
            importDiscount: 0.05 + (((hash + 2) % 3) * 0.02),
            demandBonus: 0.04 + ((hash % 3) * 0.01),
            stationCount,
            throughput,
            directive,
            priorityResource,
            flowMode,
            congestionPolicy,
            congestionLevel,
            contractResource,
            contractTarget,
            contractProgress: cappedProgress,
            contractReward: Math.round(contractTarget * (4 + ((hash % 3) * 0.5)) * (1 + (bonusChain * 0.08))),
            satisfaction,
            bonusChain,
            missedQuotaTicks,
        };
    }

    private getSectorProfile(factory: FactoryState, name: string): FactorySectorState | undefined {
        return (factory.sectors || []).find((sector) => sector.name === name);
    }

    private getPacketSector(
        factory: FactoryState,
        origin: FactoryNodeState,
        destination: FactoryNodeState,
        mode: FactoryPacketTransportMode
    ): string | undefined {
        if (mode === 'DRONE') {
            return this.getDroneAnchor(factory, origin, destination)?.sectorName;
        }

        const direct = this.getNodeSector(factory, origin);
        if (direct) return direct;
        return this.getNodeSector(factory, destination);
    }

    private getNodeSector(factory: FactoryState, node: FactoryNodeState): string | undefined {
        if (node.sectorName) return node.sectorName;
        if (node.buildingType === BuildingType.RAIL_LINE) {
            return this.findRailLinkedStations(factory, node)[0]?.sectorName;
        }
        return this.findNearbyDroneHubs(factory, node)[0]?.sectorName;
    }

    private getDroneAnchor(factory: FactoryState, origin: FactoryNodeState, destination: FactoryNodeState): FactoryNodeState | null {
        if (this.isDroneHub(origin.buildingType)) return origin;
        if (this.isDroneHub(destination.buildingType)) return destination;
        return this.findNearbyDroneHubs(factory, origin)[0] || this.findNearbyDroneHubs(factory, destination)[0] || null;
    }

    private findNearbyDroneHubs(factory: FactoryState, origin: FactoryNodeState): FactoryNodeState[] {
        return Object.values(factory.nodes)
            .filter((node) => this.isDroneHub(node.buildingType))
            .filter((node) => Math.abs(node.x - origin.x) + Math.abs(node.z - origin.z) <= this.getDroneServiceRadius(node))
            .sort((a, b) => {
                const distanceA = Math.abs(a.x - origin.x) + Math.abs(a.z - origin.z);
                const distanceB = Math.abs(b.x - origin.x) + Math.abs(b.z - origin.z);
                return distanceA - distanceB;
            });
    }

    private countActiveDroneTrips(factory: FactoryState, station: FactoryNodeState | null): number {
        if (!station) return 0;
        return factory.packets.filter((packet) => packet.transportMode === 'DRONE' && (packet.fromKey === station.key || packet.toKey === station.key)).length;
    }

    private getDroneTransferBudget(factory: FactoryState, station: FactoryNodeState | null): number {
        const activeTrips = this.countActiveDroneTrips(factory, station);
        const rechargePads = this.getDroneRechargePadCapacity(station);
        if (activeTrips <= Math.max(1, Math.floor(rechargePads / 2))) return 3;
        if (activeTrips <= Math.max(this.DRONE_SOFT_CAP, rechargePads)) return 2.25;
        if (activeTrips < Math.max(this.DRONE_HARD_CAP, rechargePads + 2)) return 1.5;
        return 0.75;
    }

    private getDronePressure(factory: FactoryState, station: FactoryNodeState | null): number {
        const activeTrips = this.countActiveDroneTrips(factory, station);
        return Math.min(1, activeTrips / Math.max(this.DRONE_HARD_CAP, this.getDroneRechargePadCapacity(station)));
    }

    private getDroneServiceRadius(station: FactoryNodeState | null): number {
        if (!station) return this.MAX_DRONE_RADIUS;
        return station.buildingType === BuildingType.DRONE_DEPOT ? this.DRONE_DEPOT_RADIUS : this.MAX_DRONE_RADIUS;
    }

    private getDroneRechargePadCapacity(station: FactoryNodeState | null): number {
        if (!station) return 2;
        if (station.buildingType === BuildingType.DRONE_DEPOT) return 10;
        return station.buildingType === BuildingType.TRAIN_STATION ? 4 : 2;
    }

    private countRechargePads(factory: FactoryState): number {
        return Object.values(factory.nodes)
            .filter((node) => this.isDroneHub(node.buildingType))
            .reduce((sum, node) => sum + this.getDroneRechargePadCapacity(node), 0);
    }

    private getDroneCharge(rechargePads: number, droneTrips: number): number {
        if (rechargePads <= 0) return droneTrips > 0 ? 0.2 : 1;
        return Math.max(0.18, Math.min(1, 1 - (droneTrips / (rechargePads * 1.5))));
    }

    private getDroneUpkeep(droneTrips: number, rechargePads: number): number {
        if (droneTrips <= 0) return 0;
        const overload = Math.max(0, droneTrips - rechargePads);
        return Math.round((droneTrips * 1.5 + overload * 2) * 10) / 10;
    }

    private depositResource(state: GameState, resource: FactoryResourceType, amount: number): void {
        if (!state.industry) {
            state.industry = {
                refinedMaterials: 0,
                alloys: 0,
                machineParts: 0,
                automationKits: 0,
                automatedChains: 0,
                gridLoad: 0,
            };
        }

        if (resource === 'MINERALS') state.resources.minerals = Math.min(state.resources.maxCapacity, state.resources.minerals + amount);
        if (resource === 'WOOD') state.resources.wood = Math.min(state.resources.maxCapacity, state.resources.wood + amount);
        if (resource === 'STONE') state.resources.stone = Math.min(state.resources.maxCapacity, state.resources.stone + amount);
        if (resource === 'GEMS') state.resources.gems += amount;
        if (resource === 'REFINED_MATERIALS') state.industry.refinedMaterials += amount;
        if (resource === 'ALLOYS') state.industry.alloys += amount;
        if (resource === 'MACHINE_PARTS') state.industry.machineParts += amount;
        if (resource === 'AUTOMATION_KITS') state.industry.automationKits += amount;
    }

    private updateExploration(state: GameState) {
        const radius = 3;
        const chunks = state.chunks;

        for (const agent of state.agents) {
            const cx = Math.floor(agent.x);
            const cz = Math.floor(agent.z);

            for (let dz = -radius; dz <= radius; dz++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (dx * dx + dz * dz > radius * radius) continue;

                    const tx = cx + dx;
                    const tz = cz + dz;

                    const tile = ChunkStore.getTile(chunks, tx, tz);
                    if (tile && !tile.explored) {
                        tile.explored = true;
                    }
                }
            }
        }
    }
}
