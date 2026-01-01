/**
 * Engine Space - Streaming Manager
 * Decides which chunks to load/unload based on camera position and policy
 */

import { ActiveSet } from './ActiveSet';
import { ChunkCoord, keyOf, chunkDistanceChebyshev } from './ChunkCoord';

/** Configuration for streaming behavior */
export interface StreamingPolicy {
    /** Horizontal view radius in chunks */
    viewRadiusH: number;

    /** Vertical view radius in chunks (often smaller than horizontal) */
    viewRadiusV: number;

    /** Maximum chunk loads per frame (throttle) */
    maxLoadsPerFrame: number;

    /** Maximum chunk unloads per frame (throttle) */
    maxUnloadsPerFrame: number;

    /** Priority sorting - closer chunks load first */
    priorityByDistance: boolean;
}

/** Default streaming policy */
export const DEFAULT_STREAMING_POLICY: StreamingPolicy = {
    viewRadiusH: 8,
    viewRadiusV: 4,
    maxLoadsPerFrame: 4,
    maxUnloadsPerFrame: 8,
    priorityByDistance: true,
};

export class StreamingManager {
    readonly activeSet = new ActiveSet();
    private policy: StreamingPolicy;
    private lastCameraChunk: ChunkCoord = { x: 0, y: 0, z: 0 };

    constructor(policy: Partial<StreamingPolicy> = {}) {
        this.policy = { ...DEFAULT_STREAMING_POLICY, ...policy };
    }

    /**
     * Update streaming based on camera chunk position
     * Call this once per frame in the streaming phase
     */
    update(cameraChunk: ChunkCoord): void {
        this.lastCameraChunk = cameraChunk;

        // Build the ideal active set
        const next = this.computeVisibleChunks(cameraChunk);

        // Compute deltas
        this.activeSet.computeNext(next);

        // Sort by priority if enabled
        if (this.policy.priorityByDistance) {
            // Loads: closer first
            this.sortByDistance(this.activeSet.toAdd, cameraChunk, false);
            // Unloads: farther first  
            this.sortByDistance(this.activeSet.toRemove, cameraChunk, true);
        }

        // Apply throttles
        if (this.activeSet.toAdd.length > this.policy.maxLoadsPerFrame) {
            this.activeSet.toAdd.length = this.policy.maxLoadsPerFrame;
        }
        if (this.activeSet.toRemove.length > this.policy.maxUnloadsPerFrame) {
            this.activeSet.toRemove.length = this.policy.maxUnloadsPerFrame;
        }
    }

    /**
     * Compute visible chunks based on camera and view radius
     */
    private computeVisibleChunks(camera: ChunkCoord): Set<string> {
        const visible = new Set<string>();
        const rH = this.policy.viewRadiusH;
        const rV = this.policy.viewRadiusV;

        for (let x = camera.x - rH; x <= camera.x + rH; x++) {
            for (let z = camera.z - rH; z <= camera.z + rH; z++) {
                for (let y = camera.y - rV; y <= camera.y + rV; y++) {
                    visible.add(keyOf({ x, y, z }));
                }
            }
        }

        return visible;
    }

    /**
     * Sort chunk keys by distance to camera
     */
    private sortByDistance(keys: string[], camera: ChunkCoord, farthestFirst: boolean): void {
        const parseCoord = (k: string): ChunkCoord => {
            const [x, y, z] = k.split(',').map(Number);
            return { x, y, z };
        };

        keys.sort((a, b) => {
            const da = chunkDistanceChebyshev(parseCoord(a), camera);
            const db = chunkDistanceChebyshev(parseCoord(b), camera);
            return farthestFirst ? db - da : da - db;
        });
    }

    /**
     * Get chunks to load this frame
     */
    getLoads(): readonly string[] {
        return this.activeSet.toAdd;
    }

    /**
     * Get chunks to unload this frame
     */
    getUnloads(): readonly string[] {
        return this.activeSet.toRemove;
    }

    /**
     * Check if a chunk is currently active
     */
    isActive(key: string): boolean {
        return this.activeSet.has(key);
    }

    /**
     * Get current active chunk count
     */
    get activeCount(): number {
        return this.activeSet.size;
    }

    /**
     * Update policy at runtime
     */
    setPolicy(policy: Partial<StreamingPolicy>): void {
        this.policy = { ...this.policy, ...policy };
    }

    /**
     * Get current policy
     */
    getPolicy(): StreamingPolicy {
        return { ...this.policy };
    }
}
