/**
 * Engine Space - Active Set Manager
 * Tracks which chunks are currently active and computes load/unload deltas
 */

export class ActiveSet {
    /** Currently active chunk keys */
    readonly active = new Set<string>();

    /** Chunks that need to be added (newly visible) */
    readonly toAdd: string[] = [];

    /** Chunks that need to be removed (no longer visible) */
    readonly toRemove: string[] = [];

    /**
     * Compute the delta between current active set and new desired set
     * After calling, toAdd/toRemove contain the changes needed
     */
    computeNext(next: Set<string>): void {
        this.toAdd.length = 0;
        this.toRemove.length = 0;

        // Find chunks to add (in next but not in active)
        for (const key of next) {
            if (!this.active.has(key)) {
                this.toAdd.push(key);
            }
        }

        // Find chunks to remove (in active but not in next)
        for (const key of this.active) {
            if (!next.has(key)) {
                this.toRemove.push(key);
            }
        }

        // Update active set to match next
        this.active.clear();
        for (const key of next) {
            this.active.add(key);
        }
    }

    /**
     * Check if a chunk key is currently active
     */
    has(key: string): boolean {
        return this.active.has(key);
    }

    /**
     * Get count of active chunks
     */
    get size(): number {
        return this.active.size;
    }

    /**
     * Clear all active chunks
     */
    clear(): void {
        this.active.clear();
        this.toAdd.length = 0;
        this.toRemove.length = 0;
    }
}
