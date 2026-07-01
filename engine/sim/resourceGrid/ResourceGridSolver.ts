export type ResourceGridRole = 'PRODUCER' | 'CARRIER' | 'CONSUMER';
export type ResourceGridServiceMetric = 'MANHATTAN' | 'CHEBYSHEV';
export type ResourceGridConsumerStatus = 'DISCONNECTED' | 'SHORTAGE' | 'SUPPLIED';

export interface ResourceGridParticipant {
    id: string;
    networkType: string;
    x: number;
    z: number;
    roles: ResourceGridRole[];
    production?: number;
    demand?: number;
    priority?: number;
    serviceRadius?: number;
    serviceMetric?: ResourceGridServiceMetric;
}

export interface ResourceGridConsumerResult {
    id: string;
    status: ResourceGridConsumerStatus;
    requested: number;
    allocated: number;
}

export interface ResourceGridComponentResult {
    id: number;
    producerIds: string[];
    carrierIds: string[];
    consumerIds: string[];
    produced: number;
    connectedDemand: number;
    consumed: number;
    deficit: number;
}

export interface ResourceGridSolveResult {
    networkType: string;
    totalProduced: number;
    connectedDemand: number;
    strandedDemand: number;
    totalConsumed: number;
    deficit: number;
    connectedNodeIds: string[];
    consumers: ResourceGridConsumerResult[];
    components: ResourceGridComponentResult[];
}

type ConductiveNode = ResourceGridParticipant & { roles: ResourceGridRole[] };
type ConsumerNode = ResourceGridParticipant & { roles: ResourceGridRole[] };

const ORTHOGONAL_OFFSETS = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
] as const;

function coordinateKey(x: number, z: number): string {
    return `${x},${z}`;
}

function hasRole(node: ResourceGridParticipant, role: ResourceGridRole): boolean {
    return node.roles.includes(role);
}

function normalizedAmount(value: number | undefined): number {
    return Math.max(0, value || 0);
}

function compareById(a: { id: string }, b: { id: string }): number {
    return a.id.localeCompare(b.id);
}

function distanceWithinRadius(
    from: ResourceGridParticipant,
    to: ResourceGridParticipant,
    radius: number,
    metric: ResourceGridServiceMetric,
): boolean {
    const dx = Math.abs(from.x - to.x);
    const dz = Math.abs(from.z - to.z);
    if (metric === 'CHEBYSHEV') return Math.max(dx, dz) <= radius;
    return dx + dz <= radius;
}

function getServiceRadius(node: ResourceGridParticipant): number {
    return Math.max(0, node.serviceRadius || 0);
}

function getServiceMetric(node: ResourceGridParticipant): ResourceGridServiceMetric {
    return node.serviceMetric || 'MANHATTAN';
}

