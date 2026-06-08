/**
 * Foliage Render System
 * Renders trees, rocks, and resources using InstancedMesh.
 * Receives data from TerrainRenderSystem.
 * (|/) Klaasvaakie
 */

import * as THREE from 'three';
import { BuildingFactory } from '../../../engine/render/utils/VoxelGenerators';
import { foliageInstancedMaterial } from '../../../engine/render/materials/VoxelMaterials';
import { mergeGroupGeometry } from '../../../engine/render/utils/VoxelUtils';

export interface FoliageItem {
    x: number;
    y: number;
    z: number;
    type: string;
    marked?: boolean;
}

type GrassMesh = THREE.InstancedMesh;

export class FoliageRenderSystem {
    private scene: THREE.Scene;
    private chunkMeshes: Map<string, Map<string, THREE.InstancedMesh>> = new Map();
    private groundDetailMeshes: Map<string, GrassMesh> = new Map();
    private geometryCache: Map<string, THREE.BufferGeometry> = new Map();
    private meshPools: Map<string, THREE.InstancedMesh[]> = new Map();
    private grassMeshPool: GrassMesh[] = [];
    private readonly maxPoolSizePerType = 6;
    private readonly maxGrassPoolSize = 16;
    private readonly dummy = new THREE.Object3D();
    private readonly markedColor = new THREE.Color(1, 0.3, 0.3);
    private readonly defaultColor = new THREE.Color(1, 1, 1);

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    /**
     * Update foliage for a specific chunk
     */
    public updateChunk(key: string, items: FoliageItem[]) {
        const existingMeshes = this.chunkMeshes.get(key) || new Map();
        if (items.length === 0) {
            this.releaseChunkMeshes(key, existingMeshes);
            this.chunkMeshes.delete(key);
            return;
        }

        const buckets = new Map<string, FoliageItem[]>();
        for (const item of items) {
            const bucket = buckets.get(item.type);
            if (bucket) {
                bucket.push(item);
            } else {
                buckets.set(item.type, [item]);
            }
        }

        const nextMeshes = new Map<string, THREE.InstancedMesh>();

        for (const [type, bucket] of buckets) {
            const geometry = this.getGeometry(type);
            if (!geometry) {
                continue;
            }

            const existing = existingMeshes.get(type);
            const mesh = this.prepareChunkMesh(key, type, geometry, bucket.length, existing);
            this.populateMesh(mesh, bucket);
            nextMeshes.set(type, mesh);
            existingMeshes.delete(type);
        }

        for (const mesh of existingMeshes.values()) {
            this.releaseMesh(mesh);
        }

        if (nextMeshes.size > 0) {
            this.chunkMeshes.set(key, nextMeshes);
        } else {
            this.chunkMeshes.delete(key);
        }
    }

    public updateGroundDetailChunk(key: string, _tiles?: unknown[]): void {
        this.removeGroundDetailChunk(key);
    }

    public setGroundDetailVisible(_visible: boolean): void {
        for (const mesh of this.groundDetailMeshes.values()) {
            mesh.visible = false;
        }
    }

    public updateGroundDetailTime(_time?: number, _timeOfDay?: number): void {
        // Ground grass has been disabled; keep this hook so render-frame calls stay harmless.
    }

    /**
     * Remove foliage for a chunk (unloaded)
     */
    public removeChunk(key: string) {
        const existingMeshes = this.chunkMeshes.get(key);
        if (existingMeshes) {
            this.releaseChunkMeshes(key, existingMeshes);
            this.chunkMeshes.delete(key);
        }
        this.removeGroundDetailChunk(key);
    }

    public dispose() {
        for (const [key, meshes] of this.chunkMeshes) {
            this.releaseChunkMeshes(key, meshes);
        }
        this.chunkMeshes.clear();

        for (const key of Array.from(this.groundDetailMeshes.keys())) {
            this.removeGroundDetailChunk(key);
        }
        while (this.grassMeshPool.length > 0) {
            const mesh = this.grassMeshPool.pop();
            if (!mesh) continue;
            this.scene.remove(mesh);
            mesh.dispose();
        }

        for (const pool of this.meshPools.values()) {
            for (const mesh of pool) {
                this.scene.remove(mesh);
                mesh.dispose();
            }
        }
        this.meshPools.clear();

        for (const geometry of this.geometryCache.values()) {
            geometry.dispose();
        }
        this.geometryCache.clear();
    }

