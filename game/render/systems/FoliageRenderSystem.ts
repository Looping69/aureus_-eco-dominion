/**
 * Foliage Render System
 * Renders trees, rocks, resources, and subtle animated ground grass using InstancedMesh.
 * Receives data from TerrainRenderSystem.
 * (|/) Klaasvaakie
 */

import * as THREE from 'three';
// The package runtime exports this class, but its published declaration file is incomplete.
// Keep the adapter local so the grass renderer can use per-blade uniforms without brittle types.
// @ts-ignore
import { InstancedUniformsMesh as RuntimeInstancedUniformsMesh } from 'three-instanced-uniforms-mesh';
import { BuildingFactory } from '../../../engine/render/utils/VoxelGenerators';
import { foliageInstancedMaterial } from '../../../engine/render/materials/VoxelMaterials';
import { mergeGroupGeometry } from '../../../engine/render/utils/VoxelUtils';
import { getRenderDeviceProfile } from '../../../engine/render/ThreeRenderAdapter';
import { BuildingType, GridTile } from '../../../types';
import { getDaylightFactor } from '../../../engine/sim/dayNightCycle';

export interface FoliageItem {
    x: number;
    y: number;
    z: number;
    type: string;
    marked?: boolean;
}

type GrassBlade = {
    x: number;
    y: number;
    z: number;
    rotation: number;
    width: number;
    height: number;
    color: number;
    windPhase: number;
    lean: number;
};

type GrassMesh = THREE.InstancedMesh & {
    setUniformAt: (name: string, index: number, value: number | THREE.Color) => void;
};

type GroundDetailBudget = {
    enabled: boolean;
    densityModulo: number;
    maxBladesPerChunk: number;
};

function getGroundDetailBudget(): GroundDetailBudget {
    const device = getRenderDeviceProfile();
    if (device.severelyConstrained || device.veryConstrained) {
        return { enabled: false, densityModulo: 12, maxBladesPerChunk: 0 };
    }
    if (device.constrained) {
        return { enabled: true, densityModulo: 6, maxBladesPerChunk: 24 };
    }
    if (device.maxVisuals) {
        return { enabled: true, densityModulo: 2, maxBladesPerChunk: 160 };
    }
    return { enabled: true, densityModulo: 3, maxBladesPerChunk: 96 };
}

const InstancedUniformsMeshCtor = RuntimeInstancedUniformsMesh as unknown as new (
    geometry: THREE.BufferGeometry,
    material: THREE.ShaderMaterial,
    count: number
) => GrassMesh;

export class FoliageRenderSystem {
    private scene: THREE.Scene;
    private chunkMeshes: Map<string, Map<string, THREE.InstancedMesh>> = new Map();
    private groundDetailMeshes: Map<string, GrassMesh> = new Map();
    private geometryCache: Map<string, THREE.BufferGeometry> = new Map();
    private meshPools: Map<string, THREE.InstancedMesh[]> = new Map();
    private grassMeshPool: GrassMesh[] = [];
    private readonly maxPoolSizePerType = 6;
    private readonly maxGrassPoolSize = 16;
    private readonly groundDetailBudget = getGroundDetailBudget();
    private readonly dummy = new THREE.Object3D();
    private readonly markedColor = new THREE.Color(1, 0.3, 0.3);
    private readonly defaultColor = new THREE.Color(1, 1, 1);
    private readonly grassColor = new THREE.Color();
    private groundDetailVisible = false;
    private grassGeometry: THREE.BufferGeometry | null = null;
    private grassMaterial: THREE.ShaderMaterial | null = null;

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

    public updateGroundDetailChunk(key: string, tiles: GridTile[]): void {
        if (!this.groundDetailBudget.enabled) {
            this.removeGroundDetailChunk(key);
            return;
        }

        const blades = this.collectGrassBlades(tiles);
        if (blades.length === 0) {
            this.removeGroundDetailChunk(key);
            return;
        }

        const existing = this.groundDetailMeshes.get(key);
        const mesh = this.prepareGrassMesh(key, blades.length, existing);
        for (let idx = 0; idx < blades.length; idx += 1) {
            const blade = blades[idx];
            this.dummy.position.set(blade.x, blade.y, blade.z);
            this.dummy.rotation.set(0, blade.rotation, 0);
            this.dummy.scale.set(blade.width, blade.height, blade.width);
            this.dummy.updateMatrix();
            mesh.setMatrixAt(idx, this.dummy.matrix);
            mesh.setUniformAt('bladeTint', idx, this.grassColor.set(blade.color));
            mesh.setUniformAt('windPhase', idx, blade.windPhase);
            mesh.setUniformAt('bladeLean', idx, blade.lean);
        }

        mesh.count = blades.length;
        mesh.visible = this.groundDetailVisible;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        this.groundDetailMeshes.set(key, mesh);
    }

    public setGroundDetailVisible(visible: boolean): void {
        if (this.groundDetailVisible === visible) return;
        this.groundDetailVisible = visible;
        for (const mesh of this.groundDetailMeshes.values()) {
            mesh.visible = visible;
        }
    }

    public updateGroundDetailTime(time: number, timeOfDay: number = 12000): void {
        const material = this.grassMaterial;
        if (!material) return;
        const daylight = getDaylightFactor(timeOfDay);
        material.uniforms.windTime.value = time;
        material.uniforms.lightFactor.value = 0.24 + daylight * 0.76;
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
        this.grassGeometry?.dispose();
        this.grassMaterial?.dispose();
    }