export function solveResourceGridNetwork(
    networkType: string,
    participants: ResourceGridParticipant[],
): ResourceGridSolveResult {
    const nodes = participants
        .filter(node => node.networkType === networkType)
        .slice()
        .sort(compareById);

    const conductiveNodes = nodes.filter(node => hasRole(node, 'PRODUCER') || hasRole(node, 'CARRIER')) as ConductiveNode[];
    const consumers = nodes.filter(node => hasRole(node, 'CONSUMER') && normalizedAmount(node.demand) > 0) as ConsumerNode[];
    const conductiveByCoordinate = new Map<string, ConductiveNode[]>();

    for (const node of conductiveNodes) {
        const key = coordinateKey(node.x, node.z);
        const bucket = conductiveByCoordinate.get(key) || [];
        bucket.push(node);
        conductiveByCoordinate.set(key, bucket.sort(compareById));
    }

    const connectedConductiveIds = new Set<string>();
    const assignedConsumerIds = new Set<string>();
    const componentResults: ResourceGridComponentResult[] = [];
    let componentId = 0;

    const producers = conductiveNodes
        .filter(node => hasRole(node, 'PRODUCER') && normalizedAmount(node.production) > 0)
        .sort(compareById);

    for (const source of producers) {
        if (connectedConductiveIds.has(source.id)) continue;

        const queue: ConductiveNode[] = [source];
        const componentConductive = new Map<string, ConductiveNode>();
        connectedConductiveIds.add(source.id);

        let head = 0;
        while (head < queue.length) {
            const node = queue[head++];
            componentConductive.set(node.id, node);

            for (const offset of ORTHOGONAL_OFFSETS) {
                const neighbors = conductiveByCoordinate.get(coordinateKey(node.x + offset.x, node.z + offset.z)) || [];
                for (const neighbor of neighbors) {
                    if (connectedConductiveIds.has(neighbor.id)) continue;
                    connectedConductiveIds.add(neighbor.id);
                    queue.push(neighbor);
                }
            }
        }

        const componentNodes = Array.from(componentConductive.values()).sort(compareById);
        const componentConsumers = collectServiceableConsumers(componentNodes, consumers, assignedConsumerIds);
        componentConsumers.forEach(consumer => assignedConsumerIds.add(consumer.id));

        const produced = componentNodes.reduce((sum, node) => sum + (hasRole(node, 'PRODUCER') ? normalizedAmount(node.production) : 0), 0);
        const allocated = allocateComponentConsumers(produced, componentConsumers);
        const consumed = allocated.reduce((sum, consumer) => sum + consumer.allocated, 0);
        const connectedDemand = componentConsumers.reduce((sum, consumer) => sum + normalizedAmount(consumer.demand), 0);

        componentResults.push({
            id: componentId++,
            producerIds: componentNodes.filter(node => hasRole(node, 'PRODUCER')).map(node => node.id),
            carrierIds: componentNodes.filter(node => hasRole(node, 'CARRIER')).map(node => node.id),
            consumerIds: componentConsumers.map(node => node.id),
            produced,
            connectedDemand,
            consumed,
            deficit: Math.max(0, connectedDemand - produced),
        });
    }

    const consumerResults = buildConsumerResults(consumers, componentResults);
    const totalProduced = componentResults.reduce((sum, component) => sum + component.produced, 0);
    const connectedDemand = componentResults.reduce((sum, component) => sum + component.connectedDemand, 0);
    const totalConsumed = componentResults.reduce((sum, component) => sum + component.consumed, 0);
    const strandedDemand = consumers
        .filter(consumer => !assignedConsumerIds.has(consumer.id))
        .reduce((sum, consumer) => sum + normalizedAmount(consumer.demand), 0);

    return {
        networkType,
        totalProduced,
        connectedDemand,
        strandedDemand,
        totalConsumed,
        deficit: Math.max(0, connectedDemand - totalProduced),
        connectedNodeIds: Array.from(connectedConductiveIds).sort(),
        consumers: consumerResults,
        components: componentResults,
    };
}

function collectServiceableConsumers(
    connectedNodes: ResourceGridParticipant[],
    consumers: ConsumerNode[],
    assignedConsumerIds: Set<string>,
): ConsumerNode[] {
    const serviceable = new Map<string, ConsumerNode>();

    for (const connectedNode of connectedNodes) {
        const radius = getServiceRadius(connectedNode);
        const metric = getServiceMetric(connectedNode);
        for (const consumer of consumers) {
            if (assignedConsumerIds.has(consumer.id)) continue;
            if (!distanceWithinRadius(connectedNode, consumer, radius, metric)) continue;
            serviceable.set(consumer.id, consumer);
        }
    }

    return Array.from(serviceable.values()).sort(compareConsumersForAllocation);
}

function compareConsumersForAllocation(a: ConsumerNode, b: ConsumerNode): number {
    const priorityDelta = (b.priority || 0) - (a.priority || 0);
    if (priorityDelta !== 0) return priorityDelta;
    return compareById(a, b);
}

function allocateComponentConsumers(totalProduced: number, consumers: ConsumerNode[]): ResourceGridConsumerResult[] {
    let remaining = totalProduced;
    return consumers.map(consumer => {
        const requested = normalizedAmount(consumer.demand);
        if (requested <= remaining) {
            remaining -= requested;
            return { id: consumer.id, status: 'SUPPLIED', requested, allocated: requested };
        }

        return { id: consumer.id, status: 'SHORTAGE', requested, allocated: 0 };
    });
}

function buildConsumerResults(
    consumers: ConsumerNode[],
    components: ResourceGridComponentResult[],
): ResourceGridConsumerResult[] {
    const byId = new Map<string, ResourceGridConsumerResult>();

    for (const component of components) {
        const allocation = allocateComponentConsumers(
            component.produced,
            consumers.filter(consumer => component.consumerIds.includes(consumer.id)).sort(compareConsumersForAllocation),
        );
        allocation.forEach(result => byId.set(result.id, result));
    }

    for (const consumer of consumers) {
        if (byId.has(consumer.id)) continue;
        byId.set(consumer.id, {
            id: consumer.id,
            status: 'DISCONNECTED',
            requested: normalizedAmount(consumer.demand),
            allocated: 0,
        });
    }

    return Array.from(byId.values()).sort(compareById);
}
