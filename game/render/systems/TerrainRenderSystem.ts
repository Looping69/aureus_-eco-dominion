/**
 * Terrain Render System
 * Manages terrain chunk lifecycle, meshing, and rendering.
 * Uses a simple 2D chunk grid matching the game's heightmap-based terrain.
 * (|/) Klaasvaakie
 */

import * as THREE from 'three';
import { JobSystem, MeshChunkResult, MeshChunkJob, ENGINE_SCHEMA_VERSION, createJob } from '../../../engine/jobs';
import { GridTile } from '../../../types';
import { terrainSurfaceMaterial, mats } from '../../../engine/render/materials/VoxelMaterials';
import { getTerrainChunkLod } from '../../../engine/render/utils/TerrainLod';
import { CHUNK_SIZE, worldToChunk, worldToLocal, toChunkKey } from '../../../engine/utils/coords';
import {
    buildTerrainBoundsTree,
    disposeTerrainBoundsTree,
    installTerrainBvhRaycast,
    pickClosestTerrainHit,
    TerrainPickHandler,
} from './TerrainPickAccelerator';

interface ChunkRenderData {
    mesh: THREE.Mesh | null;
    waterMesh: THREE.Mesh | null;
    ghostMesh: THREE.Mesh | null;
    dirty: boolean;
    loading: boolean;
    revision: number;
    loadingRevision: number;
}

export class TerrainRenderSystem {
    private scene: THREE.Scene;
    private jobSystem: JobSystem;

    private chunks: Map<string, ChunkRenderData & { lod: number }> = new Map();
    private tileCache: Map<string, GridTile[]> = new Map();
    private viewMode: 'SURFACE' | 'FIRST_PERSON' = 'SURFACE';
    private terrainMeshPool: THREE.Mesh[] = [];
    private waterMeshPool: THREE.Mesh[] = [];
    private ghostMeshPool: THREE.Mesh[] = [];
    private readonly maxPoolSizePerType = 12;
    private readonly terrainPickHandler: TerrainPickHandler = (raycaster) => this.intersectTerrain(raycaster);

    // Voxel terrain emits more faces than the smoothed shell, so keep the active
    // chunk ring tighter while LOD preserves the blocky silhouette in the distance.
    private viewRadius = ('ontouchstart' in window) ? 3 : 5;

    // Track last camera chunk to avoid redundant updates
    private lastCameraCx = -999;
    private lastCameraCz = -999;
    private lastFrustumCheck = 0;

    // Callbacks for foliage system
    public onFoliageUpdate?: (key: string, items: any[]) => void;
    public onChunkDispose?: (key: string) => void;

    constructor(scene: THREE.Scene, jobSystem: JobSystem) {
        this.scene = scene;
        this.jobSystem = jobSystem;
        installTerrainBvhRaycast();
        this.scene.userData.intersectTerrain = this.terrainPickHandler;
    }

    public setViewMode(mode: 'SURFACE' | 'FIRST_PERSON'): void {
        if (this.viewMode === mode) return;
        this.viewMode = mode;
        // Invalidate all chunks to force rebuild with new view mode
        for (const [key, chunk] of this.chunks) {
            this.markChunkDirty(key, chunk);
        }
    }

    /**
     * Forces a complete reload of all chunks
     */
    public forceReload(): void {
        this.dispose();
        this.lastCameraCx = -999;
        this.lastCameraCz = -999;
    }

