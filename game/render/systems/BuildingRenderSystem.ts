/**
 * Building Render System
 * Handles rendering of buildings, construction sites, logistics overlays, and associated animations.
 */

import * as THREE from 'three';
import {
    BuildingType,
    Chunk,
    FactoryNodeState,
    FactoryPacketTransportMode,
    FactorySectorState,
    FactoryState,
    GridTile,
    LogisticsOverlayMode,
} from '../../../types';
import { BuildingFactory } from '../../../engine/render/utils/VoxelGenerators';
import { BUILDINGS } from '../../../engine/data/VoxelConstants';
import { ChunkStore } from '../../../engine/space/ChunkStore';
import { SmoothDetailLevel } from '../../../engine/render';

interface AnimationDef {
    mesh: THREE.Object3D;
    type: 'ROTOR' | 'SOLAR' | 'SMOKE_EMITTER' | 'NUGGET_POP' | 'CONVEYOR';
    lastEmit?: number;
    baseRotX?: number;
    velocity?: number;
    groundY?: number;
    axis?: 'x' | 'z' | 'orbit';
    range?: number;
    phase?: number;
    baseY?: number;
    orbitRadius?: number;
}

interface Particle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    decay: number;
}

export class BuildingRenderSystem {
    private scene: THREE.Scene;
    private currentDetailLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    private currentViewMode: 'SURFACE' | 'FIRST_PERSON' = 'SURFACE';

    private buildingMeshes: Map<number, THREE.Object3D> = new Map();
    private animatedElements: Map<number, AnimationDef[]> = new Map();
    private particles: Particle[] = [];

    private selectionCursor: THREE.Mesh;
    private ghostBuilding: THREE.Group | null = null;
    private ghostType: BuildingType | null = null;
    private pinnedGhostPos: { x: number, z: number } | null = null;

    private packetGroup = new THREE.Group();
    private overlayGroup = new THREE.Group();

