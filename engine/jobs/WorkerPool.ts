/**
 * Engine Jobs - Worker Pool
 * Manages a pool of web workers for parallel processing
 * Note: Worker script itself is separate - this manages the pool
 */

import { Job, JobResult } from './jobs.types';
import { JobSystem } from './JobSystem';

/** Worker pool configuration */
export interface WorkerPoolConfig {
    /** Number of workers to spawn */
    workerCount: number;
    /** Path to worker script */
    workerScript: string;
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

    constructor(config: Partial<WorkerPoolConfig> = {}) {
        this.config = {
            workerCount: Math.max(1, (navigator.hardwareConcurrency || 4) - 1),
            workerScript: '/worker.js',
            maxJobsPerFrame: 8,
            ...config,
        };
    }

    /**
     * Initialize the worker pool
     */
    init(): void {
        if (this.initialized) return;

        for (let i = 0; i < this.config.workerCount; i++) {
            try {
                const worker = new Worker(this.config.workerScript, { type: 'module' });
                this.workers.push({
                    worker,
                    busy: false,
                    currentJobId: null,
                });
            } catch (e) {
                console.warn(`[WorkerPool] Failed to create worker ${i}:`, e);
            }
        }

        this.initialized = true;
        console.log(`[WorkerPool] Initialized with ${this.workers.length} workers`);
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

            // Set up one-time message handler for this job
            const handler = (e: MessageEvent) => {
                const result = e.data as JobResult;
                if (result.jobId === job.id) {
                    entry.worker.removeEventListener('message', handler);
                    entry.busy = false;
                    entry.currentJobId = null;
                    jobSystem.pushResult(result);
                }
            };

            entry.worker.addEventListener('message', handler);

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
        this.initialized = false;
    }
}

/**
 * Placeholder worker pool for when workers aren't available/needed
 * Processes jobs synchronously on main thread
 */
export class SyncJobProcessor {
    private handlers = new Map<string, (job: Job) => JobResult>();

    /**
     * Register a handler for a job type
     */
    registerHandler<T extends Job>(kind: T['kind'], handler: (job: T) => JobResult): void {
        this.handlers.set(kind, handler as (job: Job) => JobResult);
    }

    /**
     * Process jobs synchronously (fallback when workers unavailable)
     */
    process(jobSystem: JobSystem, maxJobs: number): void {
        const jobs = jobSystem.getJobsToDispatch(maxJobs);

        for (const job of jobs) {
            const handler = this.handlers.get(job.kind);
            if (handler) {
                try {
                    const result = handler(job);
                    jobSystem.pushResult(result);
                } catch (e) {
                    jobSystem.pushResult({
                        jobId: job.id,
                        kind: job.kind,
                        success: false,
                        error: String(e),
                        completedAt: Date.now(),
                    });
                }
            } else {
                console.warn(`[SyncJobProcessor] No handler for job kind: ${job.kind}`);
            }
        }
    }
}