    /**
     * Called every visual frame with the camera focus position (world coords)
     */
    update(cameraFocus: THREE.Vector3, camera?: THREE.Camera): void {
        // Convert world position to grid position, then to chunk coordinates
        // World (0,0) = center of grid. Grid tile (64,64) for 128x128.
        const cameraCx = Math.floor(cameraFocus.x / CHUNK_SIZE);
        const cameraCz = Math.floor(cameraFocus.z / CHUNK_SIZE);

        const now = Date.now();
        const hasDirtyVisibleChunks = (() => {
            for (const chunk of this.chunks.values()) {
                if (chunk.dirty || chunk.loading) return true;
            }
            return false;
        })();
        // Only recalculate if camera moved or periodically (every 200ms) for frustum updates
        if (cameraCx === this.lastCameraCx && cameraCz === this.lastCameraCz && (now - this.lastFrustumCheck < 200)) {
            if (!hasDirtyVisibleChunks) return;
        }

        this.lastCameraCx = cameraCx;
        this.lastCameraCz = cameraCz;
        this.lastFrustumCheck = now;

        // Calculate which chunks should be visible (infinite world - no bounds limit)
        const visibleChunks = new Set<string>();

        // Setup Frustum
        const frustum = new THREE.Frustum();
        if (camera) {
            const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            frustum.setFromProjectionMatrix(matrix);
        }

        // Reuse box for checks
        const box = new THREE.Box3();

        for (let dx = -this.viewRadius; dx <= this.viewRadius; dx++) {
            for (let dz = -this.viewRadius; dz <= this.viewRadius; dz++) {
                const cx = cameraCx + dx;
                const cz = cameraCz + dz;

                // Frustum Check
                if (camera) {
                    const xPos = cx * CHUNK_SIZE;
                    const zPos = cz * CHUNK_SIZE;
                    const margin = 16; // Add one chunk of margin to prevent foliage clipping at edges

                    // Define chunk bounds with margin for overlapping foliage
                    box.min.set(xPos - margin, -20, zPos - margin);
                    box.max.set(xPos + CHUNK_SIZE + margin, 100, zPos + CHUNK_SIZE + margin);

                    if (!frustum.intersectsBox(box)) {
                        continue; // Skip off-screen chunks
                    }
                }

                const key = toChunkKey(cx, cz);
                visibleChunks.add(key);

                const dist = Math.max(Math.abs(dx), Math.abs(dz));
                const lod = getTerrainChunkLod(dist, this.viewRadius);

                // Load chunk if not already present
                if (!this.chunks.has(key)) {
                    this.chunks.set(key, {
                        mesh: null,
                        waterMesh: null,
                        ghostMesh: null,
                        dirty: true,
                        loading: false,
                        lod,
                        revision: 0,
                        loadingRevision: -1,
                    });
                }

                const chunk = this.chunks.get(key)!;
                if (chunk.lod !== lod) {
                    chunk.lod = lod;
                    this.markChunkDirty(key, chunk);
                }

                // Only rebuild if dirty AND not already loading
                if (chunk.dirty && !chunk.loading) {
                    this.requestChunkBuild(cx, cz, lod);
                }
            }
        }

        // Unload chunks that are no longer visible
        for (const [key, chunk] of this.chunks) {
            if (!visibleChunks.has(key)) {
                this.disposeChunk(key, chunk);
                this.chunks.delete(key);
            }
        }
    }

    /**
     * Process completed mesh jobs from worker
     */
    public processResults(results: MeshChunkResult[]): void {
        for (const res of results) {
            if (res.success) {
                this.applyChunkUpdate(res);
            } else {
                console.error(`[TerrainRenderSystem] Chunk build failed for ${res.chunkId}:`, res.error);
                const chunk = this.chunks.get(res.chunkId);
                if (chunk) {
                    chunk.loading = false;
                    chunk.dirty = true;
                }
            }
        }
    }

    /**
     * Sync grid state from game state (now accepts all tiles or chunks)
     */
    public syncGrid(tiles: GridTile[]): void {
        this.tileCache.clear();
        const affected = new Set<string>();

        for (const tile of tiles) {
            const { cx, cz } = worldToChunk(tile.x, tile.z, CHUNK_SIZE);
            const key = toChunkKey(cx, cz);

            if (!this.tileCache.has(key)) {
                this.tileCache.set(key, []);
            }
            this.tileCache.get(key)!.push(tile);
            affected.add(key);
        }

        // Mark affected chunks dirty
        for (const key of affected) {
            this.markChunkDirty(key);
        }

        this.lastCameraCx = -999;
        this.lastCameraCz = -999;
    }

