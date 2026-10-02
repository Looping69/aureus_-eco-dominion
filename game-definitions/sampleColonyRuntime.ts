import { validateGameCommandType } from '../engine/game-definition';
import { SAMPLE_COLONY_GAME_DEFINITION } from './sampleColony';
import { BaseWorld } from '../engine/world/World';
import { StateStore } from '../engine/state/StateStore';
import { JsonSaveStorage } from '../engine/state/JsonSaveStorage';
import { BaseSimSystem, Simulation } from '../engine/sim/Simulation';
import type { EngineCommand } from '../engine/kernel/Command';
import type { FixedContext } from '../engine/kernel/Types';
import { createSampleState, decodeSampleSave, SAMPLE_PACK_ID, SAMPLE_SAVE_KEY, SAMPLE_SAVE_VERSION, type SampleColonyState } from './sampleColonyState';

export type SampleCommandResult = { ok: boolean; reason: string };

class ColonySystem extends BaseSimSystem {
    readonly id = 'sample.energy';
    readonly priority = 0;
    tick(_ctx: FixedContext, state: SampleColonyState): void {
        state.ticks++;
        if (state.ticks % 30 === 0) state.energy = Math.min(100, state.energy + 1);
    }
}

/** A distinct game: spend solar energy to commission beacons. No Aureus state. */
export class SampleColonyWorld extends BaseWorld {
    readonly id = SAMPLE_PACK_ID;
    private readonly store = new StateStore<SampleColonyState>(createSampleState);
    private readonly sim = new Simulation();
    private readonly saves: JsonSaveStorage;
    private queue: EngineCommand[] = [];
    private sequence = 0;
    lastResult: SampleCommandResult | null = null;

    constructor(storage?: Storage) {
        super();
        this.saves = new JsonSaveStorage(SAMPLE_SAVE_KEY, () => storage ?? localStorage);
        this.sim.addSystem(new ColonySystem());
    }
    protected onInit(): void { this.sim.init(); }
    protected onTeardown(): void { this.queue = []; this.sim.dispose(); }
    snapshot(): SampleColonyState { return { ...this.store.getState() }; }
    subscribe(listener: (state: SampleColonyState) => void): () => void {
        return this.store.subscribe(state => listener({ ...state }));
    }
    command(type: string): SampleCommandResult {
        if (this.state !== 'ready') return { ok: false, reason: 'World is not ready' };
        if (!validateGameCommandType(SAMPLE_COLONY_GAME_DEFINITION, type).ok) return { ok: false, reason: 'Unknown sample command' };
        this.queue.push({ id: `sample-${++this.sequence}`, type, payload: {} });
        return { ok: true, reason: 'Queued' };
    }
    simulation(ctx: FixedContext): void {
        if (this.state !== 'ready') return;
        const state = this.store.getMutableState();
        for (const _command of this.queue.splice(0)) {
            if (state.energy < 5) {
                this.lastResult = { ok: false, reason: 'A beacon needs 5 energy' };
            } else {
                state.energy -= 5;
                state.beacons++;
                this.lastResult = { ok: true, reason: 'Beacon commissioned' };
            }
        }
        this.sim.tick(ctx, state);
        this.store.markDirty('ticks', 'energy', 'beacons');
        this.store.notifyIfDirty();
    }
    serialize(): string {
        return JSON.stringify({ packId: SAMPLE_PACK_ID, schemaVersion: SAMPLE_SAVE_VERSION, state: this.snapshot() });
    }
    save(): void { this.saves.write(this.serialize()); }
    load(serialized: string | null = this.saves.read()): boolean {
        if (serialized === null || this.state !== 'ready') return false;
        try {
            const state = decodeSampleSave(serialized);
            this.queue = [];
            this.lastResult = null;
            this.store.loadState(state);
            return true;
        } catch { return false; }
    }
}
