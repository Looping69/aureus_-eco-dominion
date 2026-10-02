import { BuildingType } from '../types/buildings';

export const STARTER_FOG_CLEAR_RADIUS = 18;
export const AGENT_FOG_REVEAL_RADIUS = 12;
export const BUILDING_FOG_REVEAL_RADIUS = 14;
const STARTER_FOG_REVEAL_GRID = 6;

export type FogRevealCenter = { key: string; x: number; z: number; radius: number };
export type FogExplorationState = { centers: FogRevealCenter[]; version: number };

function finiteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeFogRevealCenter(center: any): FogRevealCenter | null {
    if (typeof center?.key !== 'string') return null;
    const x = finiteNumber(center.x);
    const z = finiteNumber(center.z);
    const radius = finiteNumber(center.radius);
    if (x === null || z === null || radius === null || radius <= 0) return null;
    return { key: center.key, x, z, radius };
}

function ensureFogExplorationState(state: any): FogExplorationState {
    const existing = state.fogExploration;
    const centers = Array.isArray(existing?.centers)
        ? existing.centers.map(normalizeFogRevealCenter).filter((center): center is FogRevealCenter => Boolean(center))
        : [];
    const version = finiteNumber(existing?.version) ?? centers.length;

    if (!existing || !Array.isArray(existing.centers) || centers.length !== existing.centers.length || !Number.isFinite(existing.version)) {
        state.fogExploration = { centers, version };
    }

    return state.fogExploration;
}

function pointFromEntity(entity: any): { x: number; z: number } | null {
    const x = finiteNumber(entity?.x) ?? finiteNumber(entity?.position?.x) ?? finiteNumber(entity?.worldX);
    const z = finiteNumber(entity?.z) ?? finiteNumber(entity?.position?.z) ?? finiteNumber(entity?.worldZ);
    return x === null || z === null ? null : { x, z };
}

function quantizedKey(prefix: string, x: number, z: number): string {
    const qx = Math.round(x / STARTER_FOG_REVEAL_GRID) * STARTER_FOG_REVEAL_GRID;
    const qz = Math.round(z / STARTER_FOG_REVEAL_GRID) * STARTER_FOG_REVEAL_GRID;
    return `${prefix}:${qx},${qz}`;
}

function isCompletedBuildingTile(tile: any): boolean {
    if (!tile || tile.isUnderConstruction) return false;
    return typeof tile.buildingType === 'string'
        && tile.buildingType !== BuildingType.EMPTY
        && tile.buildingType !== BuildingType.POND;
}

export function collectCurrentFogRevealCenters(state: any): FogRevealCenter[] {
    const centers: FogRevealCenter[] = [];
    const spawnX = Math.round(state.spawnX ?? 0);
    const spawnZ = Math.round(state.spawnZ ?? 0);
    centers.push({ key: 'spawn', x: spawnX, z: spawnZ, radius: STARTER_FOG_CLEAR_RADIUS });

    const agents = [...(state.agents ?? []), ...(state.ambientNpcs ?? [])];
    for (const agent of agents) {
        const point = pointFromEntity(agent);
        if (!point) continue;
        centers.push({
            key: quantizedKey('agent', point.x, point.z),
            x: point.x,
            z: point.z,
            radius: AGENT_FOG_REVEAL_RADIUS,
        });
    }

    for (const chunk of Object.values(state.chunks ?? {}) as any[]) {
        for (const tile of chunk?.tiles ?? []) {
            if (!isCompletedBuildingTile(tile)) continue;
            const x = finiteNumber(tile.x) ?? finiteNumber(tile.worldX);
            const z = finiteNumber(tile.z) ?? finiteNumber(tile.worldZ);
            if (x === null || z === null) continue;
            centers.push({
                key: quantizedKey('building', x, z),
                x,
                z,
                radius: BUILDING_FOG_REVEAL_RADIUS,
            });
        }
    }

    return centers;
}

export class FogExplorationTracker {
    private centers = new Map<string, FogRevealCenter>();
    private version = 0;
    private hydratedVersion = -1;
    private hydratedState: FogExplorationState | null = null;

    updateFromState(state: any, onChanged?: () => void): void {
        this.hydrateFromState(state);
        let changed = false;

        for (const center of collectCurrentFogRevealCenters(state)) {
            const previous = this.centers.get(center.key);
            if (previous && previous.radius >= center.radius) continue;
            this.centers.set(center.key, center);
            this.version += 1;
            changed = true;
        }

        if (!changed) return;
        this.writeToState(state);
        onChanged?.();
    }

    getCenters(): FogRevealCenter[] {
        return Array.from(this.centers.values());
    }

    getVersion(): number {
        return this.version;
    }

    private hydrateFromState(state: any): void {
        const fogState = ensureFogExplorationState(state);
        if (fogState === this.hydratedState && fogState.version === this.hydratedVersion) return;
        this.hydratedState = fogState;
        this.centers = new Map(fogState.centers.map((center) => [center.key, center]));
        this.version = fogState.version;
        this.hydratedVersion = fogState.version;
    }

    private writeToState(state: any): void {
        const fogState = ensureFogExplorationState(state);
        fogState.centers = this.getCenters();
        fogState.version = this.version;
        this.hydratedVersion = this.version;
    }
}