    /**
     * Handle partial tile updates
     */
    public updateTiles(updates: GridTile[]): Set<string> {
        const affected = new Set<string>();

        for (const tile of updates) {
            const { cx, cz } = worldToChunk(tile.x, tile.z, CHUNK_SIZE);
            const key = toChunkKey(cx, cz);

            let chunkTiles = this.tileCache.get(key);
            if (!chunkTiles) {
                chunkTiles = [];
                this.tileCache.set(key, chunkTiles);
            }

            const existingIdx = chunkTiles.findIndex(t => t.id === tile.id);
            if (existingIdx !== -1) {
                chunkTiles[existingIdx] = tile;
            } else {
                chunkTiles.push(tile);
            }

            this.collectAffectedChunkKeys(affected, tile.x, tile.z);
        }

        // Mark affected chunks as dirty
        for (const key of affected) {
            this.markChunkDirty(key);
        }

        return affected;
    }

    /**
     * Implements targeted chunk update from Effect
     */
    public updateChunk(cx: number, cz: number, updates: GridTile[]): Set<string> {
        const key = toChunkKey(cx, cz);
        this.tileCache.set(key, updates);

        const affected = this.getAffectedChunkKeys(cx, cz, updates);
        for (const affectedKey of affected) {
            this.markChunkDirty(affectedKey);
        }
        return affected;
    }

    public getAffectedChunkKeys(cx: number, cz: number, updates: GridTile[]): Set<string> {
        const affected = new Set<string>([toChunkKey(cx, cz)]);
        for (const tile of updates) {
            this.collectAffectedChunkKeys(affected, tile.x, tile.z);
        }
        return affected;
    }

    private collectAffectedChunkKeys(affected: Set<string>, x: number, z: number): void {
        const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
        const { lx, lz } = worldToLocal(x, z, CHUNK_SIZE);
        affected.add(toChunkKey(cx, cz));

        if (lx === 0) affected.add(toChunkKey(cx - 1, cz));
        if (lx === CHUNK_SIZE - 1) affected.add(toChunkKey(cx + 1, cz));
        if (lz === 0) affected.add(toChunkKey(cx, cz - 1));
        if (lz === CHUNK_SIZE - 1) affected.add(toChunkKey(cx, cz + 1));
    }

    private markChunkDirty(key: string, chunk = this.chunks.get(key)): void {
        if (!chunk) {
            return;
        }
        chunk.dirty = true;
        chunk.revision += 1;
    }

    private requestChunkBuild(cx: number, cz: number, lod: number = 1): void {
        const key = toChunkKey(cx, cz);
        const tiles = this.tileCache.get(key) || [];
        const chunk = this.chunks.get(key);
        if (!chunk) {
            return;
        }

        const job = createJob<MeshChunkJob>('MESH_CHUNK', {
            priority: 10,
            payload: {
                chunkId: key,
                cx,
                cz,
                tiles,
                viewMode: 'SURFACE',
                lod,
            }
        });

        this.jobSystem.enqueue(job);
        chunk.loading = true;
        chunk.dirty = false;
        chunk.loadingRevision = chunk.revision;
    }

    private applyChunkUpdate(res: MeshChunkResult): void {
        const chunk = this.chunks.get(res.chunkId);
        if (!chunk) return; // Chunk was unloaded while building

        chunk.loading = false;
        if (chunk.loadingRevision !== chunk.revision) {
            chunk.dirty = true;
            return;
        }
        if (chunk.lod !== (res.lod ?? 1)) {
            chunk.dirty = true;
            return;
        }

        // Calculate world position for chunk
        const xPos = res.cx * CHUNK_SIZE;
        const zPos = res.cz * CHUNK_SIZE;

        // Terrain should receive shadows from buildings/foliage, but not cast its own
        // broad self-shadow bands back onto itself.
        chunk.mesh = this.upsertChunkMesh(chunk.mesh, res.solid, terrainSurfaceMaterial, false, xPos, zPos, this.terrainMeshPool, true);
        if (chunk.mesh) {
            chunk.mesh.receiveShadow = true;
        } else {
            console.warn(`[TerrainRenderSystem] Mesh IS NULL for ${res.chunkId}`);
        }

        chunk.waterMesh = this.upsertChunkMesh(chunk.waterMesh, res.water, mats.waterSurface, false, xPos, zPos, this.waterMeshPool);
        if (chunk.waterMesh) {
            chunk.waterMesh.receiveShadow = false;
        }

        chunk.ghostMesh = this.upsertChunkMesh(chunk.ghostMesh, res.ghost, mats.ghost, false, xPos, zPos, this.ghostMeshPool);
        if (chunk.ghostMesh) {
            chunk.ghostMesh.receiveShadow = false;
        }

        // Foliage callback
        if (this.onFoliageUpdate && res.foliage) {
            this.onFoliageUpdate(res.chunkId, res.foliage);
        }
    }

