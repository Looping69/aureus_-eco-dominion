/**
 * Engine Worker
 * Handles heavy computations in a background thread:
 * - Pathfinding
 * - Physics (future)
 * - PCG (future)
 */

import { Job, PathfindJob, PathfindResult } from './jobs.types';
import { findPath, GRID_SIZE } from '../sim/algorithms/Pathfinding';
import { GridTile } from '../../types';

// State cache (workers might need a copy of the grid)
// For now, we will assume the grid is passed in the job OR we need a way to sync it.
// Passing the *entire* grid (64x64xObjects) every pathfinding job is expensive (structured clone).
// Better approach: Sync grid updates to worker. 
// For MVP: Pass only necessary data or accept the overhead for 4096 tiles (it's not THAT big, ~1MB maybe).
// Actually, 4096 tiles * object size. JSON stringify/parse might be slow.
// SharedArrayBuffer is best but requires headers.

// For this implementation, we'll try passing the grid in the job for simplicity, 
// BUT AureusWorld.ts passes `state.grid` to findPath locally.
// Accessing `state` in the worker is impossible.
// We must either:
// 1. Send the grid with every job (Simplest, bandwidth heavy)
// 2. Cache the grid in the worker and send "GridUpdates" (Better)

let localGrid: GridTile[] = [];

self.onmessage = (e: MessageEvent) => {
    const msg = e.data;

    if (msg.type === 'SYNC_GRID') {
        localGrid = msg.payload;
        console.log('[Worker] Received SYNC_GRID, grid size:', localGrid?.length);
        return;
    }

    // Check if it's a job
    const job = msg as Job;
    if (!job.id || !job.kind) return;

    try {
        let result: any = null;

        if (job.kind === 'PATHFIND') {
            result = processPathfind(job as PathfindJob);
        }

        if (result) {
            self.postMessage(result);
        }
    } catch (err) {
        self.postMessage({
            jobId: job.id,
            kind: job.kind,
            success: false,
            error: String(err),
            completedAt: Date.now()
        });
    }
};

function processPathfind(job: PathfindJob): PathfindResult {
    // We need the grid!
    if (!localGrid || localGrid.length === 0) {
        console.log('[Worker] Pathfind failed - no grid data!');
        throw new Error("Worker has no grid data");
    }

    const startIdx = job.startZ * GRID_SIZE + job.startX;
    const endIdx = job.endZ * GRID_SIZE + job.endX;

    // Run A*
    const path = findPath(startIdx, endIdx, localGrid);

    if (!path) {
        console.log(`[Worker] Pathfind failed: ${startIdx} -> ${endIdx}, grid has ${localGrid.length} tiles`);
    }

    return {
        jobId: job.id,
        kind: 'PATHFIND',
        success: !!path,
        completedAt: Date.now(),
        agentId: job.agentId,
        path: path
    };
}
