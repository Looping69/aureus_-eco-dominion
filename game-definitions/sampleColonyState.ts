export const SAMPLE_PACK_ID = 'sample.micro-colony';
export const SAMPLE_SAVE_KEY = 'sample_micro_colony_v1';
export const SAMPLE_SAVE_VERSION = 1;

export interface SampleColonyState {
    ticks: number;
    energy: number;
    beacons: number;
}

export function createSampleState(overrides: Partial<SampleColonyState> = {}): SampleColonyState {
    return { ticks: 0, energy: 10, beacons: 0, ...overrides };
}

/** Validate the entire envelope before returning a replacement state. */
export function decodeSampleSave(serialized: string): SampleColonyState {
    const value = JSON.parse(serialized);
    if (value?.packId !== SAMPLE_PACK_ID || value?.schemaVersion !== SAMPLE_SAVE_VERSION) {
        throw new Error('Incompatible sample colony save');
    }
    const s = value.state;
    if (!s || !Number.isSafeInteger(s.ticks) || s.ticks < 0
        || !Number.isSafeInteger(s.energy) || s.energy < 0 || s.energy > 100
        || !Number.isSafeInteger(s.beacons) || s.beacons < 0) {
        throw new Error('Invalid sample colony state');
    }
    return { ticks: s.ticks, energy: s.energy, beacons: s.beacons };
}
