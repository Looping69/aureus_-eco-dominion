export interface SeededRandom {
    seed: number;
    next: () => number;
    range: (min: number, max: number) => number;
    rangeInt: (min: number, max: number) => number;
    chance: (probability: number) => boolean;
}

/** A reproducible generator shared by game runtimes. */
export function createSeededRandom(seed: number): SeededRandom {
    let value = (seed >>> 0) || 1;
    return {
        seed: value,
        next: () => {
            value = (value * 1664525 + 1013904223) >>> 0;
            return value / 0x100000000;
        },
        range: (min: number, max: number) => min + ((value = (value * 1664525 + 1013904223) >>> 0) / 0x100000000) * (max - min),
        rangeInt: (min: number, max: number) => Math.floor(min + ((value = (value * 1664525 + 1013904223) >>> 0) / 0x100000000) * (max - min)),
        chance: (probability: number) => ((value = (value * 1664525 + 1013904223) >>> 0) / 0x100000000) < probability,
    };
}
