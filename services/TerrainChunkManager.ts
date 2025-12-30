
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { GridTile } from '../types';
import { matMaster, waterFlowMaterial } from '../utils/voxelMaterials';
import { CHUNK_SIZE, getChunkId, getChunkKey } from '../utils/chunkUtils';
import { NOISE_SOURCE, TREE_LOGIC_SOURCE } from '../utils/gameUtils';

// --- WORKER GENERATOR ---
function createWorkerBlob() {
    const code = `
    const CHUNK_SIZE = ${CHUNK_SIZE};
    const BEDROCK_Y = -5;
    
    // Inject logic
    ${NOISE_SOURCE}
    ${TREE_LOGIC_SOURCE}

    // Simple pseudo-random for deterministic foliage
    function pRand(x, z) {
        return Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    }

    // Color Palette
    const PALETTE = {
        'grass': [0.36, 0.62, 0.27],
        'grassLight': [0.52, 0.80, 0.09],
        'dirt': [0.47, 0.21, 0.06],
        'sand': [0.92, 0.70, 0.03],
        'stone': [0.39, 0.45, 0.54],
        'snow': [1.0, 1.0, 1.0],
        'water': [0.02, 0.71, 0.83],
        'concrete': [0.58, 0.64, 0.72]
    };

    self.onmessage = (e) => {
        if (e.data.type === 'BUILD_CHUNK') {
            const { chunkId, tiles, cx, cz, gridSize } = e.data.payload;
            
            const offsetX = (gridSize - 1) / 2;
            const offsetZ = (gridSize - 1) / 2;
            const startX = cx * CHUNK_SIZE;
            const startZ = cz * CHUNK_SIZE;
            
            const baseVoxels = new Map();
            const waterVoxels = new Map();
            const foliageItems = [];

            const getKey = (x, y, z) => x + ',' + y + ',' + z;
            const setVoxel = (map, x, y, z, c) => map.set(getKey(x,y,z), c);

            const tileMap = new Map();
            if (tiles) tiles.forEach(t => tileMap.set(t.x + ',' + t.y, t));

            // 1. POPULATE VOXELS & FOLIAGE
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const worldX = startX + x;
                    const worldZ = startZ + z;
                    
                    let terrainHeight = 0;
                    let biome = 'GRASS';
                    let buildingType = 'EMPTY';
                    
                    const key = worldX + ',' + worldZ;
                    const inGrid = tileMap.has(key);

                    if (inGrid) {
                        const t = tileMap.get(key);
                        terrainHeight = t.terrainHeight;
                        biome = t.biome;
                        buildingType = t.buildingType;
                        
                        // Generate procedural foliage for in-grid tiles too (unified system)
                        // Skip if there's a building or special foliage like GOLD_VEIN
                        if (buildingType === 'EMPTY' && terrainHeight > 0 && (!t.foliage || t.foliage === 'NONE')) {
                            const noiseX = worldX - offsetX;
                            const noiseZ = worldZ - offsetZ;
                            const data = getBiomeAt(noiseX, noiseZ);
                            const distFromCenter = Math.sqrt(noiseX*noiseX + noiseZ*noiseZ);
                            const rng = pRand(worldX, worldZ);
                            const foliage = getFoliageAt(data.biome, terrainHeight, data.detail, distFromCenter, rng);
                            
                            if (foliage !== 'NONE' && foliage !== 'GOLD_VEIN') {
                                foliageItems.push({
                                    x: worldX,
                                    y: terrainHeight * 0.5,
                                    z: worldZ,
                                    type: foliage
                                });
                            }
                        }
                    } else {
                        // Infinite Terrain Generation
                        const noiseX = worldX - offsetX;
                        const noiseZ = worldZ - offsetZ;
                        const data = getBiomeAt(noiseX, noiseZ);
                        terrainHeight = data.height;
                        biome = data.biome;
                        
                        // Procedural Foliage for Infinite Terrain
                        if (terrainHeight > 0) {
                            const distFromCenter = Math.sqrt(noiseX*noiseX + noiseZ*noiseZ);
                            // Use deterministic random based on position
                            const rng = pRand(worldX, worldZ);
                            const foliage = getFoliageAt(biome, terrainHeight, data.detail, distFromCenter, rng);
                            
                            if (foliage !== 'NONE') {
                                foliageItems.push({
                                    x: worldX,
                                    y: terrainHeight * 0.5,
                                    z: worldZ,
                                    type: foliage
                                });
                            }
                        }
                    }

                    // Terrain Columns
                    let matKey = biome.toLowerCase();
                    if (biome === 'GRASS' && terrainHeight > 2) matKey = 'grassLight';
                    
                    // Mine hole logic
                    if (inGrid && tileMap.get(key).foliage === 'MINE_HOLE') matKey = 'stone';

                    const surfaceY = Math.floor(terrainHeight * 0.5); 
                    let solidTopY = surfaceY;
                    
                    const isPond = buildingType === 'POND';
                    const isReservoir = buildingType === 'RESERVOIR';
                    const isWaterBody = isPond || isReservoir || (!inGrid && terrainHeight === 0);

                    if (isPond) {
                        solidTopY -= 1;
                        matKey = 'sand';
                    } else if (isReservoir) {
                        solidTopY -= 1;
                        matKey = 'concrete';
                    } else if (isWaterBody) {
                        solidTopY = -2;
                        matKey = 'sand';
                    }

                    // Fill Terrain Column
                    for(let y = BEDROCK_Y; y < solidTopY; y++) {
                        setVoxel(baseVoxels, x, y, z, matKey);
                    }
                    if (solidTopY >= BEDROCK_Y) {
                        setVoxel(baseVoxels, x, solidTopY, z, matKey);
                    }

                    // Water
                    if (isWaterBody) {
                        let waterY = surfaceY;
                        if (terrainHeight === 0) waterY = 0; 
                        setVoxel(waterVoxels, x, waterY, z, 'water');
                    }
                }
            }

            // 2. MESHING
            const buildGeometry = (map) => {
                const positions = [];
                const normals = [];
                const colors = [];
                const uvs = [];

                const FACE_DIRS = [
                    [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]
                ];

                for (const [key, mat] of map) {
                    const [sx, sy, sz] = key.split(',').map(Number);
                    const color = PALETTE[mat] || [1,1,1];

                    for (let i = 0; i < 6; i++) {
                        const dir = FACE_DIRS[i];
                        const nx = sx + dir[0];
                        const ny = sy + dir[1];
                        const nz = sz + dir[2];
                        
                        if (map.has(getKey(nx, ny, nz))) continue;

                        const dx = dir[0], dy = dir[1], dz = dir[2];
                        const h = 0.5;
                        
                        let v1, v2, v3, v4;
                        if (i === 0) { v1 = [h, -h, h]; v2 = [h, -h, -h]; v3 = [h, h, -h]; v4 = [h, h, h]; } 
                        else if (i === 1) { v1 = [-h, -h, -h]; v2 = [-h, -h, h]; v3 = [-h, h, h]; v4 = [-h, h, -h]; } 
                        else if (i === 2) { v1 = [-h, h, h]; v2 = [h, h, h]; v3 = [h, h, -h]; v4 = [-h, h, -h]; } 
                        else if (i === 3) { v1 = [-h, -h, -h]; v2 = [h, -h, -h]; v3 = [h, -h, h]; v4 = [-h, -h, h]; } 
                        else if (i === 4) { v1 = [-h, -h, h]; v2 = [h, -h, h]; v3 = [h, h, h]; v4 = [-h, h, h]; } 
                        else { v1 = [h, -h, -h]; v2 = [-h, -h, -h]; v3 = [-h, h, -h]; v4 = [h, h, -h]; }

                        positions.push(sx+v1[0], sy+v1[1], sz+v1[2]); positions.push(sx+v2[0], sy+v2[1], sz+v2[2]); positions.push(sx+v3[0], sy+v3[1], sz+v3[2]);
                        positions.push(sx+v1[0], sy+v1[1], sz+v1[2]); positions.push(sx+v3[0], sy+v3[1], sz+v3[2]); positions.push(sx+v4[0], sy+v4[1], sz+v4[2]);

                        for(let k=0; k<6; k++) {
                            normals.push(dx, dy, dz);
                            colors.push(color[0], color[1], color[2]);
                        }
                        uvs.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1);
                    }
                }
                return { positions, normals, colors, uvs };
            };

            const solidGeo = buildGeometry(baseVoxels);
            const waterGeo = buildGeometry(waterVoxels);

            const serialize = (geo) => {
                if (geo.positions.length === 0) return null;
                return {
                    p: new Float32Array(geo.positions),
                    n: new Float32Array(geo.normals),
                    c: new Float32Array(geo.colors),
                    u: new Float32Array(geo.uvs)
                };
            };

            const payload = {
                chunkId,
                solid: serialize(solidGeo),
                water: serialize(waterGeo),
                foliage: foliageItems,
                cx, cz
            };
            
            const transfer = [];
            if(payload.solid) transfer.push(payload.solid.p.buffer, payload.solid.n.buffer, payload.solid.c.buffer, payload.solid.u.buffer);
            if(payload.water) transfer.push(payload.water.p.buffer, payload.water.n.buffer, payload.water.c.buffer, payload.water.u.buffer);

            self.postMessage({ type: 'CHUNK_BUILT', payload }, transfer);
        }
    };
    `;
    return new Blob([code], { type: 'application/javascript' });
}

