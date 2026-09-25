/** State storage and change notification independent of a game's state shape. */
export type StateListener<State> = (newState: State) => void;
export type MutableContext = 'none' | 'command' | 'simTick';

export class StateStore<State extends object> {
    protected state: State;
    private listeners = new Set<StateListener<State>>();
    private dirtyKeys = new Set<keyof State>();
    private mutableContext: MutableContext = 'none';

    constructor(private readonly createInitialState: (overrides?: Partial<State>) => State, overrides?: Partial<State>) {
        this.state = createInitialState(overrides);
    }

    getState(): State { return this.state; }
    getMutableState(): State { return this.state; }
    setMutableContext(context: MutableContext): void { this.mutableContext = context; }

    subscribe(listener: StateListener<State>): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notifyIfDirty(): void {
        if (this.dirtyKeys.size === 0) return;
        this.listeners.forEach(listener => listener(this.state));
        this.dirtyKeys.clear();
    }

    markDirty(...keys: (keyof State)[]): void {
        keys.forEach(key => this.dirtyKeys.add(key));
    }

    getDirtyKeys(): Set<keyof State> { return new Set(this.dirtyKeys); }

    mutate<Key extends keyof State>(key: Key, value: State[Key]): void {
        if (this.mutableContext === 'none') {
            console.warn(`[StateManager] Direct mutation of '${String(key)}' outside sim/command context. Use update() for UI actions.`);
        }
        this.state[key] = value;
        this.markDirty(key);
    }

    update(partial: Partial<State>): void {
        Object.assign(this.state, partial);
        this.markDirty(...(Object.keys(partial) as (keyof State)[]));
    }

    loadState(newState: State): void {
        this.state = this.createInitialState(newState);
        this.markDirty(...(Object.keys(this.state) as (keyof State)[]));
        this.notifyIfDirty();
    }

    serializeState(): string { return JSON.stringify(this.state); }
}