    private getGeometry(type: string): THREE.BufferGeometry | null {
        const cached = this.geometryCache.get(type);
        if (cached) {
            return cached;
        }

        if (!BuildingFactory[type]) {
            console.warn(`[FoliageSystem] Unknown foliage type: ${type}`);
            return null;
        }

        const group = BuildingFactory[type]({ seed: 42 });
        const geometry = mergeGroupGeometry(group);
        this.geometryCache.set(type, geometry);
        return geometry;
    }

    private prepareChunkMesh(
        key: string,
        type: string,
        geometry: THREE.BufferGeometry,
        count: number,
        existing?: THREE.InstancedMesh
    ): THREE.InstancedMesh {
        const existingCapacity = this.getMeshCapacity(existing);
        let mesh = existing;

        if (!mesh || existingCapacity < count) {
            if (mesh) {
                this.releaseMesh(mesh);
            }
            mesh = this.acquireMesh(type, geometry, count);
        }

        mesh.geometry = geometry;
        mesh.count = count;
        mesh.visible = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.userData.chunkKey = key;
        mesh.userData.foliageType = type;
        mesh.userData.capacity = this.getMeshCapacity(mesh);
        return mesh;
    }

    private acquireMesh(type: string, geometry: THREE.BufferGeometry, count: number): THREE.InstancedMesh {
        const pool = this.meshPools.get(type) || [];
        this.meshPools.set(type, pool);

        const pooledIndex = pool.findIndex((mesh) => this.getMeshCapacity(mesh) >= count);
        const mesh = pooledIndex >= 0
            ? pool.splice(pooledIndex, 1)[0]
            : new THREE.InstancedMesh(geometry, foliageInstancedMaterial, this.getCapacity(count));

        mesh.geometry = geometry;
        mesh.visible = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.userData.capacity = this.getMeshCapacity(mesh);
        mesh.userData.instanceLibrary = 'three-instanced-mesh';
        this.scene.add(mesh);
        return mesh;
    }

    private releaseMesh(mesh: THREE.InstancedMesh) {
        this.scene.remove(mesh);
        mesh.visible = false;
        mesh.count = 0;

        const type = mesh.userData.foliageType;
        if (!type) {
            mesh.dispose();
            return;
        }

        const pool = this.meshPools.get(type) || [];
        this.meshPools.set(type, pool);
        if (pool.length < this.maxPoolSizePerType) {
            pool.push(mesh);
            return;
        }

        mesh.dispose();
    }

    private releaseGrassMesh(mesh: GrassMesh) {
        this.scene.remove(mesh);
        mesh.visible = false;
        mesh.count = 0;
        if (this.grassMeshPool.length < this.maxGrassPoolSize) {
            this.grassMeshPool.push(mesh);
            return;
        }
        mesh.dispose();
    }

    private releaseChunkMeshes(key: string, meshes: Map<string, THREE.InstancedMesh>) {
        for (const mesh of meshes.values()) {
            this.releaseMesh(mesh);
        }
        this.chunkMeshes.delete(key);
    }

    private removeGroundDetailChunk(key: string): void {
        const mesh = this.groundDetailMeshes.get(key);
        if (!mesh) return;
        this.releaseGrassMesh(mesh);
        this.groundDetailMeshes.delete(key);
    }

    private populateMesh(mesh: THREE.InstancedMesh, items: FoliageItem[]) {
        for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];

            // Deterministic rotation and scale based on position.
            const rotSeed = Math.abs(item.x * 31 + item.z * 17);
            const rotY = (rotSeed % 4) * (Math.PI / 2);

            const scaleSeed = Math.abs(item.x * 7.11 + item.z * 3.45);
            const scale = 0.85 + (scaleSeed % 10) * 0.03;

            this.dummy.position.set(item.x, item.y, item.z);
            this.dummy.rotation.set(0, rotY, 0);
            this.dummy.scale.setScalar(scale);
            this.dummy.updateMatrix();

            mesh.setMatrixAt(idx, this.dummy.matrix);
            mesh.setColorAt(idx, item.marked ? this.markedColor : this.defaultColor);
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true;
        }
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
    }

    private getCapacity(count: number): number {
        let capacity = 1;
        while (capacity < count) {
            capacity *= 2;
        }
        return capacity;
    }

    private getMeshCapacity(mesh?: THREE.InstancedMesh): number {
        return mesh ? (mesh.userData.capacity || mesh.instanceMatrix.count || mesh.count || 0) : 0;
    }

    /**
     * Get meshes for raycasting/interaction
     */
    public getInteractables(): THREE.Object3D[] {
        const meshes: THREE.Object3D[] = [];
        for (const chunkMeshes of this.chunkMeshes.values()) {
            meshes.push(...chunkMeshes.values());
        }
        return meshes;
    }
}