interface MeshData {
    p: Float32Array; n: Float32Array; c: Float32Array; u: Float32Array;
}

interface ChunkData {
    mesh: THREE.Mesh | null;
    waterMesh: THREE.Mesh | null;
    dirty: boolean;
}

export class TerrainChunkManager {
    private scene: THREE.Scene;
    private gridSize: number;
    private worker: Worker;
    private chunks: Map<string, ChunkData> = new Map();
    private tileCache: Map<string, GridTile[]> = new Map();
    private lastUpdatePos = new THREE.Vector2(-9999, -9999);
    private onFoliageUpdate: (key: string, items: any[]) => void;
    private onChunkDispose: (key: string) => void;

    constructor(
        scene: THREE.Scene,
        gridSize: number,
        onFoliageUpdate: (key: string, items: any[]) => void,
        onChunkDispose: (key: string) => void
    ) {
        this.scene = scene;
        this.gridSize = gridSize;
        this.onFoliageUpdate = onFoliageUpdate;
        this.onChunkDispose = onChunkDispose;

        const blob = createWorkerBlob();
        this.worker = new Worker(URL.createObjectURL(blob));
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
    }

    private handleWorkerMessage(e: MessageEvent) {
        const { type, payload } = e.data;
        if (type === 'CHUNK_BUILT') this.applyChunkUpdate(payload);
    }

