export interface AutosaveEnvironment {
    window: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
    document: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
    isHidden: () => boolean;
    setInterval: (callback: () => void, milliseconds: number) => unknown;
    clearInterval: (timer: unknown) => void;
}

/** A constructed world is not a colony session until New Game or successful Continue. */
export class ColonyAutosave {
    private active = false;
    private disposed = false;
    private started = false;
    private timer: unknown;
    private readonly beforeUnload = () => this.saveNow();
    private readonly visibilityChanged = () => { if (this.environment.isHidden()) this.saveNow(); };

    constructor(private readonly save: () => void, private readonly environment: AutosaveEnvironment = {
        window, document,
        isHidden: () => document.visibilityState === 'hidden',
        setInterval: (callback, ms) => setInterval(callback, ms),
        clearInterval: timer => clearInterval(timer as ReturnType<typeof setInterval>),
    }) {}

    start(): void {
        if (this.started || this.disposed) return;
        this.started = true;
        this.timer = this.environment.setInterval(this.beforeUnload, 60000);
        this.environment.window.addEventListener('beforeunload', this.beforeUnload);
        this.environment.document.addEventListener('visibilitychange', this.visibilityChanged);
    }

    activate(): void { if (!this.disposed) this.active = true; }

    saveNow(): void { if (this.active && !this.disposed) this.save(); }

    dispose(): void {
        if (this.disposed) return;
        const saveOnShutdown = this.active;
        this.disposed = true;
        if (this.started) {
            this.environment.clearInterval(this.timer);
            this.environment.window.removeEventListener('beforeunload', this.beforeUnload);
            this.environment.document.removeEventListener('visibilitychange', this.visibilityChanged);
        }
        if (saveOnShutdown) this.save();
    }
}
