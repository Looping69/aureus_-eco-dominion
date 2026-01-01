/**
 * Engine Jobs - Job System
 * Central job queue with priority handling and result management
 * Note: Actual worker dispatch will be added in WorkerPool
 */

import { Job, JobResult, JobKind } from './jobs.types';

/** Job system statistics */
export interface JobStats {
    queued: number;
    pending: number;
    completed: number;
    failed: number;
}

export class JobSystem {
    /** Jobs waiting to be dispatched */
    private queue: Job[] = [];

    /** Jobs currently being processed by workers */
    private pending = new Map<string, Job>();

    /** Results ready to be consumed */
    private results: JobResult[] = [];

    /** Statistics */
    private stats: JobStats = {
        queued: 0,
        pending: 0,
        completed: 0,
        failed: 0,
    };

    /**
     * Add a job to the queue
     */
    enqueue(job: Job): void {
        this.queue.push(job);
        this.stats.queued++;

        // Maintain priority order (higher priority = front)
        this.queue.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Add multiple jobs to the queue
     */
    enqueueBatch(jobs: Job[]): void {
        for (const job of jobs) {
            this.enqueue(job);
        }
    }

    /**
     * Get jobs to dispatch this frame (respects budget)
     * Moves jobs from queue to pending
     */
    getJobsToDispatch(maxJobs: number): Job[] {
        const toDispatch = this.queue.splice(0, maxJobs);

        for (const job of toDispatch) {
            this.pending.set(job.id, job);
            this.stats.pending++;
        }

        return toDispatch;
    }

    /**
     * Called by worker pool when a job completes
     */
    pushResult(result: JobResult): void {
        this.results.push(result);

        // Remove from pending
        if (this.pending.has(result.jobId)) {
            this.pending.delete(result.jobId);
            this.stats.pending--;
        }

        if (result.success) {
            this.stats.completed++;
        } else {
            this.stats.failed++;
        }
    }

    /**
     * Drain all available results
     * Call this in jobsFlush phase
     */
    drainResults(): JobResult[] {
        const drained = this.results;
        this.results = [];
        return drained;
    }

    /**
     * Drain results of a specific type
     */
    drainResultsOfKind<T extends JobResult>(kind: JobKind): T[] {
        const matching: T[] = [];
        const remaining: JobResult[] = [];

        for (const result of this.results) {
            if (result.kind === kind) {
                matching.push(result as T);
            } else {
                remaining.push(result);
            }
        }

        this.results = remaining;
        return matching;
    }

    /**
     * Check if there are jobs of a specific type in queue
     */
    hasJobsOfKind(kind: JobKind): boolean {
        return this.queue.some(j => j.kind === kind);
    }

    /**
     * Cancel all jobs of a specific type
     */
    cancelJobsOfKind(kind: JobKind): number {
        const before = this.queue.length;
        this.queue = this.queue.filter(j => j.kind !== kind);
        return before - this.queue.length;
    }

    /**
     * Cancel a specific job by ID
     */
    cancelJob(jobId: string): boolean {
        const idx = this.queue.findIndex(j => j.id === jobId);
        if (idx !== -1) {
            this.queue.splice(idx, 1);
            return true;
        }
        return false;
    }

    /**
     * Get current queue length
     */
    get queueLength(): number {
        return this.queue.length;
    }

    /**
     * Get pending job count
     */
    get pendingCount(): number {
        return this.pending.size;
    }

    /**
     * Get results count
     */
    get resultsCount(): number {
        return this.results.length;
    }

    /**
     * Get statistics
     */
    getStats(): JobStats {
        return { ...this.stats };
    }

    /**
     * Clear all queues (on world unload)
     */
    clear(): void {
        this.queue.length = 0;
        this.pending.clear();
        this.results.length = 0;
    }
}