    public syncGrid(grid: GridTile[]) {
        const newCache = new Map<string, GridTile[]>();
        grid.forEach(tile => {
            const { x: cx, z: cz } = getChunkId(tile.id);
            const key = getChunkKey(cx, cz);
            if (!newCache.has(key)) newCache.set(key, []);
            newCache.get(key)!.push(tile);
        });
        newCache.forEach((tiles, key) => {
            this.tileCache.set(key, tiles);
            if (this.chunks.has(key)) this.chunks.get(key)!.dirty = true;
        });
        this.lastUpdatePos.set(-9999, -9999);
    }

    public update(cameraX: number, cameraZ: number) {
        if (Math.abs(cameraX - this.lastUpdatePos.x) < 5 && Math.abs(cameraZ - this.lastUpdatePos.y) < 5) return;
        this.lastUpdatePos.set(cameraX, cameraZ);

        const worldX = cameraX + (this.gridSize - 1) / 2;
        const cx = Math.floor(worldX / CHUNK_SIZE);
        const cz = Math.floor((cameraZ + (this.gridSize - 1) / 2) / CHUNK_SIZE);
        const R = 2; // Reduced from 3 for performance

        const validKeys = new Set<string>();
        for (let z = cz - R; z <= cz + R; z++) {
            for (let x = cx - R; x <= cx + R; x++) {
                const key = getChunkKey(x, z);
                validKeys.add(key);
                if (!this.chunks.has(key) || this.chunks.get(key)!.dirty) {
                    this.requestChunkBuild(key, x, z, this.tileCache.get(key) || []);
                    if (!this.chunks.has(key)) this.chunks.set(key, { mesh: null, waterMesh: null, dirty: false });
                    else this.chunks.get(key)!.dirty = false;
                }
            }
        }
        this.chunks.forEach((chunk, key) => {
            if (!validKeys.has(key)) {
                this.disposeChunk(chunk, key);
                this.chunks.delete(key);
            }
        });
    }

