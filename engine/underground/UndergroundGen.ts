import { Random } from '../kernel/Random';
import { UndergroundHazard, UndergroundState, UndergroundTile } from '../types/underground';

function hashUndergroundSeed(seed: number, x: number, z: number, depth: number): number {
    // Mix coordinates into a 32-bit seed. Keeps determinism stable across platforms.
    let h = seed | 0;
    h = Math.imul(h ^ (x | 0), 0x9e3779b1);
    h = Math.imul(h ^ (z | 0), 0x85ebca6b);
    h = Math.imul(h ^ (depth | 0), 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
}

function rollHazard(rng: Random): UndergroundHazard {
    const r = rng.next();
    if (r < 0.03) return 'GAS';
    if (r < 0.05) return 'WATER';
    if (r < 0.07) return 'HEAT';
    if (r < 0.10) return 'UNSTABLE';
    if (r < 0.12) return 'LOW_OXYGEN';
    return 'NONE';
}

export function generateUndergroundTile(seed: number, x: number, z: number, depth: number = 1): UndergroundTile {
    const rng = new Random(hashUndergroundSeed(seed, x, z, depth));

    const stability = Math.round(rng.range(55, 100));
    const oxygen = Math.round(rng.range(40, 100));
    const hazard = rollHazard(rng);

    // Phase 1 only needs deterministic tile metadata; deposits are placeholders for Phase 2.
    const depositRoll = rng.next();
    const deposit =
        depositRoll < 0.10
            ? { type: 'MINERALS' as const, richness: rng.range(0.2, 0.8) }
            : depositRoll < 0.13
                ? { type: 'GEMS' as const, richness: rng.range(0.1, 0.5) }
                : depositRoll < 0.135
                    ? { type: 'AUREUS_VEIN' as const, richness: rng.range(0.05, 0.2) }
                    : depositRoll < 0.145
                        ? { type: 'RELIC_FRAGMENT' as const, richness: rng.range(0.05, 0.2) }
                        : { type: 'NONE' as const, richness: 0 };

    return {
        x,
        z,
        depth,
        stability,
        oxygen,
        hazard,
        deposit,
    };
}

export function createInitialUndergroundState(seed: number): UndergroundState {
    return {
        schemaVersion: 1,
        depth: 1,
        depthLabel: 'Sector B1',
        stability: 100,
        oxygen: 100,
        exposureRisk: 0,
        tiles: {},
        surveyedByDrill: {},
    };
}

