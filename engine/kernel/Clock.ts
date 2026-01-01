/**
 * Engine Kernel - High-Precision Clock
 * Manages frame timing, delta calculation, and fixed-step accumulator
 */

export class Clock {
    private lastTimestamp = 0;
    private startTime = 0;
    private frameCount = 0;

    /** Delta time since last tick (seconds) */
    public delta = 0;

    /** Total elapsed time since start (seconds) */
    public time = 0;

    /** Fixed timestep for simulation (seconds) */
    public fixedDt: number;

    /** Accumulator for fixed-step timing */
    public accumulator = 0;

    /** Current frame number */
    public frame = 0;

    constructor(fixedTickRate = 60) {
        this.fixedDt = 1 / fixedTickRate;
    }

    /**
     * Initialize clock - call once before starting the loop
     */
    start(now = performance.now()) {
        this.startTime = now;
        this.lastTimestamp = now;
        this.time = 0;
        this.delta = 0;
        this.accumulator = 0;
        this.frameCount = 0;
    }

    /**
     * Tick the clock - call once per frame at the start
     * @returns delta time in seconds
     */
    tick(now = performance.now()): number {
        // Calculate delta, clamped to prevent spiral of death on tab switch
        const rawDelta = (now - this.lastTimestamp) / 1000;
        this.delta = Math.min(rawDelta, 0.1); // Max 100ms

        this.lastTimestamp = now;
        this.time = (now - this.startTime) / 1000;
        this.accumulator += this.delta;
        this.frame = ++this.frameCount;

        return this.delta;
    }

    /**
     * Consume fixed timesteps from accumulator
     * @param maxSteps Maximum steps to prevent overload
     * @returns Number of simulation steps to run this frame
     */
    consumeFixedSteps(maxSteps = 5): number {
        let steps = 0;
        while (this.accumulator >= this.fixedDt && steps < maxSteps) {
            this.accumulator -= this.fixedDt;
            steps++;
        }
        return steps;
    }

    /**
     * Get interpolation alpha for rendering between simulation steps
     * Useful for smooth rendering at variable framerates
     */
    getAlpha(): number {
        return this.accumulator / this.fixedDt;
    }

    /**
     * Get current FPS based on delta
     */
    getFPS(): number {
        return this.delta > 0 ? 1 / this.delta : 0;
    }
}