    public updateTiles(updates: GridTile[]) {
        const affectedChunks = new Set<string>();
        updates.forEach(tile => {
            const { x: cx, z: cz } = getChunkId(tile.id);
            const key = getChunkKey(cx, cz);
            let chunkTiles = this.tileCache.get(key);
            if (!chunkTiles) { chunkTiles = []; this.tileCache.set(key, chunkTiles); }
            const existingIdx = chunkTiles.findIndex(t => t.id === tile.id);
            if (existingIdx !== -1) chunkTiles[existingIdx] = tile;
            else chunkTiles.push(tile);
            affectedChunks.add(key);
        });
        affectedChunks.forEach(key => {
            const [cx, cz] = key.split(',').map(Number);
            this.requestChunkBuild(key, cx, cz, this.tileCache.get(key) || []);
        });
    }

    private requestChunkBuild(chunkId: string, cx: number, cz: number, tiles: GridTile[]) {
        this.worker.postMessage({
            type: 'BUILD_CHUNK',
            payload: { chunkId, cx, cz, tiles, gridSize: this.gridSize }
        });
    }

    private applyChunkUpdate(payload: { chunkId: string, solid: MeshData, water: MeshData, foliage: any[], cx: number, cz: number }) {
        if (!this.chunks.has(payload.chunkId)) return;
        const chunk = this.chunks.get(payload.chunkId)!;
        this.disposeChunk(chunk, payload.chunkId, false);

        const offsetX = (this.gridSize - 1) / 2;
        const offsetZ = (this.gridSize - 1) / 2;
        const xPos = (payload.cx * CHUNK_SIZE) - offsetX;
        const zPos = (payload.cz * CHUNK_SIZE) - offsetZ;

        const createMesh = (data: MeshData, mat: THREE.Material, castShadow: boolean) => {
            if (!data || data.p.length === 0) return null;
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(data.p, 3));
            geo.setAttribute('normal', new THREE.BufferAttribute(data.n, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(data.c, 3));
            geo.setAttribute('uv', new THREE.BufferAttribute(data.u, 2));

            // Re-calculate bounds for raycasting
            geo.computeBoundingSphere();
            geo.computeBoundingBox();

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(xPos, 0, zPos);
            mesh.castShadow = castShadow;
            mesh.receiveShadow = true;
            // DISABLE FRUSTUM CULLING TO FIX DISAPPEARING GROUND
            // This is required because terrain bounding spheres can be miscalculated or large
            mesh.frustumCulled = false;
            return mesh;
        };

        chunk.mesh = createMesh(payload.solid, matMaster, true);
        if (chunk.mesh) this.scene.add(chunk.mesh);

        chunk.waterMesh = createMesh(payload.water, waterFlowMaterial, false);
        if (chunk.waterMesh) {
            chunk.waterMesh.receiveShadow = false;
            this.scene.add(chunk.waterMesh);
        }

        // Send foliage to FoliageManager
        if (this.onFoliageUpdate && payload.foliage) {
            this.onFoliageUpdate(payload.chunkId, payload.foliage);
        }
    }

    private disposeChunk(chunk: ChunkData, key: string, clearRef = true) {
        if (chunk.mesh) { this.scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); }
        if (chunk.waterMesh) { this.scene.remove(chunk.waterMesh); chunk.waterMesh.geometry.dispose(); }
        if (clearRef) { chunk.mesh = null; chunk.waterMesh = null; }

        // Notify FoliageManager to clear background trees for this chunk
        if (this.onChunkDispose) {
            this.onChunkDispose(key);
        }
    }

    public getInteractables(): THREE.Object3D[] {
        const list: THREE.Object3D[] = [];
        this.chunks.forEach(chunk => { if (chunk.mesh) list.push(chunk.mesh); });
        return list;
    }

    public setLOD(zoomLevel: number) {
        // Placeholder
    }

    public cleanup() {
        this.worker.terminate();
        this.chunks.forEach((chunk, key) => this.disposeChunk(chunk, key));
        this.chunks.clear();
    }
}
