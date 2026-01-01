
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { GridTile, BuildingType } from '../types';
import { mats, waterFlowMaterial } from '../utils/voxelMaterials';
import { BuildingFactory } from '../utils/voxelGenerators';
import { COLORS, BUILDINGS } from '../utils/voxelConstants';
import { TerrainChunkManager } from './TerrainChunkManager';
import { sharedBoxGeo } from '../utils/voxelBuilder';

interface Particle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    decay: number;
}

interface AnimationDef {
    mesh: THREE.Object3D;
    type: 'ROTOR' | 'SOLAR' | 'SMOKE_EMITTER' | 'NUGGET_POP';
    lastEmit?: number;
    baseRotX?: number;
    velocity?: number;
    groundY?: number;
}

export class WorldManager {
    private scene: THREE.Scene;
    private gridSize: number;

    // Sub-Systems
    private terrainManager: TerrainChunkManager;

    // Scene Objects
    public buildingMeshes: Map<number, THREE.Object3D> = new Map();
    public animatedElements: Map<number, AnimationDef[]> = new Map();
    private particles: Particle[] = [];

    // State Maps
    public tileHeightMap: Map<number, number> = new Map();
    private gridCache: GridTile[] = [];

    // Infrastructure types that need neighbor connections
    private readonly CONNECTABLE_TYPES = new Set([BuildingType.ROAD, BuildingType.PIPE, BuildingType.FENCE]);

    // Visuals
    private selectionCursor: THREE.Mesh;
    private ghostCursors: THREE.Mesh[] = [];
    private ghostBuilding: THREE.Group | null = null;
    public currentGhostType: BuildingType | null = null;
    private pinnedGhostIndex: number | null = null;

