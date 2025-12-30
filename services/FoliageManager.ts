
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { GridTile, FoliageType } from '../types';
import { BuildingFactory } from '../utils/voxelGenerators';
import { matMaster } from '../utils/voxelMaterials';
import { mergeGroupGeometry } from '../utils/voxelUtils';

export interface FoliageItem {
    x: number;
    y: number;
    z: number;
    type: string;
}

export class FoliageManager {
    private scene: THREE.Scene;
    private instancedMeshes: Map<string, THREE.InstancedMesh> = new Map();
    private gridSize: number;

    // Separate sources for foliage
    private gridFoliage: Map<number, FoliageItem> = new Map(); // Key: Tile ID
    private chunkFoliage: Map<string, FoliageItem[]> = new Map(); // Key: Chunk ID

    // Debounce updates
    private isDirty = false;
    private rafId = 0;

    constructor(scene: THREE.Scene, gridSize: number) {
        this.scene = scene;
        this.gridSize = gridSize;
    }

    public updateGrid(grid: GridTile[]) {
        this.gridFoliage.clear();
        grid.forEach(tile => {
            // Only render GOLD_VEIN from grid data - trees/flowers are now procedural
            if (tile.foliage === 'GOLD_VEIN') {
                const item: FoliageItem = {
                    x: tile.x,
                    y: tile.terrainHeight * 0.5,
                    z: tile.y,
                    type: tile.foliage
                };
                this.gridFoliage.set(tile.id, item);
            }
        });
        this.requestRebuild();
    }

    public updateChunk(key: string, items: FoliageItem[]) {
        this.chunkFoliage.set(key, items);
        this.requestRebuild();
    }

    public removeChunk(key: string) {
        if (this.chunkFoliage.delete(key)) {
            this.requestRebuild();
        }
    }

    private requestRebuild() {
        if (!this.isDirty) {
            this.isDirty = true;
            // Throttle rebuilds to max once per 100ms for performance
            setTimeout(() => {
                this.rafId = requestAnimationFrame(this.rebuild.bind(this));
            }, 100);
        }
    }

    private rebuild() {
        this.isDirty = false;

        // 1. Aggregate all instances by type
        const buckets: Record<string, FoliageItem[]> = {};
        const push = (item: FoliageItem) => {
            if (!buckets[item.type]) buckets[item.type] = [];
            buckets[item.type].push(item);
        };

        // Add Grid Foliage (Center)
        this.gridFoliage.forEach(item => push(item));

        // Add Chunk Foliage (Background)
        this.chunkFoliage.forEach(items => items.forEach(item => push(item)));

        // 2. Sync Meshes
        const activeKeys = new Set<string>();
        const offset = (this.gridSize - 1) / 2;
        const dummy = new THREE.Object3D();

        Object.entries(buckets).forEach(([type, items]) => {
            activeKeys.add(type);

            let mesh = this.instancedMeshes.get(type);
            const count = items.length;

            // Reallocate if needed
            if (!mesh || mesh.count < count) {
                if (mesh) {
                    this.scene.remove(mesh);
                    mesh.dispose();
                }

                if (!BuildingFactory[type]) return;
                const group = BuildingFactory[type]();
                const geometry = mergeGroupGeometry(group);

                // Buffer size with padding
                const capacity = Math.max(100, Math.ceil(count * 1.5));
                mesh = new THREE.InstancedMesh(geometry, matMaster, capacity);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

                this.scene.add(mesh);
                this.instancedMeshes.set(type, mesh);
            }

            // Update Transforms
            let idx = 0;
            items.forEach((item) => {
                // Seed for rotation consistency
                const seed = Math.abs(item.x * 31 + item.z * 17);
                const rotY = (seed % 4) * (Math.PI / 2);

                dummy.position.set(item.x - offset, item.y, item.z - offset);
                dummy.rotation.set(0, rotY, 0);
                dummy.scale.setScalar(1.0);
                dummy.updateMatrix();
                mesh!.setMatrixAt(idx, dummy.matrix);
                idx++;
            });

            mesh.count = count;
            mesh.instanceMatrix.needsUpdate = true;
        });

        // 3. Cleanup Unused
        this.instancedMeshes.forEach((mesh, type) => {
            if (!activeKeys.has(type)) {
                this.scene.remove(mesh);
                mesh.dispose();
                this.instancedMeshes.delete(type);
            }
        });
    }

    public getInteractables(): THREE.Object3D[] {
        return Array.from(this.instancedMeshes.values());
    }
}