    private collectGrassBlades(tiles: GridTile[]): GrassBlade[] {
        const blades: GrassBlade[] = [];
        for (const tile of tiles) {
            if (blades.length >= this.groundDetailBudget.maxBladesPerChunk) break;
            if (tile.biome !== 'GRASS') continue;
            if (tile.locked || tile.buildingType !== BuildingType.EMPTY) continue;
            if (tile.foliage && tile.foliage !== 'NONE') continue;
            if (!this.shouldGrowGrass(tile.x, tile.z)) continue;

            const bladeCount = this.grassBladeCount(tile.x, tile.z);
            for (let i = 0; i < bladeCount && blades.length < this.groundDetailBudget.maxBladesPerChunk; i += 1) {
                const seed = this.seed(tile.x, tile.z, i + 17);
                const offsetX = ((seed % 100) / 100 - 0.5) * 0.46;
                const offsetZ = (((seed / 101) % 100) / 100 - 0.5) * 0.46;
                const height = 0.11 + ((seed % 17) / 520);
                const width = 0.14 + ((seed % 13) / 460);
                blades.push({
                    x: tile.x + offsetX,
                    y: tile.terrainHeight * 0.5 + 0.018,
                    z: tile.z + offsetZ,
                    rotation: (seed % 628) / 100,
                    width,
                    height,
                    color: this.grassBladeColor(seed),
                    windPhase: (seed % 628) / 100,
                    lean: (((seed % 200) / 100) - 1) * 0.18,
                });
            }
        }
        return blades;
    }

    private shouldGrowGrass(x: number, z: number): boolean {
        return this.seed(x, z, 3) % this.groundDetailBudget.densityModulo === 0;
    }

    private grassBladeCount(x: number, z: number): number {
        if (this.groundDetailBudget.maxBladesPerChunk <= 24) return 1;
        const seed = this.seed(x, z, 9);
        return seed % 4 === 0 ? 2 : 1;
    }

    private grassBladeColor(seed: number): number {
        const palette = [0x47783b, 0x548a42, 0x608f49, 0x3f6f37, 0x5f9847];
        return palette[seed % palette.length];
    }

    private seed(x: number, z: number, salt: number): number {
        const n = Math.sin((x * 127.1) + (z * 311.7) + (salt * 19.19)) * 43758.5453;
        return Math.abs(Math.floor((n - Math.floor(n)) * 100000));
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

    private getGrassGeometry(): THREE.BufferGeometry {
        if (this.grassGeometry) return this.grassGeometry;

        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array([
            -0.05, 0, 0, 0.05, 0, 0, 0.028, 1, 0,
            -0.05, 0, 0, 0.028, 1, 0, -0.024, 0.68, 0,
            0, 0, -0.05, 0, 0, 0.05, 0, 0.92, 0.028,
            0, 0, -0.05, 0, 0.92, 0.028, 0, 0.62, -0.024,
        ]);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
        this.grassGeometry = geo;
        return geo;
    }

    private getGrassMaterial(): THREE.ShaderMaterial {
        if (this.grassMaterial) return this.grassMaterial;
        this.grassMaterial = new THREE.ShaderMaterial({
            uniforms: {
                windTime: { value: 0 },
                windStrength: { value: 0.032 },
                lightFactor: { value: 1 },
                bladeTint: { value: new THREE.Color(0x548a42) },
                windPhase: { value: 0 },
                bladeLean: { value: 0 },
            },
            vertexShader: `
                uniform float windTime;
                uniform float windStrength;
                uniform float lightFactor;
                uniform vec3 bladeTint;
                uniform float windPhase;
                uniform float bladeLean;
                varying vec3 vBladeColor;
                varying float vBladeHeight;

                void main() {
                    vec3 transformed = position;
                    float heightRatio = clamp(position.y, 0.0, 1.0);
                    float wind = sin(windTime * 1.7 + windPhase + position.x * 2.4) * windStrength * heightRatio;
                    transformed.x += wind + bladeLean * heightRatio * 0.06;
                    transformed.z += cos(windTime * 1.2 + windPhase) * windStrength * 0.22 * heightRatio;
                    vec3 shadedTint = bladeTint * lightFactor;
                    vBladeColor = mix(shadedTint * 0.78, shadedTint * 1.08, heightRatio);
                    vBladeHeight = heightRatio;
                    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vBladeColor;
                varying float vBladeHeight;

                void main() {
                    float alpha = mix(0.52, 0.72, vBladeHeight);
                    gl_FragColor = vec4(vBladeColor, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this.grassMaterial.name = 'animated-instanced-grass-material';
        return this.grassMaterial;
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

    private prepareGrassMesh(key: string, count: number, existing?: GrassMesh): GrassMesh {
        const existingCapacity = this.getMeshCapacity(existing);
        let mesh = existing;
        if (!mesh || existingCapacity < count) {
            if (mesh) {
                this.releaseGrassMesh(mesh);
            }
            mesh = this.acquireGrassMesh(count);
        }

        mesh.count = count;
        mesh.visible = this.groundDetailVisible;
        mesh.frustumCulled = true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.userData.chunkKey = key;
        mesh.userData.foliageType = 'GROUND_GRASS';
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

    private acquireGrassMesh(count: number): GrassMesh {
        const pooledIndex = this.grassMeshPool.findIndex((mesh) => this.getMeshCapacity(mesh) >= count);
        const mesh = pooledIndex >= 0
            ? this.grassMeshPool.splice(pooledIndex, 1)[0]
            : new InstancedUniformsMeshCtor(this.getGrassGeometry(), this.getGrassMaterial(), this.getCapacity(count));

        mesh.geometry = this.getGrassGeometry();
        mesh.material = this.getGrassMaterial();
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.userData.capacity = this.getMeshCapacity(mesh);
        mesh.userData.instanceLibrary = 'three-instanced-uniforms-mesh';
        if (!this.scene.children.includes(mesh)) {
            this.scene.add(mesh);
        }
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