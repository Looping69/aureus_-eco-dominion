import { Chunk } from '../types/world';
import {
    UndergroundState,
    UndergroundTile,
    UndergroundHazardType,
    UndergroundResourceType,
    DEFAULT_UNDERGROUND_SECTOR_ID
} from '../types/underground';

const MIN_DEPTH = 20;
const DEPTH_RANGE = 80;
const MIN_STABILITY = 15;
const BASE_STABILITY = 40;
const STABILITY_RANGE = 60;
const MIN_OXYGEN = 10;
const BASE_OXYGEN = 35;
const OXYGEN_RANGE = 65;
const MAX_EXPOSURE = 30;

function hash(seed: number, x: number, z: number, salt: number = 0): number {
    const n = Math.sin((x + 11.73) * 12.9898 + (z - 9.31) * 78.233 + (seed + salt) * 0.0174533) * 43758.5453;
    return n - Math.floor(n);
}

function pickResource(seed: number, x: number, z: number): UndergroundResourceType {
    const r = hash(seed, x, z, 101);
    if (r > 0.98) return 'AUREUS_VEIN';
    if (r > 0.93) return 'RELIC_FRAGMENT';
    if (r > 0.80) return 'GEMS';
    if (r > 0.35) return 'MINERALS';
    return 'EMPTY';
}

function pickHazard(seed: number, x: number, z: number): UndergroundHazardType {
    const r = hash(seed, x, z, 202);
    if (r > 0.985) return 'GAS';
    if (r > 0.97) return 'FLOODING';
    if (r > 0.955) return 'HEAT';
    if (r > 0.92) return 'INSTABILITY';
    return 'NONE';
}

export function generateUndergroundTile(seed: number, x: number, z: number): UndergroundTile {
    const depthNoise = hash(seed, x, z, 7);
    const stabilityNoise = hash(seed, x, z, 17);
    const oxygenNoise = hash(seed, x, z, 29);
    const exposureNoise = hash(seed, x, z, 43);

    return {
        x,
        z,
        depth: MIN_DEPTH + Math.floor(depthNoise * DEPTH_RANGE),
        surveyed: false,
        stability: Math.min(100, Math.max(MIN_STABILITY, Math.round(BASE_STABILITY + stabilityNoise * STABILITY_RANGE))),
        oxygen: Math.min(100, Math.max(MIN_OXYGEN, Math.round(BASE_OXYGEN + oxygenNoise * OXYGEN_RANGE))),
        exposure: Math.round(exposureNoise * MAX_EXPOSURE),
        resource: pickResource(seed, x, z),
        hazard: pickHazard(seed, x, z),
    };
}

export function createUndergroundState(seed: number, chunks: Record<string, Chunk>): UndergroundState {
    const tiles: Record<string, UndergroundTile> = {};
    for (const chunk of Object.values(chunks)) {
        for (const tile of chunk.tiles) {
            const key = `${tile.x},${tile.z}`;
            tiles[key] = generateUndergroundTile(seed, tile.x, tile.z);
        }
    }

    return {
        sectorId: DEFAULT_UNDERGROUND_SECTOR_ID,
        tiles,
    };
}