    public intersectTerrain(raycaster: THREE.Raycaster): THREE.Intersection | null {
        return pickClosestTerrainHit(raycaster, this.getActiveTerrainMeshes());
    }

    private *getActiveTerrainMeshes(): Iterable<THREE.Mesh> {
        for (const chunk of this.chunks.values()) {
            if (chunk.mesh?.visible) {
                yield chunk.mesh;
            }
        }
    }

    private upsertChunkMesh(
        existing: THREE.Mesh | null,
        data: any,
        material: THREE.Material,
        castShadow: boolean,
        xPos: number,
        zPos: number,
        pool: THREE.Mesh[],
        buildBoundsTree: boolean = false
    ): THREE.Mesh | null {
        if (!data || !data.p || data.p.length === 0) {
            if (existing) {
                this.releaseChunkMesh(existing, pool);
            }
            return null;
        }

        const mesh = existing || this.acquirePooledMesh(material, castShadow, pool);
        this.applyMeshGeometry(mesh, data, buildBoundsTree);
        mesh.position.set(xPos, 0, zPos);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
        mesh.visible = true;
        return mesh;
    }

    private acquirePooledMesh(material: THREE.Material, castShadow: boolean, pool: THREE.Mesh[]): THREE.Mesh {
        const mesh = pool.pop() || new THREE.Mesh(new THREE.BufferGeometry(), material);
        if (!this.scene.children.includes(mesh)) {
            this.scene.add(mesh);
        }
        mesh.material = material;
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
        mesh.visible = true;
        return mesh;
    }

    private releaseChunkMesh(mesh: THREE.Mesh, pool: THREE.Mesh[]): void {
        this.scene.remove(mesh);
        if (mesh.geometry) {
            disposeTerrainBoundsTree(mesh.geometry);
            mesh.geometry.dispose();
            mesh.geometry = new THREE.BufferGeometry();
        }
        mesh.visible = false;
        if (pool.length < this.maxPoolSizePerType) {
            pool.push(mesh);
        }
    }

    private applyMeshGeometry(mesh: THREE.Mesh, data: any, buildBoundsTree: boolean = false): void {
        if (mesh.geometry) {
            disposeTerrainBoundsTree(mesh.geometry);
            mesh.geometry.dispose();
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(data.p, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(data.n, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(data.c, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(data.u, 2));
        geo.computeBoundingSphere();
        geo.computeBoundingBox();
        if (buildBoundsTree) {
            buildTerrainBoundsTree(geo);
            mesh.userData.isBvhTerrainPickTarget = true;
        } else {
            delete mesh.userData.isBvhTerrainPickTarget;
        }
        mesh.geometry = geo;
    }

    private disposeChunk(key: string, chunk: ChunkRenderData): void {
        if (chunk.mesh) {
            this.releaseChunkMesh(chunk.mesh, this.terrainMeshPool);
        }
        if (chunk.waterMesh) {
            this.releaseChunkMesh(chunk.waterMesh, this.waterMeshPool);
        }
        if (chunk.ghostMesh) {
            this.releaseChunkMesh(chunk.ghostMesh, this.ghostMeshPool);
        }
        if (this.onChunkDispose) {
            this.onChunkDispose(key);
        }
    }

    public dispose(): void {
        for (const [key, chunk] of this.chunks) {
            this.disposeChunk(key, chunk);
        }
        if (this.scene.userData.intersectTerrain === this.terrainPickHandler) {
            delete this.scene.userData.intersectTerrain;
        }
        this.chunks.clear();
        this.tileCache.clear();
        this.disposeMeshPool(this.terrainMeshPool);
        this.disposeMeshPool(this.waterMeshPool);
        this.disposeMeshPool(this.ghostMeshPool);
    }

    private disposeMeshPool(pool: THREE.Mesh[]): void {
        while (pool.length > 0) {
            const mesh = pool.pop();
            if (!mesh) continue;
            this.scene.remove(mesh);
            disposeTerrainBoundsTree(mesh.geometry);
            mesh.geometry.dispose();
        }
    }
}
