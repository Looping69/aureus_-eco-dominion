/**
 * Engine Jobs - Worker Pool
 * Manages a pool of web workers for parallel processing
 * Note: Worker script itself is separate - this manages the pool
 */

import { Job, JobResult, ENGINE_SCHEMA_VERSION } from './jobs.types';
import { JobSystem } from './JobSystem';

/** Worker pool configuration */
export interface WorkerPoolConfig {
    /** Number of workers to spawn */
    workerCount: number;
    /** Path to worker script */
    workerScript: string;
    /** Bundler-compatible worker factory supplied by the game. */
    createWorker?: () => Worker;
    /** Max jobs to dispatch per frame */
    maxJobsPerFrame: number;
}

interface WorkerEntry {
    worker: Worker;
    busy: boolean;
    currentJobId: string | null;
}

export class WorkerPool {
    private workers: WorkerEntry[] = [];
    private config: WorkerPoolConfig;
    private initialized = false;
    private jobCallbackMap = new Map<string, { entry: WorkerEntry, jobSystem: JobSystem }>();

    constructor(config: Partial<WorkerPoolConfig> = {}) {
        this.config = {
            workerCount: Math.max(1, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) - 1),
            // Use Vite/Webpack compatible worker import
            workerScript: '', // Supply a URL or a bundler-compatible factory
            maxJobsPerFrame: 8,
            ...config,
        };
    }

    /**
     * Initialize the worker pool
     */
    init(): void {
        if (this.initialized) return;
        if (!this.config.createWorker && !this.config.workerScript) {
            throw new Error('WorkerPool requires a worker factory or script URL');
        }

        for (let i = 0; i < this.config.workerCount; i++) {
            try {
                const worker = this.config.createWorker
                    ? this.config.createWorker()
                    : new Worker(this.config.workerScript, { type: 'module' });

                const entry: WorkerEntry = {
                    worker,
                    busy: false,
                    currentJobId: null,
                };

                // Persistent message handler
                worker.onmessage = (e: MessageEvent) => {
                    const result = e.data as JobResult;

                    // Protocol validation
                    if (result.schemaVersion !== ENGINE_SCHEMA_VERSION) {
                        console.error(`[WorkerPool] CRITICAL: Schema version mismatch in result from worker. Expected ${ENGINE_SCHEMA_VERSION}, got ${result.schemaVersion}. Killing worker.`);
                        worker.terminate();
                        this.workers = this.workers.filter(w => w.worker !== worker);
                        return;
                    }

                    const pending = this.jobCallbackMap.get(result.jobId);

                    if (pending) {
                        this.jobCallbackMap.delete(result.jobId);
                        pending.entry.busy = false;
                        pending.entry.currentJobId = null;
                        pending.jobSystem.pushResult(result);
                    }
                };

                this.workers.push(entry);
            } catch (e) {
                console.warn(`[WorkerPool] Failed to create worker ${i}:`, e);
            }
        }

        this.initialized = true;
        console.log(`[WorkerPool] Initialized with ${this.workers.length} workers`);
    }

    /**
     * Send a message to all workers (e.g. state sync)
     */
    public broadcast(message: any): void {
        for (const w of this.workers) {
            w.worker.postMessage(message);
        }
    }

    /**
     * Dispatch jobs from the job system to available workers
     */
    dispatch(jobSystem: JobSystem): void {
        // Find available workers
        const available = this.workers.filter(w => !w.busy);
        if (available.length === 0) return;

        // Get jobs to dispatch
        const maxJobs = Math.min(available.length, this.config.maxJobsPerFrame);
        const jobs = jobSystem.getJobsToDispatch(maxJobs);

        // Dispatch to workers
        for (let i = 0; i < jobs.length && i < available.length; i++) {
            const job = jobs[i];
            const entry = available[i];

            entry.busy = true;
            entry.currentJobId = job.id;

            // Register job for persistent callback
            this.jobCallbackMap.set(job.id, { entry, jobSystem });

            // Send job to worker
            entry.worker.postMessage(job);
        }
    }

    /**
     * Get count of available workers
     */
    get availableCount(): number {
        return this.workers.filter(w => !w.busy).length;
    }

    /**
     * Get count of busy workers
     */
    get busyCount(): number {
        return this.workers.filter(w => w.busy).length;
    }

    /**
     * Get total worker count
     */
    get totalCount(): number {
        return this.workers.length;
    }

    /**
     * Terminate all workers
     */
    dispose(): void {
        for (const entry of this.workers) {
            entry.worker.terminate();
        }
        this.workers = [];
        this.jobCallbackMap.clear();
        this.initialized = false;
    }
}