    // Reusable Geometries to prevent leaks
    private pathMarkerGeo = new THREE.BoxGeometry(0.15, 0.05, 0.15);
    private pathMarkerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
    private particleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);

    // Config
    private particleMats: Record<string, THREE.Material> = {
        MINERAL: new THREE.MeshBasicMaterial({ color: 0xcbd5e1 }),
        ECO: new THREE.MeshBasicMaterial({ color: 0x10b981 }),
        TRUST: new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
        CASH: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
        THEFT: new THREE.MeshBasicMaterial({ color: 0x000000 }),
        SMOKE: new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.5 }),
        DUST: new THREE.MeshBasicMaterial({ color: 0xd6d3d1 }),
        GOLD_PIECE: new THREE.MeshBasicMaterial({ color: 0xffd700 }),
        ROCK_CHUNK: new THREE.MeshBasicMaterial({ color: 0x57534e }),
        ECO_REHAB: mats.emissiveGreen
    };

    constructor(
        scene: THREE.Scene,
        gridSize: number,
        onFoliageUpdate: (key: string, items: any[]) => void,
        onChunkDispose: (key: string) => void
    ) {
        this.scene = scene;
        this.gridSize = gridSize;
        this.terrainManager = new TerrainChunkManager(scene, gridSize, onFoliageUpdate, onChunkDispose);
        this.initCursors();
    }

    private initCursors() {
        this.selectionCursor = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 0.05, 1.0),
            new THREE.MeshBasicMaterial({ color: COLORS.HIGHLIGHT_VALID, opacity: 0.5, transparent: true, depthWrite: false })
        );
        this.selectionCursor.renderOrder = 100;
        this.selectionCursor.visible = false;
        this.scene.add(this.selectionCursor);
    }

    public initialSync(grid: GridTile[]) {
        this.tileHeightMap.clear();
        this.gridCache = grid; // Cache grid reference for neighbor lookups
        grid.forEach(tile => {
            this.tileHeightMap.set(tile.id, tile.terrainHeight * 0.5);
        });

        // Delegate terrain to Chunk Manager
        this.terrainManager.syncGrid(grid);

        // Build static buildings
        this.applyGridUpdates(grid);
    }

    /**
     * Calculate connection flags for infrastructure (road/pipe/fence)
     * based on neighboring tiles of the same type
     */
    private getConnectionFlags(tile: GridTile): { north: boolean; south: boolean; east: boolean; west: boolean } {
        const x = tile.x;
        const z = tile.y;
        const type = tile.buildingType;

        const getNeighbor = (dx: number, dz: number): GridTile | null => {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nx >= this.gridSize || nz < 0 || nz >= this.gridSize) return null;
            return this.gridCache[nz * this.gridSize + nx] || null;
        };

        const northTile = getNeighbor(0, -1);
        const southTile = getNeighbor(0, 1);
        const eastTile = getNeighbor(1, 0);
        const westTile = getNeighbor(-1, 0);

        return {
            north: northTile?.buildingType === type,
            south: southTile?.buildingType === type,
            east: eastTile?.buildingType === type,
            west: westTile?.buildingType === type
        };
    }

    /**
     * Get all neighbor tile IDs that might need to be updated when infrastructure changes
     */
    private getNeighborIds(tileId: number): number[] {
        const x = tileId % this.gridSize;
        const z = Math.floor(tileId / this.gridSize);
        const neighbors: number[] = [];

        if (z > 0) neighbors.push(tileId - this.gridSize); // North
        if (z < this.gridSize - 1) neighbors.push(tileId + this.gridSize); // South
        if (x > 0) neighbors.push(tileId - 1); // West
        if (x < this.gridSize - 1) neighbors.push(tileId + 1); // East

        return neighbors;
    }

    public updateChunks(cameraX: number, cameraZ: number) {
        this.terrainManager.update(cameraX, cameraZ);
    }

    public applyGridUpdates(updates: GridTile[]) {
        const offset = (this.gridSize - 1) / 2;

        // Update grid cache
        updates.forEach(tile => {
            this.gridCache[tile.id] = tile;
        });

        // 1. Terrain Updates (via Worker)
        this.terrainManager.updateTiles(updates);

        // Collect infrastructure neighbors that need visual refresh
        const infrastructureUpdates = new Set<number>();
        updates.forEach(tile => {
            if (this.CONNECTABLE_TYPES.has(tile.buildingType)) {
                // This tile changed - needs update
                infrastructureUpdates.add(tile.id);
                // All neighbors of this connectable type also need update
                this.getNeighborIds(tile.id).forEach(nId => {
                    const neighbor = this.gridCache[nId];
                    if (neighbor && this.CONNECTABLE_TYPES.has(neighbor.buildingType)) {
                        infrastructureUpdates.add(nId);
                    }
                });
            }
        });

        // Force refresh infrastructure connections
        infrastructureUpdates.forEach(tileId => {
            if (this.buildingMeshes.has(tileId)) {
                const existing = this.buildingMeshes.get(tileId)!;
                this.scene.remove(existing);
                this.buildingMeshes.delete(tileId);
                this.animatedElements.delete(tileId);
            }
        });

        // 2. Building Logic
        updates.forEach(tile => {
            // Update Height Map for logic
            this.tileHeightMap.set(tile.id, tile.terrainHeight * 0.5);

            if (this.buildingMeshes.has(tile.id)) {
                const existing = this.buildingMeshes.get(tile.id)!;
                const typeChanged = existing.userData.type !== tile.buildingType && tile.buildingType !== BuildingType.EMPTY;

                // Remove if empty OR if it's now a water tile (handled by terrain system)
                const isWater = tile.buildingType === BuildingType.POND || tile.buildingType === BuildingType.RESERVOIR;

                if ((tile.buildingType === BuildingType.EMPTY && tile.foliage !== 'ILLEGAL_CAMP') || isWater) {
                    this.scene.remove(existing);
                    this.buildingMeshes.delete(tile.id);
                    this.animatedElements.delete(tile.id);
                    return;
                }

                if (!typeChanged) {
                    const currentProgress = existing.userData.config?.progress || 0;
                    const newProgress = 1 - ((tile.constructionTimeLeft || 0) / (BUILDINGS[tile.buildingType]?.buildTime || 1));

                    if (Math.abs(currentProgress - newProgress) > 0.05 || tile.isUnderConstruction !== existing.userData.config?.isUnderConstruction) {
                        this.scene.remove(existing);
                        this.buildingMeshes.delete(tile.id);
                        this.animatedElements.delete(tile.id);
                        this.createBuildingAt(tile.id, tile.buildingType, tile.x, tile.y, this.tileHeightMap.get(tile.id) || 0, offset, {
                            isUnderConstruction: tile.isUnderConstruction,
                            progress: newProgress,
                            integrity: tile.integrity,
                            waterStatus: tile.waterStatus
                        });
                    }
                    return;
                } else {
                    this.scene.remove(existing);
                    this.buildingMeshes.delete(tile.id);
                    this.animatedElements.delete(tile.id);
                }
            }

            // Only generate meshes for Buildings or Illegal Camps (which need smoke)
            // Trees, rocks, gold, holes AND WATER are now handled by TerrainChunkManager
            const isWater = tile.buildingType === BuildingType.POND || tile.buildingType === BuildingType.RESERVOIR;

            if (!isWater && (tile.buildingType !== BuildingType.EMPTY || tile.foliage === 'ILLEGAL_CAMP')) {
                if (tile.structureHeadIndex !== undefined && tile.id !== tile.structureHeadIndex &&
                    !(tile.buildingType === BuildingType.ROAD || tile.buildingType === BuildingType.PIPE || tile.buildingType === BuildingType.FENCE)) {
                    return;
                }

                let type: string = tile.buildingType;
                if (type === BuildingType.EMPTY && tile.foliage === 'ILLEGAL_CAMP') type = tile.foliage;

                if (type !== BuildingType.EMPTY && !this.buildingMeshes.has(tile.id)) {
                    const progress = 1 - ((tile.constructionTimeLeft || 0) / (BUILDINGS[tile.buildingType]?.buildTime || 1));

                    // Calculate connections for infrastructure
                    const connections = this.CONNECTABLE_TYPES.has(tile.buildingType as BuildingType)
                        ? this.getConnectionFlags(tile)
                        : undefined;

                    this.createBuildingAt(tile.id, type, tile.x, tile.y, this.tileHeightMap.get(tile.id) || 0, offset, {
                        isUnderConstruction: tile.isUnderConstruction,
                        progress,
                        integrity: tile.integrity,
                        waterStatus: tile.waterStatus,
                        connections
                    });
                }
            }
        });
    }

    private createBuildingAt(id: number, type: string, x: number, z: number, y: number, offset: number, config?: any) {
        if (!BuildingFactory[type]) return;

        const seed = Math.abs(x * 11 + z * 17 + id * 31);
        const buildingGroup = BuildingFactory[type]({ ...config, seed });
        const root = new THREE.Group();

        const def = BUILDINGS[type as BuildingType];
        const w = def?.width || 1;
        const d = def?.depth || 1;
        const dx = (w - 1) / 2;
        const dz = (d - 1) / 2;
        root.position.set(x - offset + dx, y, z - offset + dz);

        if (config?.isUnderConstruction) {
            const scale = 0.4 + (config.progress * 0.6);
            buildingGroup.scale.set(scale, scale, scale);
            buildingGroup.position.y -= (1 - config.progress) * 0.5;

            buildingGroup.traverse(c => {
                if (c instanceof THREE.Mesh && c.material && !Array.isArray(c.material)) {
                    c.material = new THREE.MeshStandardMaterial({
                        color: 0x00ffff, transparent: true, opacity: 0.6,
                        roughness: 0.2, metalness: 0.8, emissive: 0x00ffff, emissiveIntensity: 0.4
                    });
                }
            });

            const scaffold = BuildingFactory['CONSTRUCTION']({ width: w, depth: d });
            root.add(scaffold);

            const barWidth = w * 0.8;
            // MEMORY LEAK FIX: Use sharedBoxGeo and scale it instead of new Geometry
            const bgBar = new THREE.Mesh(sharedBoxGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
            bgBar.scale.set(barWidth, 0.15, 0.1);
            bgBar.position.y = 2.5;

            const fillWidth = Math.max(0.01, barWidth * config.progress);
            const fillBar = new THREE.Mesh(sharedBoxGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e }));
            fillBar.scale.set(fillWidth, 0.12, 0.12);
            fillBar.position.x = -barWidth / 2 + fillWidth / 2;
            fillBar.position.z = 0.02;

            bgBar.add(fillBar);
            root.add(bgBar);
        }

        root.add(buildingGroup);
        root.userData = { type, config, index: id };

        const anims: AnimationDef[] = [];
        root.traverse(c => {
            // Optimization: Disable auto update for static meshes
            c.matrixAutoUpdate = false;
            c.updateMatrix();

            if (c.userData.isRotor) anims.push({ mesh: c, type: 'ROTOR' });
            if (c.userData.isSolarPanel) anims.push({ mesh: c, type: 'SOLAR', baseRotX: c.rotation.x });
            if (c.userData.isNugget) anims.push({ mesh: c, type: 'NUGGET_POP', velocity: c.userData.velocity, groundY: c.userData.groundY });
        });

        // Root group also static unless animated
        root.matrixAutoUpdate = false;
        root.updateMatrix();

        if (['WASH_PLANT', 'RECYCLING_PLANT', 'ILLEGAL_CAMP'].includes(type)) {
            anims.push({ mesh: root, type: 'SMOKE_EMITTER', lastEmit: Math.random() });
        }

        if (anims.length > 0) this.animatedElements.set(id, anims);
        this.scene.add(root);
        this.buildingMeshes.set(id, root);
    }

    public updateCursor(point: THREE.Vector3 | null, ghostType: BuildingType | null) {
        if (!point) {
            this.selectionCursor.visible = false;
            if (this.ghostBuilding && !this.pinnedGhostIndex) this.ghostBuilding.visible = false;
            return;
        }

        if (this.pinnedGhostIndex !== null) return;

        let dx = 0, dz = 0, w = 1, d = 1;
        if (ghostType) {
            const def = BUILDINGS[ghostType];
            w = def?.width || 1;
            d = def?.depth || 1;
            dx = (w - 1) / 2;
            dz = (d - 1) / 2;
        }

        this.selectionCursor.visible = true;
        this.selectionCursor.position.set(point.x + dx, point.y + 0.1, point.z + dz);
        this.selectionCursor.scale.set(w, 1, d);
        this.selectionCursor.updateMatrix();

        if (this.ghostBuilding) {
            this.ghostBuilding.visible = true;
            this.ghostBuilding.position.set(point.x + dx, point.y, point.z + dz);
            this.ghostBuilding.updateMatrix();
        }
    }

    public setGhostBuilding(type: BuildingType | null) {
        this.currentGhostType = type;
        if (this.ghostBuilding) { this.scene.remove(this.ghostBuilding); this.ghostBuilding = null; }
        if (!type || type === BuildingType.EMPTY) return;

        // Handle Water Ghost separately since it's no longer a standard BuildingFactory item
        if (type === BuildingType.POND || type === BuildingType.RESERVOIR) {
            const w = BUILDINGS[type].width || 1;
            const d = BUILDINGS[type].depth || 1;
            const geo = new THREE.BoxGeometry(w, 0.1, d);
            const mat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.5 });
            const mesh = new THREE.Mesh(geo, mat);
            const outer = new THREE.Group();
            outer.add(mesh);
            this.scene.add(outer);
            this.ghostBuilding = outer;
            this.ghostBuilding.visible = false;
            return;
        }

        if (BuildingFactory[type]) {
            const group = BuildingFactory[type]();
            group.traverse(c => {
                if (c instanceof THREE.Mesh) c.material = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.5 });
            });
            const outer = new THREE.Group();
            outer.add(group);
            this.scene.add(outer);
            this.ghostBuilding = outer;
            this.ghostBuilding.visible = false;
        }
    }

    public setPinnedGhost(index: number | null) {
        this.pinnedGhostIndex = index;
        if (index !== null && this.ghostBuilding) {
            const offset = (this.gridSize - 1) / 2;
            let dx = 0, dz = 0;
            if (this.currentGhostType) {
                const def = BUILDINGS[this.currentGhostType];
                dx = ((def?.width || 1) - 1) / 2;
                dz = ((def?.depth || 1) - 1) / 2;
            }
            this.ghostBuilding.position.set((index % this.gridSize) - offset + dx, this.tileHeightMap.get(index) || 0, Math.floor(index / this.gridSize) - offset + dz);
            this.ghostBuilding.visible = true;
            this.ghostBuilding.updateMatrix();
        } else if (this.ghostBuilding) {
            this.ghostBuilding.scale.setScalar(1.0);
            this.ghostBuilding.updateMatrix();
        }
    }

    public updateGhostColor(isValid: boolean) {
        if (this.ghostBuilding) this.ghostBuilding.traverse(c => {
            if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshBasicMaterial) c.material.color.setHex(isValid ? 0x22c55e : 0xe11d48);
        });
    }

    public setGhostPath(indices: number[]) {
        this.ghostCursors.forEach(mesh => this.scene.remove(mesh));
        this.ghostCursors = [];
        const offset = (this.gridSize - 1) / 2;

        indices.forEach(idx => {
            // Memory Leak Fix: Use pre-allocated geometry
            const mesh = new THREE.Mesh(this.pathMarkerGeo, this.pathMarkerMat);
            mesh.position.set((idx % this.gridSize) - offset, (this.tileHeightMap.get(idx) || 0) + 0.08, Math.floor(idx / this.gridSize) - offset);
            this.scene.add(mesh);
            this.ghostCursors.push(mesh);
        });
    }

    public triggerEmit(index: number, type: string) {
        let pos = new THREE.Vector3();
        const mesh = this.buildingMeshes.get(index);
        if (mesh) {
            pos.copy(mesh.position); pos.y += 1.0;
        } else {
            const offset = (this.gridSize - 1) / 2;
            pos.set((index % this.gridSize) - offset, (this.tileHeightMap.get(index) || 0) + 0.1, Math.floor(index / this.gridSize) - offset);
        }
        const mat = this.particleMats[type] || this.particleMats['DUST'], isEco = type === 'ECO_REHAB';
        for (let i = 0; i < (isEco ? 12 : 3); i++) {
            // Note: Reuse particleGeo here, correct.
            const p = new THREE.Mesh(this.particleGeo, mat);
            p.position.copy(pos);
            p.position.x += (Math.random() - 0.5) * 0.5;
            p.position.z += (Math.random() - 0.5) * 0.5;
            this.scene.add(p);
            this.particles.push({ mesh: p, velocity: new THREE.Vector3((Math.random() - 0.5) * (isEco ? 0.02 : 0.05), 0.03 + Math.random() * 0.05, (Math.random() - 0.5) * 0.02), life: isEco ? 1.5 : 1.0, decay: isEco ? 0.015 : 0.02 });
        }
    }

    public setCursorMode(mode: 'BUILD' | 'BULLDOZE' | 'INSPECT') {
        (this.selectionCursor.material as THREE.MeshBasicMaterial).color.setHex(mode === 'BULLDOZE' ? COLORS.HIGHLIGHT_INVALID : COLORS.HIGHLIGHT_VALID);
    }

    public getParticleCount() {
        return this.particles.length;
    }

    public animate(time: number, zoomLevel: number) {
        // LOD Thresholds (Tightened for performance)
        const LOD_NO_PARTICLES = 60;  // Was 100
        const LOD_NO_ANIMATION = 50;  // Was 80

        // Forward LOD to TerrainManager to cull detail meshes
        this.terrainManager.setLOD(zoomLevel);

        // Particles Logic
        if (zoomLevel > LOD_NO_PARTICLES) {
            // Hide all particles immediately to save draw calls
            if (this.particles.length > 0 && this.particles[0].mesh.visible) {
                this.particles.forEach(p => p.mesh.visible = false);
            }
        } else {
            // Update and render particles
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.mesh.visible = true;
                p.mesh.position.add(p.velocity);
                p.life -= p.decay;

                const mat = p.mesh.material as any;
                if ('opacity' in mat) mat.opacity = Math.max(0, p.life);

                p.mesh.scale.multiplyScalar(0.95);

                if (p.life <= 0) {
                    this.scene.remove(p.mesh);
                    this.particles.splice(i, 1);
                }
            }
        }

        // Buildings Logic
        this.animatedElements.forEach((anims, tileId) => anims.forEach(anim => {
            // Priority animations (Gameplay related) always run
            if (anim.type === 'NUGGET_POP' && anim.velocity! > 0) {
                anim.mesh.position.y += anim.velocity!;
                anim.velocity! -= 0.008;
                if (anim.mesh.position.y <= anim.groundY!) {
                    anim.mesh.position.y = anim.groundY!;
                    anim.velocity = 0;
                }
                anim.mesh.updateMatrix();
                return;
            }

            // LOD Check for cosmetic animations
            if (zoomLevel > LOD_NO_ANIMATION) return;

            if (anim.type === 'ROTOR') {
                anim.mesh.rotation.z -= 0.15;
                anim.mesh.updateMatrix();
            }
            else if (anim.type === 'SOLAR') {
                anim.mesh.rotation.x = (anim.baseRotX || 0) + Math.sin(time * 0.5) * 0.1;
                anim.mesh.updateMatrix();
            }
            else if (anim.type === 'SMOKE_EMITTER' && (!anim.lastEmit || time - anim.lastEmit > 0.4)) {
                if (Math.random() > 0.2) this.triggerEmit(tileId, 'SMOKE');
                anim.lastEmit = time;
            }
        }));

        // Ghost Pulse (keep active as it's UI)
        if (this.pinnedGhostIndex !== null && this.ghostBuilding) {
            this.ghostBuilding.scale.setScalar(1.0 + Math.sin(time * 8.0) * 0.05);
            this.ghostBuilding.updateMatrix();
        }

        // Water Shader
        waterFlowMaterial.uniforms.time.value = time;
    }

    public getInteractables(): THREE.Object3D[] {
        return [
            ...this.terrainManager.getInteractables(),
            ...Array.from(this.buildingMeshes.values())
        ];
    }
}