    private particleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    private packetGeo = new THREE.SphereGeometry(0.09, 10, 10);
    private railPacketGeo = new THREE.BoxGeometry(0.22, 0.12, 0.14);
    private dronePacketGeo = new THREE.OctahedronGeometry(0.13, 0);
    private overlayPlateGeo = new THREE.BoxGeometry(0.84, 0.035, 0.84);
    private beaconGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.72, 8);
    private ringGeo = new THREE.TorusGeometry(0.28, 0.035, 8, 20);
    private junctionArrowGeo = new THREE.BoxGeometry(0.12, 0.08, 0.3);
    private dronePadGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.025, 14);
    private railTrailGeo = new THREE.BoxGeometry(0.32, 0.04, 0.12);
    private sectorLabelCache: Map<string, THREE.SpriteMaterial> = new Map();

    private particleMats: Record<string, THREE.MeshBasicMaterial> = {
        MINERAL: new THREE.MeshBasicMaterial({ color: 0xcbd5e1 }),
        ECO: new THREE.MeshBasicMaterial({ color: 0x10b981 }),
        TRUST: new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
        CASH: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
        SMOKE: new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.5 }),
        DIRT: new THREE.MeshBasicMaterial({ color: 0x78350f }),
        ROCK: new THREE.MeshBasicMaterial({ color: 0x475569 }),
    };

    private packetMats: Record<string, THREE.MeshBasicMaterial> = {
        ORE: new THREE.MeshBasicMaterial({ color: 0xd1d5db }),
        CONCENTRATE: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
        MINERALS: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
        WOOD: new THREE.MeshBasicMaterial({ color: 0xb45309 }),
        STONE: new THREE.MeshBasicMaterial({ color: 0x94a3b8 }),
        GEMS: new THREE.MeshBasicMaterial({ color: 0xc084fc }),
        REFINED_MATERIALS: new THREE.MeshBasicMaterial({ color: 0x7dd3fc }),
        ALLOYS: new THREE.MeshBasicMaterial({ color: 0xddd6fe }),
        MACHINE_PARTS: new THREE.MeshBasicMaterial({ color: 0xfb923c }),
        AUTOMATION_KITS: new THREE.MeshBasicMaterial({ color: 0x2dd4bf }),
    };

    private overlayMats = {
        flow: new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.32 }),
        congestionWarm: new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.38 }),
        congestionHot: new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.45 }),
        junction: new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.4 }),
        beacon: new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.7 }),
        rail: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.42 }),
        drone: new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.48 }),
        droneWarm: new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.55 }),
        sectorBonus: new THREE.MeshBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 0.38 }),
        sectorStrain: new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.42 }),
    };

    private tileCache: Map<number, { type: string; progress: number; state: string }> = new Map();
    private templateCache: Map<string, THREE.Group> = new Map();

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        this.selectionCursor = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 0.05, 1.0),
            new THREE.MeshBasicMaterial({ color: 0x22c55e, opacity: 0.5, transparent: true, depthWrite: false })
        );
        this.selectionCursor.visible = false;
        this.scene.add(this.selectionCursor);

        this.packetGroup.renderOrder = 9;
        this.overlayGroup.renderOrder = 8;
        this.scene.add(this.overlayGroup);
        this.scene.add(this.packetGroup);
    }

    public update(
        dt: number,
        time: number,
        chunks: Record<string, Chunk>,
        factory?: FactoryState,
        overlayMode: LogisticsOverlayMode = 'OFF',
        dirtyKeys?: Set<string>,
        viewMode: 'SURFACE' | 'FIRST_PERSON' = 'SURFACE',
        zoomLevel: number = 65,
        runtimeDetailCap: SmoothDetailLevel = 'HIGH'
    ) {
        this.currentViewMode = viewMode;
        const nextDetailLevel = this.getDetailLevel(viewMode, zoomLevel, runtimeDetailCap);
        const detailLevelChanged = nextDetailLevel !== this.currentDetailLevel;
        this.currentDetailLevel = nextDetailLevel;

        if (detailLevelChanged) {
            Object.values(chunks).forEach((chunk) => {
                chunk.meshDirty = true;
            });
        }

        if ((dirtyKeys && dirtyKeys.has('chunks')) || detailLevelChanged) {
            Object.values(chunks).forEach((chunk) => {
                if (!chunk.meshDirty && !chunk.simDirty) return;

                chunk.tiles.forEach((tile) => {
                    if (!tile.buildingType || tile.buildingType === BuildingType.EMPTY) {
                        if (tile.foliage !== 'ILLEGAL_CAMP') {
                            if (this.buildingMeshes.has(tile.id)) {
                                this.removeTile(tile.id);
                            }
                            return;
                        }
                    }

                    const cached = this.tileCache.get(tile.id);
                    const currentProgress = 1 - ((tile.constructionTimeLeft || 0) / (BUILDINGS[tile.buildingType]?.buildTime || 1));
                    const stateHash = this.getTileVisualStateHash(tile, currentProgress, viewMode, chunks);

                    if (!cached || cached.type !== tile.buildingType || Math.abs(cached.progress - currentProgress) > 0.05 || cached.state !== stateHash) {
                        this.updateTile(tile, currentProgress, chunks, stateHash);
                        this.tileCache.set(tile.id, {
                            type: tile.buildingType,
                            progress: currentProgress,
                            state: stateHash,
                        });
                    }
                });

                chunk.meshDirty = false;
                chunk.simDirty = false;
            });
        }

        this.animate(dt, time);
        this.updateLogisticsVisuals(chunks, factory, overlayMode, time);
    }

    private removeTile(tileId: number) {
        if (this.buildingMeshes.has(tileId)) {
            const mesh = this.buildingMeshes.get(tileId)!;
            this.scene.remove(mesh);
            this.buildingMeshes.delete(tileId);
            this.animatedElements.delete(tileId);
            this.tileCache.delete(tileId);
        }
    }

    private getInfrastructureConnections(tile: GridTile, chunks: Record<string, Chunk>): {
        north: boolean;
        south: boolean;
        east: boolean;
        west: boolean;
        northDelta: number;
        southDelta: number;
        eastDelta: number;
        westDelta: number;
    } {
        const targetType = tile.buildingType;
        const north = ChunkStore.getTile(chunks, tile.x, tile.z - 1);
        const south = ChunkStore.getTile(chunks, tile.x, tile.z + 1);
        const east = ChunkStore.getTile(chunks, tile.x + 1, tile.z);
        const west = ChunkStore.getTile(chunks, tile.x - 1, tile.z);

        const getDelta = (neighbor: GridTile | null | undefined) => {
            if (!neighbor || neighbor.buildingType !== targetType) return 0;
            return (neighbor.terrainHeight - tile.terrainHeight) * 0.5;
        };

        return {
            north: north?.buildingType === targetType,
            south: south?.buildingType === targetType,
            east: east?.buildingType === targetType,
            west: west?.buildingType === targetType,
            northDelta: getDelta(north),
            southDelta: getDelta(south),
            eastDelta: getDelta(east),
            westDelta: getDelta(west),
        };
    }

    private getTileVisualStateHash(tile: GridTile, progress: number, viewMode: 'SURFACE' | 'FIRST_PERSON', chunks: Record<string, Chunk>): string {
        let connectionHash = '';
        if ([BuildingType.ROAD, BuildingType.PIPE, BuildingType.FENCE, BuildingType.POWER_LINE, BuildingType.RAIL_LINE, BuildingType.DISTRIBUTION_HUB].includes(tile.buildingType)) {
            const conn = this.getInfrastructureConnections(tile, chunks);
            connectionHash = `_${conn.north}_${conn.south}_${conn.east}_${conn.west}_${conn.northDelta}_${conn.southDelta}_${conn.eastDelta}_${conn.westDelta}`;
        }

        const progressBucket = tile.isUnderConstruction ? Math.round(progress * 20) / 20 : 1;

        return [
            tile.buildingType,
            tile.level || 1,
            tile.isUnderConstruction ? 1 : 0,
            progressBucket.toFixed(2),
            tile.integrity,
            tile.waterStatus,
            tile.powerStatus,
            connectionHash,
            `seed:${Math.abs(tile.x * 11 + tile.z * 17 + tile.id * 31)}`,
            `VM:${viewMode}`,
            `DL:${this.currentDetailLevel}`,
        ].join('_');
    }

    private updateTile(tile: GridTile, progress: number, chunks: Record<string, Chunk>, templateKey: string) {
        if (this.buildingMeshes.has(tile.id)) {
            const mesh = this.buildingMeshes.get(tile.id)!;
            this.scene.remove(mesh);
            this.buildingMeshes.delete(tile.id);
            this.animatedElements.delete(tile.id);
        }

        if (tile.buildingType === BuildingType.EMPTY && tile.foliage !== 'ILLEGAL_CAMP') return;
        if (tile.buildingType === BuildingType.POND) return;

        if (tile.structureHeadX !== undefined && (tile.x !== tile.structureHeadX || tile.z !== tile.structureHeadZ) &&
            ![BuildingType.ROAD, BuildingType.PIPE, BuildingType.FENCE, BuildingType.POWER_LINE, BuildingType.RAIL_LINE].includes(tile.buildingType)) {
            return;
        }

        let type: BuildingType | 'ILLEGAL_CAMP' = tile.buildingType;
        if (type === BuildingType.EMPTY && tile.foliage === 'ILLEGAL_CAMP') type = 'ILLEGAL_CAMP';
        if (!(type in BuildingFactory)) return;

        const def = BUILDINGS[tile.buildingType];
        const w = def?.width || 1;
        const d = def?.depth || 1;
        const dx = (w - 1) / 2;
        const dz = (d - 1) / 2;
        const root = this.getTemplateClone(type, tile, progress, chunks, templateKey);
        root.position.set(tile.x + dx, tile.terrainHeight * 0.5, tile.z + dz);

        const anims: AnimationDef[] = [];
        root.traverse((c: any) => {
            if (c.userData.isRotor) anims.push({ mesh: c, type: 'ROTOR' });
            if (c.userData.isSolarPanel) anims.push({ mesh: c, type: 'SOLAR', baseRotX: c.rotation.x });
            if (c.userData.isNugget) anims.push({ mesh: c, type: 'NUGGET_POP', velocity: c.userData.velocity, groundY: c.userData.groundY });
            if (c.userData.isConveyorPulse) {
                anims.push({
                    mesh: c,
                    type: 'CONVEYOR',
                    axis: c.userData.axis,
                    range: c.userData.range,
                    phase: c.userData.phase,
                    baseY: c.userData.baseY,
                    orbitRadius: c.userData.orbitRadius,
                });
            }
        });

        if (['WASH_PLANT', 'RECYCLING_PLANT', 'ILLEGAL_CAMP'].includes(type)) {
            anims.push({ mesh: root, type: 'SMOKE_EMITTER', lastEmit: Math.random() });
        }

        if (anims.length > 0) this.animatedElements.set(tile.id, anims);

        this.scene.add(root);
        this.buildingMeshes.set(tile.id, root);
    }

    private getTemplateClone(
        type: BuildingType | 'ILLEGAL_CAMP',
        tile: GridTile,
        progress: number,
        chunks: Record<string, Chunk>,
        templateKey: string
    ): THREE.Group {
        let template = this.templateCache.get(templateKey);
        if (!template) {
            template = this.buildTemplate(type, tile, progress, chunks);
            this.templateCache.set(templateKey, template);
        }

        return template.clone(true);
    }

    private buildTemplate(
        type: BuildingType | 'ILLEGAL_CAMP',
        tile: GridTile,
        progress: number,
        chunks: Record<string, Chunk>
    ): THREE.Group {
        const root = new THREE.Group();
        if (tile.buildingType === BuildingType.EMPTY) {
            return root;
        }

        const def = BUILDINGS[tile.buildingType];
        const w = def?.width || 1;
        const d = def?.depth || 1;
        const seed = Math.abs(tile.x * 11 + tile.z * 17 + tile.id * 31);
        const config: any = {
            isUnderConstruction: tile.isUnderConstruction,
            progress,
            integrity: tile.integrity,
            waterStatus: tile.waterStatus,
            powerStatus: tile.powerStatus,
            level: tile.level || 1,
            detailLevel: this.currentDetailLevel,
            seed,
        };

        let connections = undefined;
        if ([BuildingType.ROAD, BuildingType.PIPE, BuildingType.FENCE, BuildingType.POWER_LINE, BuildingType.RAIL_LINE].includes(tile.buildingType)) {
            connections = this.getInfrastructureConnections(tile, chunks);
        }

        const buildingGroup = BuildingFactory[type]({ ...config, connections });

        if (tile.buildingType === BuildingType.RAIL_LINE && connections) {
            this.decorateConveyor(buildingGroup, connections, seed);
        }
        if (tile.buildingType === BuildingType.DISTRIBUTION_HUB) {
            this.decorateJunctionHub(buildingGroup);
        }
        if (tile.buildingType === BuildingType.TRAIN_STATION) {
            this.decorateTrainStation(buildingGroup, seed);
        }
        if (tile.buildingType === BuildingType.DRONE_DEPOT) {
            this.decorateDroneDepot(buildingGroup, seed);
        }

        if (tile.isUnderConstruction) {
            const scale = 0.4 + (progress * 0.6);
            buildingGroup.scale.set(scale, scale, scale);
            buildingGroup.position.y -= (1 - progress) * 0.5;

            buildingGroup.traverse((c: any) => {
                if (c.isMesh) {
                    c.material = new THREE.MeshStandardMaterial({
                        color: 0x00ffff,
                        transparent: true,
                        opacity: 0.6,
                        roughness: 0.2,
                        metalness: 0.8,
                        emissive: 0x00ffff,
                        emissiveIntensity: 0.4,
                    });
                }
            });

            if (BuildingFactory['CONSTRUCTION']) {
                root.add(BuildingFactory['CONSTRUCTION']({ width: w, depth: d, progress }));
            }
        }

        root.add(buildingGroup);
        return root;
    }

    private decorateConveyor(
        group: THREE.Group,
        connections: ReturnType<BuildingRenderSystem['getInfrastructureConnections']>,
        seed: number
    ) {
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(0.82, 0.045, 0.82),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.2 })
        );
        base.position.y = 0.04;
        group.add(base);

        const laneMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x164e63, emissiveIntensity: 0.2, roughness: 0.4, metalness: 0.7 });
        const pulseMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.95 });

        const hasX = connections.east || connections.west;
        const hasZ = connections.north || connections.south;
        const straightX = hasX && !hasZ;
        const straightZ = hasZ && !hasX;

        const lane = new THREE.Mesh(
            new THREE.BoxGeometry(straightX ? 0.82 : 0.3, 0.06, straightZ ? 0.82 : 0.3),
            laneMat
        );
        lane.position.y = 0.09;
        group.add(lane);

        if (!straightX && !straightZ) {
            const crossX = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.055, 0.24), laneMat);
            crossX.position.y = 0.095;
            const crossZ = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.82), laneMat);
            crossZ.position.y = 0.095;
            group.add(crossX, crossZ);
        }

        for (let i = 0; i < 3; i++) {
            const pulse = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.11), pulseMat.clone());
            pulse.position.y = 0.16;
            pulse.userData.isConveyorPulse = true;
            pulse.userData.phase = (i / 3) + ((seed % 13) * 0.01);
            pulse.userData.baseY = 0.16;
            if (straightX) {
                pulse.userData.axis = 'x';
                pulse.userData.range = 0.5;
                pulse.position.z = 0;
            } else if (straightZ) {
                pulse.userData.axis = 'z';
                pulse.userData.range = 0.5;
                pulse.position.x = 0;
            } else {
                pulse.userData.axis = 'orbit';
                pulse.userData.orbitRadius = 0.22;
            }
            group.add(pulse);
        }
    }

    private decorateJunctionHub(group: THREE.Group) {
        const platform = new THREE.Mesh(
            new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16),
            new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35, emissive: 0x0f172a, emissiveIntensity: 0.3 })
        );
        platform.position.y = 0.14;
        group.add(platform);

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.32, 0.045, 8, 24),
            new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.6 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.22;
        group.add(ring);

        const arrowOffsets: Array<[number, number, number]> = [
            [0, 0, -0.28],
            [0, 0, 0.28],
            [0.28, 0, 0],
            [-0.28, 0, 0],
        ];
        arrowOffsets.forEach(([x, _y, z], index) => {
            const arrow = new THREE.Mesh(this.junctionArrowGeo, new THREE.MeshBasicMaterial({ color: 0xe9d5ff, transparent: true, opacity: 0.8 }));
            arrow.position.set(x, 0.2, z);
            if (index >= 2) {
                arrow.rotation.y = Math.PI / 2;
            }
            group.add(arrow);
        });
    }

    private decorateTrainStation(group: THREE.Group, seed: number) {
        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(1.35, 0.12, 1.35),
            new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.65, emissive: 0x082f49, emissiveIntensity: 0.35 })
        );
        platform.position.y = 0.1;
        group.add(platform);

        const hubRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.44, 0.05, 10, 28),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 })
        );
        hubRing.rotation.x = Math.PI / 2;
        hubRing.position.y = 0.28;
        group.add(hubRing);

        const padOffsets: Array<[number, number]> = [
            [0.48, 0.48],
            [-0.48, 0.48],
            [0.48, -0.48],
            [-0.48, -0.48],
        ];
        padOffsets.forEach(([x, z], index) => {
            const pad = new THREE.Mesh(
                this.dronePadGeo,
                new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x2dd4bf, emissiveIntensity: 0.25, roughness: 0.5, metalness: 0.6 })
            );
            pad.position.set(x, 0.17, z);
            group.add(pad);

            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.07, 8, 8),
                new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? 0x2dd4bf : 0x38bdf8, transparent: true, opacity: 0.95 })
            );
            orb.position.y = 0.34;
            orb.userData.isConveyorPulse = true;
            orb.userData.axis = 'orbit';
            orb.userData.orbitRadius = 0.18 + (index * 0.02);
            orb.userData.phase = (index / 4) + ((seed % 17) * 0.01);
            orb.userData.baseY = 0.34;
            group.add(orb);
        });

        const towerOffsets: Array<[number, number]> = [
            [0.62, 0],
            [-0.62, 0],
        ];
        towerOffsets.forEach(([x, z]) => {
            const tower = new THREE.Mesh(this.beaconGeo, new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.7 }));
            tower.position.set(x, 0.45, z);
            group.add(tower);
        });
    }

    private decorateDroneDepot(group: THREE.Group, seed: number) {
        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.12, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.45, metalness: 0.7, emissive: 0x052e2b, emissiveIntensity: 0.28 })
        );
        platform.position.y = 0.1;
        group.add(platform);

        const deck = new THREE.Mesh(
            new THREE.BoxGeometry(1.15, 0.05, 0.78),
            new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.75, emissive: 0x0f766e, emissiveIntensity: 0.22 })
        );
        deck.position.y = 0.19;
        group.add(deck);

        const controlSpire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.11, 0.82, 10),
            new THREE.MeshStandardMaterial({ color: 0x99f6e4, roughness: 0.25, metalness: 0.8, emissive: 0x2dd4bf, emissiveIntensity: 0.35 })
        );
        controlSpire.position.set(0, 0.55, -0.18);
        group.add(controlSpire);

        const spireCap = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.14, 0),
            new THREE.MeshBasicMaterial({ color: 0x99f6e4, transparent: true, opacity: 0.9 })
        );
        spireCap.position.set(0, 0.98, -0.18);
        group.add(spireCap);

        const launchRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.52, 0.06, 10, 32),
            new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.72 })
        );
        launchRing.rotation.x = Math.PI / 2;
        launchRing.position.y = 0.24;
        group.add(launchRing);

        const padOffsets: Array<[number, number]> = [
            [0.56, 0.32],
            [-0.56, 0.32],
            [0.56, -0.28],
            [-0.56, -0.28],
            [0.24, 0.02],
            [-0.24, 0.02],
        ];
        padOffsets.forEach(([x, z], index) => {
            const pad = new THREE.Mesh(
                this.dronePadGeo,
                new THREE.MeshStandardMaterial({ color: 0x111827, emissive: index % 2 === 0 ? 0x2dd4bf : 0x5eead4, emissiveIntensity: 0.3, roughness: 0.45, metalness: 0.7 })
            );
            pad.scale.set(index < 4 ? 1 : 0.85, 1, index < 4 ? 1 : 0.85);
            pad.position.set(x, 0.18, z);
            group.add(pad);
        });

        const antennaOffsets: Array<[number, number]> = [
            [0.72, 0],
            [-0.72, 0],
        ];
        antennaOffsets.forEach(([x, z], index) => {
            const antenna = new THREE.Mesh(
                this.beaconGeo,
                new THREE.MeshBasicMaterial({ color: index === 0 ? 0x2dd4bf : 0x5eead4, transparent: true, opacity: 0.78 })
            );
            antenna.scale.set(1.1, 1.25, 1.1);
            antenna.position.set(x, 0.52, z);
            group.add(antenna);
        });

        for (let i = 0; i < 5; i++) {
            const orb = new THREE.Mesh(
                i % 2 === 0 ? this.dronePacketGeo : new THREE.SphereGeometry(0.06, 8, 8),
                new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x2dd4bf : 0x99f6e4, transparent: true, opacity: 0.95 })
            );
            orb.position.y = 0.42;
            orb.userData.isConveyorPulse = true;
            orb.userData.axis = 'orbit';
            orb.userData.orbitRadius = 0.24 + (i * 0.035);
            orb.userData.phase = (i / 5) + ((seed % 19) * 0.01);
            orb.userData.baseY = 0.42 + ((i % 2) * 0.05);
            group.add(orb);
        }
    }

    private getDetailLevel(viewMode: 'SURFACE' | 'FIRST_PERSON', zoomLevel: number, runtimeDetailCap: SmoothDetailLevel): 'LOW' | 'MEDIUM' | 'HIGH' {
        let zoomDetail: SmoothDetailLevel;
        if (viewMode === 'FIRST_PERSON') {
            zoomDetail = 'HIGH';
        } else if (zoomLevel <= 30) {
            zoomDetail = 'HIGH';
        } else if (zoomLevel <= 55) {
            zoomDetail = 'MEDIUM';
        } else {
            zoomDetail = 'LOW';
        }

        const rank: Record<SmoothDetailLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
        return rank[zoomDetail] <= rank[runtimeDetailCap] ? zoomDetail : runtimeDetailCap;
    }

    private animate(dt: number, time: number) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.mesh.position.add(p.velocity);
            p.life -= p.decay;
            (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life);
            p.mesh.scale.multiplyScalar(0.95);
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            }
        }

        this.animatedElements.forEach((anims, tileId) => anims.forEach((anim) => {
            if (anim.type === 'ROTOR') {
                anim.mesh.rotation.z -= 0.15 * (dt * 60);
                anim.mesh.updateMatrix();
            } else if (anim.type === 'SMOKE_EMITTER' && (!anim.lastEmit || time - anim.lastEmit > 0.4)) {
                if (Math.random() > 0.2) this.emitParticle(tileId, 'SMOKE');
                anim.lastEmit = time;
            } else if (anim.type === 'CONVEYOR') {
                const pulse = ((time * 1.8) + (anim.phase || 0)) % 1;
                const travel = (pulse - 0.5) * (anim.range || 0.45) * 2;
                if (anim.axis === 'x') {
                    anim.mesh.position.x = travel;
                    anim.mesh.position.y = anim.baseY || 0.16;
                } else if (anim.axis === 'z') {
                    anim.mesh.position.z = travel;
                    anim.mesh.position.y = anim.baseY || 0.16;
                } else {
                    const angle = (pulse * Math.PI * 2);
                    const radius = anim.orbitRadius || 0.22;
                    anim.mesh.position.x = Math.cos(angle) * radius;
                    anim.mesh.position.z = Math.sin(angle) * radius;
                    anim.mesh.position.y = anim.baseY || 0.16;
                }
            }
        }));
    }

    private updateLogisticsVisuals(chunks: Record<string, Chunk>, factory: FactoryState | undefined, overlayMode: LogisticsOverlayMode, time: number) {
        this.clearGroup(this.packetGroup);
        this.clearGroup(this.overlayGroup);

        if (!factory) return;

        const sectorProfiles = new Map((factory.sectors || []).map((sector) => [sector.name, sector]));
        const activeRailNodes = new Set<string>();
        const activeDroneStations = new Set<string>();
        const activeRegionalSectors = new Set<string>();
        const stationDroneLoad = new Map<string, number>();
        const routeLoadBySector = new Map<string, number>();

        for (const packet of factory.packets) {
            const fromNode = factory.nodes[packet.fromKey];
            const toNode = factory.nodes[packet.toKey];
            if (!fromNode || !toNode) continue;

            const mode = (packet.transportMode || 'BELT') as FactoryPacketTransportMode;
            const fromPos = this.getNodeWorldPosition(fromNode, chunks);
            const toPos = this.getNodeWorldPosition(toNode, chunks);
            const packetMesh = new THREE.Mesh(
                mode === 'RAIL' ? this.railPacketGeo : mode === 'DRONE' ? this.dronePacketGeo : this.packetGeo,
                (this.packetMats[packet.resource] || this.packetMats.ORE).clone()
            );
            const pos = fromPos.clone().lerp(toPos, Math.min(1, Math.max(0, packet.progress)));

            if (mode === 'DRONE') {
                pos.y += 0.72 + Math.sin(packet.progress * Math.PI) * 0.28;
                const halo = new THREE.Mesh(this.ringGeo, this.overlayMats.drone.clone());
                halo.rotation.x = Math.PI / 2;
                halo.scale.setScalar(0.45);
                halo.position.set(pos.x, pos.y - 0.1, pos.z);
                this.packetGroup.add(halo);
                packetMesh.rotation.y = time * 2.2;
                if (this.isDroneHubNode(fromNode)) {
                    activeDroneStations.add(fromNode.key);
                    stationDroneLoad.set(fromNode.key, (stationDroneLoad.get(fromNode.key) || 0) + 1);
                }
                if (this.isDroneHubNode(toNode)) {
                    activeDroneStations.add(toNode.key);
                    stationDroneLoad.set(toNode.key, (stationDroneLoad.get(toNode.key) || 0) + 1);
                }
            } else if (mode === 'RAIL') {
                const routeColor = packet.sectorFrom ? this.getSectorColor(packet.sectorFrom) : 0x38bdf8;
                (packetMesh.material as THREE.MeshBasicMaterial).color.setHex(routeColor);
                pos.y += 0.19;
                const trail = new THREE.Mesh(this.railTrailGeo, new THREE.MeshBasicMaterial({ color: routeColor, transparent: true, opacity: 0.46 }));
                trail.position.set(pos.x, pos.y - 0.06, pos.z);
                if (Math.abs(toPos.x - fromPos.x) > Math.abs(toPos.z - fromPos.z)) {
                    trail.rotation.y = 0;
                } else {
                    trail.rotation.y = Math.PI / 2;
                }
                this.packetGroup.add(trail);
                if (packet.sectorFrom && packet.sectorTo && packet.sectorFrom !== packet.sectorTo) {
                    activeRegionalSectors.add(packet.sectorFrom);
                    activeRegionalSectors.add(packet.sectorTo);
                    routeLoadBySector.set(packet.sectorFrom, (routeLoadBySector.get(packet.sectorFrom) || 0) + packet.amount);
                    routeLoadBySector.set(packet.sectorTo, (routeLoadBySector.get(packet.sectorTo) || 0) + packet.amount);
                    const bulkRing = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: routeColor, transparent: true, opacity: 0.55 }));
                    bulkRing.rotation.x = Math.PI / 2;
                    bulkRing.scale.setScalar(0.62 + Math.min(0.42, packet.amount * 0.04));
                    bulkRing.position.set(pos.x, pos.y + 0.04, pos.z);
                    this.packetGroup.add(bulkRing);

                    if (overlayMode === 'FLOW') {
                        const heatTrail = new THREE.Mesh(
                            new THREE.BoxGeometry(0.56, 0.06, 0.22),
                            new THREE.MeshBasicMaterial({ color: routeColor, transparent: true, opacity: 0.18 + Math.min(0.32, packet.amount * 0.025) })
                        );
                        heatTrail.position.set(pos.x, pos.y - 0.02, pos.z);
                        if (Math.abs(toPos.x - fromPos.x) <= Math.abs(toPos.z - fromPos.z)) {
                            heatTrail.rotation.y = Math.PI / 2;
                        }
                        this.packetGroup.add(heatTrail);
                    }

                    if (overlayMode === 'CONGESTION') {
                        const fromSector = sectorProfiles.get(packet.sectorFrom);
                        const toSector = sectorProfiles.get(packet.sectorTo);
                        const pressure = Math.max(this.getSectorPressure(fromSector), this.getSectorPressure(toSector));
                        if (pressure > 0.52) {
                            const hotTrail = new THREE.Mesh(
                                new THREE.BoxGeometry(0.54, 0.05, 0.2),
                                new THREE.MeshBasicMaterial({ color: this.getSectorPressureColor(pressure), transparent: true, opacity: 0.2 + pressure * 0.24 })
                            );
                            hotTrail.position.set(pos.x, pos.y + 0.02, pos.z);
                            if (Math.abs(toPos.x - fromPos.x) <= Math.abs(toPos.z - fromPos.z)) {
                                hotTrail.rotation.y = Math.PI / 2;
                            }
                            this.packetGroup.add(hotTrail);
                        }
                    }

                    const routeBadge = new THREE.Sprite(this.getSectorLabelMaterial(
                        `${this.getSectorCode(packet.sectorFrom)}-${this.getSectorCode(packet.sectorTo)}`,
                        routeColor
                    ));
                    routeBadge.scale.set(1.18, 0.34, 1);
                    routeBadge.position.set(pos.x, pos.y + 0.34, pos.z);
                    this.packetGroup.add(routeBadge);
                }
                if (fromNode.buildingType === BuildingType.TRAIN_STATION || fromNode.buildingType === BuildingType.RAIL_LINE) activeRailNodes.add(fromNode.key);
                if (toNode.buildingType === BuildingType.TRAIN_STATION || toNode.buildingType === BuildingType.RAIL_LINE) activeRailNodes.add(toNode.key);
            } else {
                pos.y += 0.28;
            }

            packetMesh.position.copy(pos);
            packetMesh.scale.setScalar(mode === 'DRONE' ? 1.1 : mode === 'RAIL' && packet.sectorFrom && packet.sectorTo && packet.sectorFrom !== packet.sectorTo ? 1.2 : 0.85 + Math.min(0.5, packet.amount * 0.06));
            this.packetGroup.add(packetMesh);
        }

        Object.values(factory.nodes).forEach((node) => {
            const pos = this.getNodeWorldPosition(node, chunks);
            const sector = node.sectorName ? sectorProfiles.get(node.sectorName) : undefined;

            if (node.buildingType === BuildingType.TRAIN_STATION && node.sectorName) {
                const sectorColor = this.getSectorColor(node.sectorName);
                const label = new THREE.Sprite(this.getSectorLabelMaterial(node.sectorName, sectorColor));
                label.scale.set(2.5, 0.62, 1);
                label.position.set(node.x, pos.y + 1.14, node.z);
                this.overlayGroup.add(label);

                const sectorBeacon = new THREE.Mesh(this.beaconGeo, new THREE.MeshBasicMaterial({ color: sectorColor, transparent: true, opacity: 0.55 }));
                sectorBeacon.scale.set(0.9, activeRegionalSectors.has(node.sectorName) ? 1.55 : 1.15, 0.9);
                sectorBeacon.position.set(node.x, pos.y + 0.74, node.z);
                this.overlayGroup.add(sectorBeacon);

                if (sector) {
                    const quotaRing = new THREE.Mesh(
                        this.ringGeo,
                        new THREE.MeshBasicMaterial({
                            color: this.getSectorSatisfactionColor(sector),
                            transparent: true,
                            opacity: 0.26 + ((sector.bonusChain || 0) * 0.05),
                        })
                    );
                    quotaRing.rotation.x = Math.PI / 2;
                    quotaRing.scale.setScalar(0.92 + Math.min(0.4, (sector.bonusChain || 0) * 0.08));
                    quotaRing.position.set(node.x, pos.y + 0.11, node.z);
                    this.overlayGroup.add(quotaRing);
                }
            }

            if ((node.buildingType === BuildingType.TRAIN_STATION || node.buildingType === BuildingType.DRONE_DEPOT) && (this.isRecentlyActive(node, factory.lastNetworkTick) || activeDroneStations.has(node.key) || activeRailNodes.has(node.key))) {
                const sectorColor = node.sectorName ? this.getSectorColor(node.sectorName) : node.buildingType === BuildingType.DRONE_DEPOT ? 0x2dd4bf : 0x38bdf8;
                const railRing = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: sectorColor, transparent: true, opacity: 0.46 }));
                railRing.rotation.x = Math.PI / 2;
                railRing.scale.setScalar(activeRegionalSectors.has(node.sectorName || '') ? 1.42 : node.buildingType === BuildingType.DRONE_DEPOT ? 1.08 : 1.25);
                railRing.position.set(node.x, pos.y + 0.18, node.z);
                this.overlayGroup.add(railRing);

                const beacon = new THREE.Mesh(this.beaconGeo, this.overlayMats.beacon.clone());
                beacon.scale.setScalar(activeDroneStations.has(node.key) ? 1.25 : 1.05);
                beacon.position.set(node.x, pos.y + 0.54, node.z);
                this.overlayGroup.add(beacon);

                if (activeDroneStations.has(node.key)) {
                    const load = stationDroneLoad.get(node.key) || 0;
                    const pressureMat = load >= 3 || (factory.dronePressure || 0) > 0.45
                        ? this.overlayMats.droneWarm.clone()
                        : this.overlayMats.drone.clone();
                    const droneRing = new THREE.Mesh(this.ringGeo, pressureMat);
                    droneRing.rotation.x = Math.PI / 2;
                    droneRing.scale.setScalar(load >= 3 ? 0.92 : node.buildingType === BuildingType.DRONE_DEPOT ? 0.84 : 0.72);
                    droneRing.position.set(node.x, pos.y + 0.28, node.z);
                    this.overlayGroup.add(droneRing);
                }
            }

            if (node.buildingType === BuildingType.RAIL_LINE && activeRailNodes.has(node.key)) {
                const railPlate = new THREE.Mesh(this.overlayPlateGeo, this.overlayMats.rail.clone());
                railPlate.scale.set(0.8, 0.8, 0.55);
                railPlate.position.set(node.x, pos.y + 0.05, node.z);
                this.overlayGroup.add(railPlate);
            }
        });

        if (overlayMode === 'OFF') {
            return;
        }

        Object.values(factory.nodes).forEach((node) => {
            const pos = this.getNodeWorldPosition(node, chunks);
            const sector = node.sectorName ? sectorProfiles.get(node.sectorName) : undefined;

            if (overlayMode === 'FLOW' && this.isRecentlyActive(node, factory.lastNetworkTick)) {
                const plate = new THREE.Mesh(this.overlayPlateGeo, this.overlayMats.flow);
                plate.position.set(node.x, pos.y + 0.03, node.z);
                this.overlayGroup.add(plate);
            }

            if (overlayMode === 'FLOW' && node.buildingType === BuildingType.TRAIN_STATION && sector) {
                const routeLoad = routeLoadBySector.get(sector.name) || 0;
                const flowPlate = new THREE.Mesh(
                    this.overlayPlateGeo,
                    new THREE.MeshBasicMaterial({
                        color: this.getSectorFlowColor(sector),
                        transparent: true,
                        opacity: 0.24 + Math.min(0.18, routeLoad * 0.01),
                    })
                );
                flowPlate.scale.set(1.1 + Math.min(1.2, sector.throughput / 18), 1, 1.1 + Math.min(1.2, routeLoad / 18));
                flowPlate.position.set(node.x, pos.y + 0.04, node.z);
                this.overlayGroup.add(flowPlate);

                if ((sector.bonusChain || 0) > 0) {
                    const streakRing = new THREE.Mesh(this.ringGeo, this.overlayMats.sectorBonus.clone());
                    streakRing.rotation.x = Math.PI / 2;
                    streakRing.scale.setScalar(1.1 + Math.min(0.55, (sector.bonusChain || 0) * 0.1));
                    streakRing.position.set(node.x, pos.y + 0.22, node.z);
                    this.overlayGroup.add(streakRing);
                }
            }

            if (overlayMode === 'CONGESTION') {
                const queued = this.resourceTotal(node.buffer) + this.resourceTotal(node.inputBuffer);
                const droneLoad = stationDroneLoad.get(node.key) || 0;
                if (queued > 0.75 || node.stalledTicks > 0 || droneLoad >= 3) {
                    const hot = queued > 4 || node.stalledTicks > 8 || droneLoad >= 5;
                    const plate = new THREE.Mesh(this.overlayPlateGeo, hot ? this.overlayMats.congestionHot : this.overlayMats.congestionWarm);
                    plate.position.set(node.x, pos.y + 0.03, node.z);
                    this.overlayGroup.add(plate);

                    const beacon = new THREE.Mesh(this.beaconGeo, this.overlayMats.beacon);
                    beacon.position.set(node.x, pos.y + 0.38, node.z);
                    this.overlayGroup.add(beacon);
                }

                if (node.buildingType === BuildingType.TRAIN_STATION && sector) {
                    const pressure = this.getSectorPressure(sector);
                    const sectorPlate = new THREE.Mesh(
                        this.overlayPlateGeo,
                        new THREE.MeshBasicMaterial({
                            color: this.getSectorPressureColor(pressure),
                            transparent: true,
                            opacity: 0.2 + pressure * 0.28,
                        })
                    );
                    sectorPlate.scale.set(1.25 + pressure * 1.5, 1, 1.25 + pressure * 1.5);
                    sectorPlate.position.set(node.x, pos.y + 0.045, node.z);
                    this.overlayGroup.add(sectorPlate);

                    const quotaStress = new THREE.Mesh(
                        this.ringGeo,
                        pressure > 0.58 ? this.overlayMats.sectorStrain.clone() : this.overlayMats.congestionWarm.clone()
                    );
                    quotaStress.rotation.x = Math.PI / 2;
                    quotaStress.scale.setScalar(1.02 + pressure * 0.55);
                    quotaStress.position.set(node.x, pos.y + 0.18, node.z);
                    this.overlayGroup.add(quotaStress);

                    if ((sector.missedQuotaTicks || 0) >= 3 || (sector.satisfaction || 1) < 0.35) {
                        const stressBadge = new THREE.Sprite(this.getSectorLabelMaterial(
                            `${this.getSectorCode(sector.name)} ${Math.round(pressure * 100)}%`,
                            this.getSectorPressureColor(pressure)
                        ));
                        stressBadge.scale.set(1.9, 0.42, 1);
                        stressBadge.position.set(node.x, pos.y + 0.88, node.z);
                        this.overlayGroup.add(stressBadge);
                    }
                }
            }

            if (overlayMode === 'JUNCTIONS' && this.isJunctionNode(factory, node)) {
                const ring = new THREE.Mesh(this.ringGeo, this.overlayMats.junction);
                ring.rotation.x = Math.PI / 2;
                ring.position.set(node.x, pos.y + 0.08, node.z);
                this.overlayGroup.add(ring);

                const beacon = new THREE.Mesh(this.beaconGeo, this.overlayMats.beacon);
                beacon.position.set(node.x, pos.y + 0.45, node.z);
                this.overlayGroup.add(beacon);
            }
        });
    }

    private isDroneHubNode(node: FactoryNodeState): boolean {
        return node.buildingType === BuildingType.TRAIN_STATION || node.buildingType === BuildingType.DRONE_DEPOT;
    }

    private getSectorLabelMaterial(text: string, color: number): THREE.SpriteMaterial {
        const key = `${text}:${color.toString(16)}`;
        const cached = this.sectorLabelCache.get(key);
        if (cached) {
            return cached;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            const fallback = new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, depthTest: false });
            this.sectorLabelCache.set(key, fallback);
            return fallback;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(8, 15, 25, 0.82)';
        ctx.fillRect(0, 10, canvas.width, 44);
        ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 12, canvas.width - 4, 40);
        ctx.font = '700 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
        this.sectorLabelCache.set(key, material);
        return material;
    }

    private getSectorColor(label: string): number {
        const palette = [0x38bdf8, 0xf59e0b, 0x2dd4bf, 0xc084fc, 0xf97316, 0xa3e635];
        const hash = Array.from(label).reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return palette[hash % palette.length];
    }

    private getSectorPressure(sector: FactorySectorState | undefined): number {
        if (!sector) return 0;
        return Math.max(
            sector.congestionLevel || 0,
            Math.max(0, 1 - (sector.satisfaction || 1)),
            Math.min(1, (sector.missedQuotaTicks || 0) / 6)
        );
    }

    private getSectorPressureColor(pressure: number): number {
        if (pressure > 0.72) return 0xef4444;
        if (pressure > 0.48) return 0xf97316;
        return 0xf59e0b;
    }

    private getSectorFlowColor(sector: FactorySectorState): number {
        if ((sector.bonusChain || 0) >= 3) return 0x84cc16;
        if ((sector.satisfaction || 1) < 0.42) return 0xf59e0b;
        return 0x22d3ee;
    }

    private getSectorSatisfactionColor(sector: FactorySectorState): number {
        if ((sector.satisfaction || 0) > 0.82) return 0x84cc16;
        if ((sector.satisfaction || 0) < 0.38) return 0xef4444;
        return 0x2dd4bf;
    }

    private getSectorCode(label: string): string {
        return label
            .split(' ')
            .map((part) => part[0] || '')
            .join('')
            .slice(0, 3)
            .toUpperCase();
    }

    private resourceTotal(bucket: Partial<Record<string, number>>) {
        return Object.values(bucket).reduce((sum, value) => sum + (value || 0), 0);
    }

    private isRecentlyActive(node: FactoryNodeState, lastTick: number) {
        return lastTick - node.lastActiveTick <= 90 || this.resourceTotal(node.buffer) > 0 || this.resourceTotal(node.inputBuffer) > 0;
    }

    private isJunctionNode(factory: FactoryState, node: FactoryNodeState): boolean {
        if (node.buildingType === BuildingType.DISTRIBUTION_HUB || node.buildingType === BuildingType.TRAIN_STATION || node.buildingType === BuildingType.DRONE_DEPOT) return true;
        if (node.buildingType !== BuildingType.RAIL_LINE) return false;
        return this.getFactoryNeighbors(factory, node).length > 2;
    }

    private getFactoryNeighbors(factory: FactoryState, node: FactoryNodeState): FactoryNodeState[] {
        const keys = [
            `${node.x + 1},${node.z}`,
            `${node.x - 1},${node.z}`,
            `${node.x},${node.z + 1}`,
            `${node.x},${node.z - 1}`,
        ];
        return keys.map((key) => factory.nodes[key]).filter(Boolean) as FactoryNodeState[];
    }

    private getNodeWorldPosition(node: FactoryNodeState, chunks: Record<string, Chunk>) {
        const tile = ChunkStore.getTile(chunks, node.x, node.z);
        return new THREE.Vector3(node.x, (tile?.terrainHeight || 0) * 0.5, node.z);
    }

    private clearGroup(group: THREE.Group) {
        while (group.children.length > 0) {
            group.remove(group.children[0]);
        }
    }

    private emitParticle(tileId: number, type: string) {
        const mesh = this.buildingMeshes.get(tileId);
        const mat = this.particleMats[type];
        const p = new THREE.Mesh(this.particleGeo, mat);

        if (mesh) {
            p.position.copy(mesh.position);
        } else {
            p.position.set(0, 0, 0);
        }

        p.position.y += 0.5 + Math.random() * 0.5;
        p.position.x += (Math.random() - 0.5) * 0.5;
        p.position.z += (Math.random() - 0.5) * 0.5;

        this.scene.add(p);
        this.particles.push({
            mesh: p,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.05 + Math.random() * 0.08, (Math.random() - 0.5) * 0.1),
            life: 1.0,
            decay: 0.03,
        });
    }

    public triggerEffect(worldX: number, worldZ: number, type: string, offset: number) {
        const tileId = Math.round(worldX) * 1000000 + Math.round(worldZ);
        if (type === 'DUST') {
            for (let i = 0; i < 5; i++) this.emitParticle(tileId, 'DIRT');
        } else if (type === 'MINING') {
            for (let i = 0; i < 8; i++) this.emitParticle(tileId, Math.random() > 0.5 ? 'ROCK' : 'DIRT');
        } else if (type === 'SMOKE') {
            for (let i = 0; i < 3; i++) this.emitParticle(tileId, 'SMOKE');
        } else if (type === 'ECO_REHAB') {
            for (let i = 0; i < 10; i++) this.emitParticle(tileId, 'ECO');
        }
    }

    public setPinnedGhost(pos: { x: number, z: number } | null, y: number = 0) {
        this.pinnedGhostPos = pos;
        if (pos !== null && this.ghostBuilding) {
            const def = BUILDINGS[this.ghostType!];
            const w = def?.width || 1;
            const d = def?.depth || 1;
            const dx = (w - 1) / 2;
            const dz = (d - 1) / 2;
            this.ghostBuilding.position.set(pos.x + dx, y, pos.z + dz);
            this.ghostBuilding.visible = true;
        }
    }

    public setGhostBuilding(type: BuildingType | null) {
        if (this.ghostType === type) return;

        if (this.ghostBuilding) {
            this.scene.remove(this.ghostBuilding);
            this.ghostBuilding = null;
        }

        this.ghostType = type;

        if (type && BuildingFactory[type]) {
            const group = BuildingFactory[type]();
            this.ghostBuilding = new THREE.Group();
            this.ghostBuilding.add(group);

            this.ghostBuilding.traverse((c: any) => {
                if (c.isMesh) {
                    c.material = new THREE.MeshStandardMaterial({
                        color: 0xffffff,
                        transparent: true,
                        opacity: 0.5,
                        emissive: 0x444444,
                    });
                    c.castShadow = false;
                    c.receiveShadow = false;
                }
            });

            this.scene.add(this.ghostBuilding);
        }
    }

    public setCursorMode(mode: 'BUILD' | 'BULLDOZE' | 'INSPECT') {
        const mat = this.selectionCursor.material as THREE.MeshBasicMaterial;
        if (mode === 'BULLDOZE') {
            mat.color.setHex(0xf43f5e);
        } else if (mode === 'INSPECT') {
            mat.color.setHex(0x3b82f6);
        } else {
            mat.color.setHex(0x22c55e);
        }
    }

    public updateCursor(pos: THREE.Vector3 | null, fallbackCenter: THREE.Vector3 | null = null) {
        let ghostPos = null;

        if (this.pinnedGhostPos !== null) {
            if (this.ghostBuilding) this.ghostBuilding.visible = true;
        } else if (pos) {
            ghostPos = pos;
        } else if (fallbackCenter) {
            ghostPos = fallbackCenter;
        }

        if (pos) {
            const cx = Math.floor(pos.x + 0.5);
            const cz = Math.floor(pos.z + 0.5);
            this.selectionCursor.visible = true;
            this.selectionCursor.position.set(cx, pos.y + 0.1, cz);
        } else {
            this.selectionCursor.visible = false;
        }

        if (this.ghostBuilding && this.pinnedGhostPos === null) {
            if (ghostPos) {
                this.ghostBuilding.visible = true;
                const cx = Math.floor(ghostPos.x + 0.5);
                const cz = Math.floor(ghostPos.z + 0.5);
                const def = BUILDINGS[this.ghostType!];
                const w = def?.width || 1;
                const d = def?.depth || 1;
                const dx = (w - 1) / 2;
                const dz = (d - 1) / 2;
                this.ghostBuilding.position.set(cx + dx, ghostPos.y, cz + dz);
            } else {
                this.ghostBuilding.visible = false;
            }
        }
    }
}
