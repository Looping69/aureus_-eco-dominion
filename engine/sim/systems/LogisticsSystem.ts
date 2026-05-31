
import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import {
    BuildingType,
    FactoryNodeState,
    FactoryPacketState,
    FactoryPacketTransportMode,
    FactoryResourceType,
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
    private readonly BELT_TRAVEL_SPEED = 1.8;
    private readonly RAIL_TRAVEL_SPEED = 2.7;
    private readonly DRONE_TRAVEL_SPEED = 2.2;

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
            };
        }

        if (!state.factory.packets) {
            state.factory.packets = [];
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
            BuildingType.DISTRIBUTION_HUB,
        ].includes(type);
    }

    private getNodeMode(type: BuildingType): FactoryNodeState['mode'] | null {
        if ([BuildingType.RAIL_LINE, BuildingType.DISTRIBUTION_HUB, BuildingType.TRAIN_STATION].includes(type)) return 'TRANSPORT';
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
                    };
                }
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

        for (const node of Object.values(factory.nodes)) {
            for (const [resource, rawAmount] of Object.entries(node.buffer) as Array<[FactoryResourceType, number]>) {
                if (!rawAmount || rawAmount < 0.25) continue;

                const route = this.findRoute(factory, node, resource);
                if (!route) {
                    stalledNodes++;
                    node.stalledTicks += 1;
                    continue;
                }

                const amount = Math.min(rawAmount, this.getTransferBudget(node), this.getCapacityLeft(route.node, route.target));
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

                const transportMode = this.getPacketTransportMode(node, route.node);
                factory.packets.push({
                    id: `${state.tickCount}-${node.key}-${route.node.key}-${resource}`,
                    resource,
                    amount,
                    fromKey: node.key,
                    toKey: route.node.key,
                    progress: 0,
                    speed: this.getPacketSpeed(transportMode),
                    transportMode,
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

        for (const node of Object.values(factory.nodes)) {
            if (node.key === origin.key) continue;
            if (node.mode === 'TRANSPORT') continue;

            const manhattanDistance = Math.abs(node.x - origin.x) + Math.abs(node.z - origin.z);
            if (manhattanDistance <= this.MAX_DRONE_RADIUS) {
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
        if (node.buildingType === BuildingType.DISTRIBUTION_HUB) return 6;
        if (node.buildingType === BuildingType.RAIL_LINE) return 4;
        return 3;
    }

    private getCapacityLeft(node: FactoryNodeState, target: 'buffer' | 'input'): number {
        const cap = node.buildingType === BuildingType.TRAIN_STATION ? 36 : node.buildingType === BuildingType.DISTRIBUTION_HUB ? 24 : node.mode === 'TRANSPORT' ? 10 : 20;
        const active = target === 'input' ? node.inputBuffer : node.buffer;
        const used = Object.values(active).reduce((sum, value) => sum + (value || 0), 0);
        return Math.max(0, cap - used);
    }

    private getPacketTransportMode(origin: FactoryNodeState, destination: FactoryNodeState): FactoryPacketTransportMode {
        if (origin.buildingType === BuildingType.TRAIN_STATION && destination.mode !== 'TRANSPORT') return 'DRONE';
        if (destination.buildingType === BuildingType.TRAIN_STATION && origin.mode !== 'TRANSPORT') return 'DRONE';
        if (origin.buildingType === BuildingType.TRAIN_STATION || destination.buildingType === BuildingType.TRAIN_STATION) return 'RAIL';
        if (origin.buildingType === BuildingType.RAIL_LINE || destination.buildingType === BuildingType.RAIL_LINE) return 'RAIL';
        return 'BELT';
    }

    private getPacketSpeed(mode: FactoryPacketTransportMode): number {
        if (mode === 'RAIL') return this.RAIL_TRAVEL_SPEED;
        if (mode === 'DRONE') return this.DRONE_TRAVEL_SPEED;
        return this.BELT_TRAVEL_SPEED;
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
