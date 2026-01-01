/**
 * Engine Render - Mesh Pool
 * Efficient mesh reuse to avoid GPU memory churn
 */

import * as THREE from 'three';

interface PooledMesh {
    mesh: THREE.Mesh;
    inUse: boolean;
    lastUsedFrame: number;
}

/**
 * Mesh pool for efficient reuse of Three.js meshes
 * Prevents constant allocation/deallocation of GPU resources
 */
export class MeshPool {
    private pools = new Map<string, PooledMesh[]>();
    private currentFrame = 0;

    /**
     * Get or create a mesh of a specific type
     */
    acquire(
        poolKey: string,
        geometry: THREE.BufferGeometry,
        material: THREE.Material
    ): THREE.Mesh {
        let pool = this.pools.get(poolKey);

        if (!pool) {
            pool = [];
            this.pools.set(poolKey, pool);
        }

        // Find an unused mesh
        for (const entry of pool) {
            if (!entry.inUse) {
                entry.inUse = true;
                entry.lastUsedFrame = this.currentFrame;
                // Update geometry if needed
                entry.mesh.geometry = geometry;
                entry.mesh.material = material;
                entry.mesh.visible = true;
                return entry.mesh;
            }
        }

        // Create new mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        pool.push({
            mesh,
            inUse: true,
            lastUsedFrame: this.currentFrame,
        });

        return mesh;
    }

    /**
     * Return a mesh to the pool
     */
    release(mesh: THREE.Mesh): void {
        for (const pool of this.pools.values()) {
            const entry = pool.find(p => p.mesh === mesh);
            if (entry) {
                entry.inUse = false;
                entry.mesh.visible = false;
                return;
            }
        }
    }

    /**
     * Release all meshes in a pool
     */
    releasePool(poolKey: string): void {
        const pool = this.pools.get(poolKey);
        if (!pool) return;

        for (const entry of pool) {
            entry.inUse = false;
            entry.mesh.visible = false;
        }
    }

    /**
     * Mark a new frame (for cleanup tracking)
     */
    tick(): void {
        this.currentFrame++;
    }

    /**
     * Cleanup unused meshes that haven't been used for N frames
     */
    cleanup(scene: THREE.Scene, maxUnusedFrames = 300): number {
        let disposed = 0;

        for (const [key, pool] of this.pools.entries()) {
            for (let i = pool.length - 1; i >= 0; i--) {
                const entry = pool[i];
                if (!entry.inUse && this.currentFrame - entry.lastUsedFrame > maxUnusedFrames) {
                    // Remove from scene
                    scene.remove(entry.mesh);

                    // Dispose resources
                    entry.mesh.geometry?.dispose();

                    // Remove from pool
                    pool.splice(i, 1);
                    disposed++;
                }
            }

            // Remove empty pools
            if (pool.length === 0) {
                this.pools.delete(key);
            }
        }

        return disposed;
    }

    /**
     * Get pool statistics
     */
    getStats(): { totalMeshes: number; inUse: number; pools: number } {
        let total = 0;
        let inUse = 0;

        for (const pool of this.pools.values()) {
            total += pool.length;
            inUse += pool.filter(p => p.inUse).length;
        }

        return {
            totalMeshes: total,
            inUse,
            pools: this.pools.size,
        };
    }

    /**
     * Dispose all pools
     */
    dispose(scene: THREE.Scene): void {
        for (const pool of this.pools.values()) {
            for (const entry of pool) {
                scene.remove(entry.mesh);
                entry.mesh.geometry?.dispose();
            }
        }
        this.pools.clear();
    }
}
