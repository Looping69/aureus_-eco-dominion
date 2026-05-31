
import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import {
    BuildingType,
    FactoryNodeState,
    FactoryPacketState,
    FactoryPacketTransportMode,
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

        for (const node of Object.values(factory.nodes)) {
            for (const [resource, rawAmount] of Object.entries(node.buffer) as Array<[FactoryResourceType, number]>) {
                if (!rawAmount || rawAmount < 0.25) continue;

                const route = this.findRoute(factory, node, resource);
                if (!route) {
                    stalledNodes++;
                    node.stalledTicks += 1;
                    continue;
                }

                const transportMode = this.getPacketTransportMode(node, route.node);
                let amount = Math.min(rawAmount, this.getTransferBudget(node), this.getCapacityLeft(route.node, route.target));
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
        factory.lastNetworkTick = state.tickCount;
    }

    private findRoute(factory: FactoryState, origin: FactoryNodeState, resource: FactoryResourceType): { node: FactoryNodeState; target: 'buffer' | 'input' } | null {
        const visited = new Set<string>([origin.key]);
        const queue: Array<{ key: string; depth: number }> = [{ key: origin.key, depth: 0 }];

        while (queue.length > 0) {
            const current = queue.shift()!;
            const node = factory.nodes[current.key];
            if (!node) continue;

            for (const neighbor of this.getNeighbors(factory, node)) {
                if (visited.has(neighbor.key)) continue;
                visited.add(neighbor.key);

                const acceptTarget = this.getAcceptTarget(neighbor, resource);
                if (acceptTarget) {
                    return { node: neighbor, target: acceptTarget };
                }

                if (neighbor.mode === 'TRANSPORT' && current.depth < this.MAX_ROUTE_DEPTH) {
                    queue.push({ key: neighbor.key, depth: current.depth + 1 });
                }
            }
        }

        return null;
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

        Object.values(factory.nodes)
            .filter((node) => node.buildingType === BuildingType.TRAIN_STATION && node.sectorName)
            .forEach((node) => {
                const name = node.sectorName!;
                stationCountBySector.set(name, (stationCountBySector.get(name) || 0) + 1);
            });

        factory.packets
            .filter((packet) => packet.transportMode === 'RAIL' && packet.sectorFrom && packet.sectorTo && packet.sectorFrom !== packet.sectorTo)
            .forEach((packet) => {
                throughputBySector.set(packet.sectorFrom!, (throughputBySector.get(packet.sectorFrom!) || 0) + packet.amount);
                throughputBySector.set(packet.sectorTo!, (throughputBySector.get(packet.sectorTo!) || 0) + packet.amount);
            });

        return Array.from(stationCountBySector.entries()).map(([name, stationCount]) =>
            this.buildSectorProfile(name, stationCount, throughputBySector.get(name) || 0)
        );
    }

    private buildSectorProfile(name: string, stationCount: number, throughput: number): FactorySectorState {
        const exportFocuses: FactoryResourceType[] = ['MINERALS', 'WOOD', 'STONE', 'GEMS', 'REFINED_MATERIALS', 'ALLOYS'];
        const importFocuses: FactoryResourceType[] = ['WOOD', 'STONE', 'MINERALS', 'MACHINE_PARTS', 'AUTOMATION_KITS', 'ALLOYS'];
        const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return {
            name,
            exportFocus: exportFocuses[hash % exportFocuses.length],
            importFocus: importFocuses[(hash + 3) % importFocuses.length],
            exportBonus: 0.06 + ((hash % 4) * 0.02),
            importDiscount: 0.05 + (((hash + 2) % 3) * 0.02),
            demandBonus: 0.04 + ((hash % 3) * 0.01),
            stationCount,
            throughput,
        };
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
