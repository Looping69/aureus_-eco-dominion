import * as THREE from 'three';
import { FrameContext } from '../../engine/kernel';
import { ChunkStore } from '../../engine/space/ChunkStore';
import { DungeonEngine } from '../../engine/dungeon/DungeonEngine';
import { waterFlowMaterial, oilWaterMaterial, reservoirWaterMaterial } from '../../engine/render/materials/VoxelMaterials';
import { BuildingType } from '../../types';
import { BuildingStatusLabelLayer } from '../render/systems/BuildingStatusLabelLayer';

export interface RenderFrameDeps {
    stateManager: any;
    render: any;
    workerPool: any;
    inputSystem: any;
    terrainRenderSystem: any;
    foliageRenderSystem?: any;
    buildingRenderSystem: any;
    wildlifeRenderSystem?: any;
    agentRenderSystem: any;
    environmentRenderSystem: any;
    dungeonRenderSystem: any;
    cameraSystem: any;
    dungeonCameraSystem: any;
    fpsCameraSystem: any;
    dungeonInputHandler: any;
    getTerrainHeight: (worldX: number, worldZ: number) => number;
    onSfx?: (sfx: any) => void;
}

let buildingStatusLabelLayer: BuildingStatusLabelLayer | null = null;
const dungeonBackgroundColor = new THREE.Color(0x000000);
const firstPersonFogColor = new THREE.Color(0x05070b);
const STARTER_FOG_CLEAR_RADIUS = 18;
const STARTER_FOG_FEATHER_RADIUS = 8;
const STARTER_FOG_WORLD_EXTENT = 4096;
const STARTER_FOG_MASK_TEXTURE_SIZE = 2048;
const STARTER_FOG_REVEAL_GRID = 6;
const STARTER_FOG_RENDER_ORDER = 10000;
const AGENT_FOG_REVEAL_RADIUS = 12;
const BUILDING_FOG_REVEAL_RADIUS = 14;
const FIRST_PERSON_MIST_HEIGHT = 2.5;
const FIRST_PERSON_MIST_GROUND_OFFSET = 0.05;
const FIRST_PERSON_MIST_RENDER_ORDER = 9990;
const PIPE_TOOL_SURFACE_OPACITY = 0.28;
const PIPE_TOOL_WATER_OPACITY = 0.18;
const PIPE_TOOL_AGENT_OPACITY = 0.38;
const FIRST_PERSON_MIST_BANDS = [
    { name: 'first-person-fog-mist-1', radius: STARTER_FOG_CLEAR_RADIUS + 1.5, opacity: 0.16 },
    { name: 'first-person-fog-mist-2', radius: STARTER_FOG_CLEAR_RADIUS + 4.5, opacity: 0.3 },
    { name: 'first-person-fog-mist-3', radius: STARTER_FOG_CLEAR_RADIUS + STARTER_FOG_FEATHER_RADIUS, opacity: 0.48 },
] as const;

type HoverCell = { x: number; z: number } | null;
type FogRevealCenter = { key: string; x: number; z: number; radius: number };
type FogExplorationState = { centers: FogRevealCenter[]; version: number };
type MaterialFadeState = { transparent: boolean; opacity: number; depthWrite: boolean };

function finiteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeFogRevealCenter(center: any): FogRevealCenter | null {
    if (typeof center?.key !== 'string') return null;
    const x = finiteNumber(center.x);
    const z = finiteNumber(center.z);
    const radius = finiteNumber(center.radius);
    if (x === null || z === null || radius === null || radius <= 0) return null;
    return { key: center.key, x, z, radius };
}

function ensureFogExplorationState(state: any): FogExplorationState {
    const existing = state.fogExploration;
    const centers = Array.isArray(existing?.centers)
        ? existing.centers.map(normalizeFogRevealCenter).filter((center): center is FogRevealCenter => Boolean(center))
        : [];
    const version = finiteNumber(existing?.version) ?? centers.length;

    if (!existing || !Array.isArray(existing.centers) || centers.length !== existing.centers.length || !Number.isFinite(existing.version)) {
        state.fogExploration = { centers, version };
    }

    return state.fogExploration;
}

function pointFromEntity(entity: any): { x: number; z: number } | null {
    const x = finiteNumber(entity?.x) ?? finiteNumber(entity?.position?.x) ?? finiteNumber(entity?.worldX);
    const z = finiteNumber(entity?.z) ?? finiteNumber(entity?.position?.z) ?? finiteNumber(entity?.worldZ);
    return x === null || z === null ? null : { x, z };
}

function quantizedKey(prefix: string, x: number, z: number): string {
    const qx = Math.round(x / STARTER_FOG_REVEAL_GRID) * STARTER_FOG_REVEAL_GRID;
    const qz = Math.round(z / STARTER_FOG_REVEAL_GRID) * STARTER_FOG_REVEAL_GRID;
    return `${prefix}:${qx},${qz}`;
}

function isCompletedBuildingTile(tile: any): boolean {
    if (!tile || tile.isUnderConstruction) return false;
    return Boolean(
        tile.buildingId
        || tile.buildingType
        || tile.structureId
        || tile.structureType
        || tile.building
        || tile.structure
    );
}

function collectCurrentFogRevealCenters(state: any): FogRevealCenter[] {
    const centers: FogRevealCenter[] = [];
    const spawnX = Math.round(state.spawnX ?? 0);
    const spawnZ = Math.round(state.spawnZ ?? 0);
    centers.push({ key: 'spawn', x: spawnX, z: spawnZ, radius: STARTER_FOG_CLEAR_RADIUS });

    const agents = [...(state.agents ?? []), ...(state.ambientNpcs ?? [])];
    for (const agent of agents) {
        const point = pointFromEntity(agent);
        if (!point) continue;
        centers.push({
            key: quantizedKey('agent', point.x, point.z),
            x: point.x,
            z: point.z,
            radius: AGENT_FOG_REVEAL_RADIUS,
        });
    }

    for (const chunk of Object.values(state.chunks ?? {}) as any[]) {
        for (const tile of chunk?.tiles ?? []) {
            if (!isCompletedBuildingTile(tile)) continue;
            const x = finiteNumber(tile.x) ?? finiteNumber(tile.worldX);
            const z = finiteNumber(tile.z) ?? finiteNumber(tile.worldZ);
            if (x === null || z === null) continue;
            centers.push({
                key: quantizedKey('building', x, z),
                x,
                z,
                radius: BUILDING_FOG_REVEAL_RADIUS,
            });
        }
    }

    return centers;
}

class FogExplorationTracker {
    private centers = new Map<string, FogRevealCenter>();
    private version = 0;
    private hydratedVersion = -1;

    updateFromState(state: any, onChanged?: () => void): void {
        this.hydrateFromState(state);
        let changed = false;

        for (const center of collectCurrentFogRevealCenters(state)) {
            const previous = this.centers.get(center.key);
            if (previous && previous.radius >= center.radius) continue;
            this.centers.set(center.key, center);
            this.version += 1;
            changed = true;
        }

        if (!changed) return;
        this.writeToState(state);
        onChanged?.();
    }

    getCenters(): FogRevealCenter[] {
        return Array.from(this.centers.values());
    }

    getVersion(): number {
        return this.version;
    }

    getNearestCenter(point: THREE.Vector3): FogRevealCenter | null {
        let nearest: FogRevealCenter | null = null;
        let nearestDistanceSq = Infinity;
        for (const center of this.centers.values()) {
            const dx = center.x - point.x;
            const dz = center.z - point.z;
            const distanceSq = (dx * dx) + (dz * dz);
            if (distanceSq >= nearestDistanceSq) continue;
            nearest = center;
            nearestDistanceSq = distanceSq;
        }
        return nearest;
    }

    private hydrateFromState(state: any): void {
        const fogState = ensureFogExplorationState(state);
        if (fogState.version === this.hydratedVersion) return;
        this.centers = new Map(fogState.centers.map((center) => [center.key, center]));
        this.version = fogState.version;
        this.hydratedVersion = fogState.version;
    }

    private writeToState(state: any): void {
        const fogState = ensureFogExplorationState(state);
        fogState.centers = this.getCenters();
        fogState.version = this.version;
        this.hydratedVersion = this.version;
    }
}

const fogExplorationTracker = new FogExplorationTracker();

class LayeredWorldOverlay {
    private group = new THREE.Group();
    private geometry = new THREE.PlaneGeometry(0.86, 0.86).rotateX(-Math.PI / 2);
    private material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexColors: true,
    });
    private mesh: THREE.InstancedMesh | null = null;
    private lastSignature = '';
    private matrix = new THREE.Matrix4();
    private color = new THREE.Color();

    constructor(scene: THREE.Scene) {
        this.group.name = 'layered-world-overlay';
        this.group.renderOrder = 30;
        scene.add(this.group);
    }

    setVisible(visible: boolean): void {
        this.group.visible = visible;
    }

    update(state: any, getTerrainHeight: (worldX: number, worldZ: number) => number, hoverCell: HoverCell): void {
        const layeredWorld = state.layeredWorld;
        const activeY = layeredWorld?.activeY ?? 0;
        const show = state.activeView === 'SURFACE'
            && activeY < (layeredWorld?.surfaceY ?? 0)
            && ((state.interactionMode as string) === 'DIG' || state.debugMode || activeY !== 0);

        if (!show || !layeredWorld?.chunks) {
            this.setVisible(false);
            this.lastSignature = '';
            return;
        }

        this.setVisible(true);
        const chunkCount = Object.keys(layeredWorld.chunks).length;
        const hoverSignature = hoverCell ? `${hoverCell.x},${hoverCell.z}` : 'none';
        const signature = `${activeY}|${layeredWorld.renderVersion || 0}|${chunkCount}|${state.interactionMode}|${state.debugMode}|${hoverSignature}`;
        if (signature === this.lastSignature) return;
        this.lastSignature = signature;

        const cells: any[] = [];
        for (const chunk of Object.values(layeredWorld.chunks) as any[]) {
            const layer = chunk.layers?.[activeY];
            if (!layer?.cells) continue;
            for (const cell of Object.values(layer.cells) as any[]) {
                if (!cell.revealed) continue;
                if (cell.material === 'BEDROCK') continue;
                cells.push(cell);
                if (cells.length >= 6000) break;
            }
            if (cells.length >= 6000) break;
        }

        this.ensureMesh(Math.max(1, cells.length));
        if (!this.mesh) return;

        for (let i = 0; i < cells.length; i += 1) {
            const cell = cells[i];
            const y = getTerrainHeight(cell.x, cell.z) + 0.045;
            this.matrix.makeTranslation(cell.x, y, cell.z);
            this.mesh.setMatrixAt(i, this.matrix);
            this.mesh.setColorAt(i, this.colorForCell(cell, hoverCell));
        }

        this.mesh.count = cells.length;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) {
            this.mesh.instanceColor.needsUpdate = true;
        }
    }

    private ensureMesh(count: number): void {
        if (this.mesh && this.mesh.instanceMatrix.count >= count) return;
        if (this.mesh) {
            this.group.remove(this.mesh);
            this.mesh.dispose();
        }
        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
        this.mesh.name = 'active-layer-cells';
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 30;
        this.group.add(this.mesh);
    }

    private colorForCell(cell: any, hoverCell: HoverCell): THREE.Color {
        if (hoverCell && cell.x === hoverCell.x && cell.z === hoverCell.z) return this.color.set('#f8fafc');
        if (cell.material === 'AIR' || cell.contents === 'TUNNEL') return this.color.set('#38e8ff');
        if (cell.material === 'RUBBLE' || cell.contents === 'RUBBLE_PILE') return this.color.set('#9a6b3d');
        if (cell.material === 'ORE') return this.color.set('#f59e0b');
        if (cell.material === 'GEMS') return this.color.set('#c084fc');
        if (cell.material === 'AUREUS_VEIN') return this.color.set('#facc15');
        if (cell.material === 'SAND') return this.color.set('#d6b06a');
        if (cell.material === 'DIRT') return this.color.set('#7c5a38');
        if (cell.material === 'STONE') return this.color.set('#64748b');
        return this.color.set('#94a3b8');
    }
}

class StarterFogOfWarOverlay {
    private group = new THREE.Group();
    private canvas = document.createElement('canvas');
    private context: CanvasRenderingContext2D | null = null;
    private texture: THREE.CanvasTexture;
    private coverMaterial: THREE.MeshBasicMaterial;
    private coverMesh: THREE.Mesh | null = null;
    private lastSignature = '';

    constructor(scene: THREE.Scene) {
        this.canvas.width = STARTER_FOG_MASK_TEXTURE_SIZE;
        this.canvas.height = STARTER_FOG_MASK_TEXTURE_SIZE;
        this.context = this.canvas.getContext('2d');
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.needsUpdate = true;
        this.coverMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            map: this.texture,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide,
        });
        this.group.name = 'starter-fog-of-war-overlay';
        this.group.renderOrder = STARTER_FOG_RENDER_ORDER;
        scene.add(this.group);
    }

    setVisible(visible: boolean): void {
        this.group.visible = visible;
    }

    update(state: any, getTerrainHeight: (worldX: number, worldZ: number) => number, markFogExplorationDirty?: () => void): void {
        if (state.fogOfWarDisabled || state.activeView !== 'SURFACE') {
            this.setVisible(false);
            this.lastSignature = '';
            return;
        }

        const spawnX = Math.round(state.spawnX ?? 0);
        const spawnZ = Math.round(state.spawnZ ?? 0);
        fogExplorationTracker.updateFromState(state, markFogExplorationDirty);
        const signature = `${spawnX},${spawnZ}|${state.activeView}|${fogExplorationTracker.getVersion()}`;
        this.ensureMeshes();
        this.group.position.set(spawnX, getTerrainHeight(spawnX, spawnZ) + 0.16, spawnZ);
        this.setVisible(true);

        if (signature === this.lastSignature) return;
        this.drawMask(fogExplorationTracker.getCenters(), spawnX, spawnZ);
        this.lastSignature = signature;
    }

    private ensureMeshes(): void {
        if (this.coverMesh) return;

        const coverGeometry = new THREE.PlaneGeometry(STARTER_FOG_WORLD_EXTENT * 2, STARTER_FOG_WORLD_EXTENT * 2).rotateX(-Math.PI / 2);
        this.coverMesh = new THREE.Mesh(coverGeometry, this.coverMaterial);
        this.coverMesh.name = 'starter-fog-persistent-world-mask';
        this.coverMesh.frustumCulled = false;
        this.coverMesh.renderOrder = STARTER_FOG_RENDER_ORDER;
        this.group.add(this.coverMesh);
    }

    private drawMask(centers: FogRevealCenter[], originX: number, originZ: number): void {
        if (!this.context) return;
        const ctx = this.context;
        const textureSize = STARTER_FOG_MASK_TEXTURE_SIZE;
        const worldSize = STARTER_FOG_WORLD_EXTENT * 2;
        const worldToTexture = textureSize / worldSize;

        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, textureSize, textureSize);
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.fillRect(0, 0, textureSize, textureSize);
        ctx.globalCompositeOperation = 'destination-out';

        for (const center of centers) {
            const x = (textureSize / 2) + ((center.x - originX) * worldToTexture);
            const y = (textureSize / 2) + ((center.z - originZ) * worldToTexture);
            const clearRadius = center.radius * worldToTexture;
            const featherRadius = STARTER_FOG_FEATHER_RADIUS * worldToTexture;
            const gradientRadius = Math.max(clearRadius + featherRadius, 1);
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, gradientRadius);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(Math.min(clearRadius / gradientRadius, 0.98), 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, gradientRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        this.texture.needsUpdate = true;
    }
}

class FirstPersonFogOfWarMist {
    private group = new THREE.Group();
    private materials = FIRST_PERSON_MIST_BANDS.map(({ opacity }) => new THREE.MeshBasicMaterial({
        color: firstPersonFogColor,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
    }));
    private meshes: THREE.Mesh[] = [];
    private lastSignature = '';

    constructor(scene: THREE.Scene) {
        this.group.name = 'first-person-fog-of-war-mist';
        this.group.renderOrder = FIRST_PERSON_MIST_RENDER_ORDER;
        scene.add(this.group);
    }

    setVisible(visible: boolean): void {
        this.group.visible = visible;
    }

    update(state: any, getTerrainHeight: (worldX: number, worldZ: number) => number, cameraPosition: THREE.Vector3, markFogExplorationDirty?: () => void): void {
        if (state.fogOfWarDisabled || state.activeView !== 'SURFACE') {
            this.setVisible(false);
            this.lastSignature = '';
            return;
        }

        fogExplorationTracker.updateFromState(state, markFogExplorationDirty);
        const center = fogExplorationTracker.getNearestCenter(cameraPosition) ?? {
            key: 'spawn',
            x: Math.round(state.spawnX ?? 0),
            z: Math.round(state.spawnZ ?? 0),
            radius: STARTER_FOG_CLEAR_RADIUS,
        };
        const signature = `${center.key}|${fogExplorationTracker.getVersion()}`;
        this.ensureMeshes();
        this.group.position.set(center.x, getTerrainHeight(center.x, center.z) + (FIRST_PERSON_MIST_HEIGHT / 2) + FIRST_PERSON_MIST_GROUND_OFFSET, center.z);
        this.setVisible(true);

        if (signature === this.lastSignature) return;
        this.lastSignature = signature;
    }

    private ensureMeshes(): void {
        if (this.meshes.length > 0) return;

        for (let i = 0; i < FIRST_PERSON_MIST_BANDS.length; i += 1) {
            const band = FIRST_PERSON_MIST_BANDS[i];
            const geometry = new THREE.CylinderGeometry(band.radius, band.radius, FIRST_PERSON_MIST_HEIGHT, 192, 1, true);
            const mesh = new THREE.Mesh(geometry, this.materials[i]);
            mesh.name = band.name;
            mesh.frustumCulled = false;
            mesh.renderOrder = FIRST_PERSON_MIST_RENDER_ORDER;
            this.meshes.push(mesh);
            this.group.add(mesh);
        }
    }
}

class SurfacePipeToolTransparency {
    private originalMaterials = new Map<string, { material: THREE.Material; state: MaterialFadeState }>();

    update(deps: RenderFrameDeps, active: boolean): void {
        if (!active) {
            this.restore();
            return;
        }

        this.fadeTerrain(deps);
        this.fadeFoliage(deps);
        this.fadeBuildings(deps);
        this.fadeAgents(deps);
    }

    private fadeTerrain(deps: RenderFrameDeps): void {
        const terrainChunks = deps.terrainRenderSystem?.['chunks'] as Map<string, any> | undefined;
        terrainChunks?.forEach((chunk) => {
            this.fadeObject(chunk.mesh, PIPE_TOOL_SURFACE_OPACITY);
            this.fadeObject(chunk.waterMesh, PIPE_TOOL_WATER_OPACITY);
            this.fadeObject(chunk.ghostMesh, PIPE_TOOL_WATER_OPACITY);
        });
    }

    private fadeFoliage(deps: RenderFrameDeps): void {
        const foliageChunks = deps.foliageRenderSystem?.['chunkMeshes'] as Map<string, Map<string, THREE.Object3D>> | undefined;
        foliageChunks?.forEach((meshes) => {
            meshes.forEach((mesh) => this.fadeObject(mesh, PIPE_TOOL_SURFACE_OPACITY));
        });
    }

    private fadeBuildings(deps: RenderFrameDeps): void {
        const buildingMeshes = deps.buildingRenderSystem?.['buildingMeshes'] as Map<number, THREE.Object3D> | undefined;
        buildingMeshes?.forEach((mesh) => this.fadeObject(mesh, PIPE_TOOL_SURFACE_OPACITY));
        this.fadeObject(deps.buildingRenderSystem?.['packetGroup'], PIPE_TOOL_SURFACE_OPACITY);
        this.fadeObject(deps.buildingRenderSystem?.['overlayGroup'], PIPE_TOOL_SURFACE_OPACITY);
        this.fadeObject(deps.buildingRenderSystem?.['packetInstanceLayer']?.['root'], PIPE_TOOL_SURFACE_OPACITY);
        this.fadeObject(deps.buildingRenderSystem?.['overlayInstanceLayer']?.['root'], PIPE_TOOL_SURFACE_OPACITY);

        const particles = deps.buildingRenderSystem?.['particles'] as Array<{ mesh?: THREE.Object3D }> | undefined;
        particles?.forEach((particle) => this.fadeObject(particle.mesh, PIPE_TOOL_SURFACE_OPACITY));
    }

    private fadeAgents(deps: RenderFrameDeps): void {
        const agentMeshes = deps.agentRenderSystem?.['agentMeshes'] as Map<string, THREE.Object3D> | undefined;
        agentMeshes?.forEach((mesh) => this.fadeObject(mesh, PIPE_TOOL_AGENT_OPACITY));
        const contactShadows = deps.agentRenderSystem?.['agentContactShadows'] as Map<string, THREE.Object3D> | undefined;
        contactShadows?.forEach((shadow) => this.fadeObject(shadow, PIPE_TOOL_WATER_OPACITY));
    }

    private fadeObject(object: THREE.Object3D | null | undefined, opacity: number): void {
        if (!object) return;
        object.traverse((child: THREE.Object3D) => {
            const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
            if (Array.isArray(material)) {
                material.forEach((entry) => this.fadeMaterial(entry, opacity));
            } else if (material) {
                this.fadeMaterial(material, opacity);
            }
        });
    }

    private fadeMaterial(material: THREE.Material, opacity: number): void {
        if (!this.originalMaterials.has(material.uuid)) {
            this.originalMaterials.set(material.uuid, {
                material,
                state: {
                    transparent: material.transparent,
                    opacity: material.opacity,
                    depthWrite: material.depthWrite,
                },
            });
        }

        material.transparent = true;
        material.opacity = Math.min(this.originalMaterials.get(material.uuid)?.state.opacity ?? 1, opacity);
        material.depthWrite = false;
        material.needsUpdate = true;
    }

    private restore(): void {
        this.originalMaterials.forEach(({ material, state }) => {
            material.transparent = state.transparent;
            material.opacity = state.opacity;
            material.depthWrite = state.depthWrite;
            material.needsUpdate = true;
        });
        this.originalMaterials.clear();
    }
}

let layeredWorldOverlay: LayeredWorldOverlay | null = null;
let starterFogOfWarOverlay: StarterFogOfWarOverlay | null = null;
let firstPersonFogOfWarMist: FirstPersonFogOfWarMist | null = null;
let surfacePipeToolTransparency: SurfacePipeToolTransparency | null = null;

function getBuildingStatusLabelLayer(deps: RenderFrameDeps): BuildingStatusLabelLayer {
    if (!buildingStatusLabelLayer) {
        buildingStatusLabelLayer = new BuildingStatusLabelLayer(deps.render.getScene());
    }
    return buildingStatusLabelLayer;
}

function getLayeredWorldOverlay(deps: RenderFrameDeps): LayeredWorldOverlay {
    if (!layeredWorldOverlay) {
        layeredWorldOverlay = new LayeredWorldOverlay(deps.render.getScene());
    }
    return layeredWorldOverlay;
}

function getStarterFogOfWarOverlay(deps: RenderFrameDeps): StarterFogOfWarOverlay {
    if (!starterFogOfWarOverlay) {
        starterFogOfWarOverlay = new StarterFogOfWarOverlay(deps.render.getScene());
    }
    return starterFogOfWarOverlay;
}

function getFirstPersonFogOfWarMist(deps: RenderFrameDeps): FirstPersonFogOfWarMist {
    if (!firstPersonFogOfWarMist) {
        firstPersonFogOfWarMist = new FirstPersonFogOfWarMist(deps.render.getScene());
    }
    return firstPersonFogOfWarMist;
}

function getSurfacePipeToolTransparency(): SurfacePipeToolTransparency {
    if (!surfacePipeToolTransparency) {
        surfacePipeToolTransparency = new SurfacePipeToolTransparency();
    }
    return surfacePipeToolTransparency;
}

function isUndergroundPipeToolActive(state: any): boolean {
    return state.activeView === 'SURFACE'
        && state.interactionMode === 'BUILD'
        && state.selectedBuilding === BuildingType.PIPE
        && false;
}

function setObjectVisible(object: THREE.Object3D | null | undefined, visible: boolean): void {
    if (object) object.visible = visible;
}

function setSurfaceRenderVisible(deps: RenderFrameDeps, visible: boolean): void {
    const terrainChunks = deps.terrainRenderSystem?.['chunks'] as Map<string, any> | undefined;
    terrainChunks?.forEach((chunk) => {
        setObjectVisible(chunk.mesh, visible);
        setObjectVisible(chunk.waterMesh, visible);
        setObjectVisible(chunk.ghostMesh, visible);
    });

    const foliageChunks = deps.foliageRenderSystem?.['chunkMeshes'] as Map<string, Map<string, THREE.Object3D>> | undefined;
    if (foliageChunks) {
        foliageChunks.forEach((meshes) => {
            meshes.forEach((mesh) => setObjectVisible(mesh, visible));
        });
    } else {
        deps.render.getScene().traverse((object: THREE.Object3D) => {
            if (object.userData?.foliageType) {
                object.visible = visible;
            }
        });
    }

    const buildingMeshes = deps.buildingRenderSystem?.['buildingMeshes'] as Map<number, THREE.Object3D> | undefined;
    buildingMeshes?.forEach((mesh) => setObjectVisible(mesh, visible));
    setObjectVisible(deps.buildingRenderSystem?.['packetGroup'], visible);
    setObjectVisible(deps.buildingRenderSystem?.['overlayGroup'], visible);
    setObjectVisible(deps.buildingRenderSystem?.['packetInstanceLayer']?.['root'], visible);
    setObjectVisible(deps.buildingRenderSystem?.['overlayInstanceLayer']?.['root'], visible);

    const particles = deps.buildingRenderSystem?.['particles'] as Array<{ mesh?: THREE.Object3D }> | undefined;
    particles?.forEach((particle) => setObjectVisible(particle.mesh, visible));

    const agentMeshes = deps.agentRenderSystem?.['agentMeshes'] as Map<string, THREE.Object3D> | undefined;
    agentMeshes?.forEach((mesh) => setObjectVisible(mesh, visible));
    const statusSprites = deps.agentRenderSystem?.['statusSprites'] as Map<string, THREE.Object3D> | undefined;
    statusSprites?.forEach((sprite) => setObjectVisible(sprite, visible));
    const contactShadows = deps.agentRenderSystem?.['agentContactShadows'] as Map<string, THREE.Object3D> | undefined;
    contactShadows?.forEach((shadow) => setObjectVisible(shadow, visible));
    deps.wildlifeRenderSystem?.setVisible?.(visible);

    if (!visible) {
        deps.foliageRenderSystem?.setGroundDetailVisible?.(false);
        setObjectVisible(deps.buildingRenderSystem?.['selectionCursor'], false);
        setObjectVisible(deps.buildingRenderSystem?.['ghostBuilding'], false);
        setObjectVisible(deps.agentRenderSystem?.['agentSelectionRing'], false);
        setObjectVisible(deps.agentRenderSystem?.['eagle'], false);
    }
}

export function drawWorldFrame(ctx: FrameContext, deps: RenderFrameDeps): void {
    const state = deps.stateManager.getState();
    const affectedBuildingChunks = new Set<string>();

    waterFlowMaterial.uniforms.time.value = ctx.time;
    oilWaterMaterial.uniforms.time.value = ctx.time;
    reservoirWaterMaterial.uniforms.time.value = ctx.time;

    processPendingEffects(state, affectedBuildingChunks, deps);
    includeActiveConstructionChunks(state, affectedBuildingChunks);

    const renderDirtyKeys = deps.stateManager.getDirtyKeys();
    if (affectedBuildingChunks.size > 0) {
        renderDirtyKeys.add('chunks');
    }

    updateActiveView(ctx, state, affectedBuildingChunks, renderDirtyKeys, deps);
    updateCursor(state, deps);
    updateEnvironmentAndDraw(ctx, state, deps);

    deps.stateManager.notifyIfDirty();
}

function processPendingEffects(state: any, affectedBuildingChunks: Set<string>, deps: RenderFrameDeps): void {
    if (state.pendingEffects.length === 0) return;

    state.pendingEffects.forEach((effect: any) => {
        if (effect.type === 'AUDIO' && deps.onSfx) {
            deps.onSfx(effect.sfx);
        } else if (effect.type === 'FX') {
            deps.buildingRenderSystem.triggerEffect(effect.x, effect.z, effect.fxType, 0);
        } else if (effect.type === 'CHUNK_UPDATE') {
            let affectedChunks: string[] = [];
            if (typeof deps.terrainRenderSystem.updateChunk === 'function') {
                affectedChunks = deps.terrainRenderSystem.updateChunk(effect.cx, effect.cz, effect.updates) || [];
            } else if (typeof deps.terrainRenderSystem.updateTiles === 'function') {
                deps.terrainRenderSystem.updateTiles(effect.updates);
                affectedChunks = [`${effect.cx},${effect.cz}`];
            }
            affectedChunks.forEach((key: string) => affectedBuildingChunks.add(key));

            const key = `${effect.cx},${effect.cz}`;
            const chunk = state.chunks[key];
            if (chunk) {
                deps.workerPool.broadcast({ type: 'UPDATE_CHUNK', payload: { key, chunk } });
            }
        }
    });

    state.pendingEffects.length = 0;
}

function includeActiveConstructionChunks(state: any, affectedBuildingChunks: Set<string>): void {
    Object.entries(state.chunks).forEach(([key, chunk]: [string, any]) => {
        const hasActiveConstruction = chunk.tiles.some((tile: any) => tile.isUnderConstruction);
        if (!hasActiveConstruction) return;

        chunk.simDirty = true;
        affectedBuildingChunks.add(key);
    });
}

function updateActiveView(
    ctx: FrameContext,
    state: any,
    affectedBuildingChunks: Set<string>,
    renderDirtyKeys: Set<string>,
    deps: RenderFrameDeps
): void {
    if (state.activeView === 'DUNGEON') {
        updateDungeonView(state, deps);
        return;
    }

    if (deps.fpsCameraSystem.enabled) {
        updateFirstPersonView(ctx, state, affectedBuildingChunks, renderDirtyKeys, deps);
        return;
    }

    updateSurfaceView(ctx, state, affectedBuildingChunks, renderDirtyKeys, deps);
}

function updateDungeonView(state: any, deps: RenderFrameDeps): void {
    getSurfacePipeToolTransparency().update(deps, false);
    setSurfaceRenderVisible(deps, false);
    deps.wildlifeRenderSystem?.setVisible?.(false);
    deps.dungeonRenderSystem.setVisible(true);
    deps.dungeonRenderSystem.update(state.dungeon);
    buildingStatusLabelLayer?.clear();
    layeredWorldOverlay?.setVisible(false);
    starterFogOfWarOverlay?.setVisible(false);
    firstPersonFogOfWarMist?.setVisible(false);

    if (!deps.dungeonCameraSystem.enabled) deps.dungeonCameraSystem.setEnabled(true);
    if (deps.cameraSystem.enabled) deps.cameraSystem.setEnabled(false);
    if (deps.fpsCameraSystem.enabled) deps.fpsCameraSystem.setEnabled(false);

    deps.dungeonInputHandler.setCamera(deps.render.getCamera());
    deps.dungeonInputHandler.setMeshGroup(deps.dungeonRenderSystem.getMeshGroup());
    deps.dungeonInputHandler.setDungeonEngine(new DungeonEngine(state.dungeon));
}

function updateFirstPersonView(
    ctx: FrameContext,
    state: any,
    affectedBuildingChunks: Set<string>,
    renderDirtyKeys: Set<string>,
    deps: RenderFrameDeps
): void {
    getSurfacePipeToolTransparency().update(deps, false);
    setSurfaceRenderVisible(deps, true);
    deps.foliageRenderSystem?.setGroundDetailVisible?.(true);
    deps.foliageRenderSystem?.updateGroundDetailTime?.(ctx.time, state.dayNightCycle?.timeOfDay ?? 12000);
    deps.dungeonRenderSystem.setVisible(false);
    layeredWorldOverlay?.setVisible(false);
    starterFogOfWarOverlay?.setVisible(false);

    if (deps.cameraSystem.enabled) deps.cameraSystem.setEnabled(false);
    if (deps.dungeonCameraSystem.enabled) deps.dungeonCameraSystem.setEnabled(false);

    const camera = deps.render.getCamera();
    deps.fpsCameraSystem.update(ctx.dt, state.agents, deps.getTerrainHeight);
    getFirstPersonFogOfWarMist(deps).update(state, deps.getTerrainHeight, camera.position, () => deps.stateManager.markDirty?.('fogExploration'));
    deps.agentRenderSystem.setSelectedAgent(state.selectedAgentId);

    const allAgents = [...state.agents, ...state.ambientNpcs];
    deps.agentRenderSystem.update(ctx.dt, ctx.time, allAgents, 0.1, camera);
    deps.terrainRenderSystem.update(camera.position, camera);
    deps.wildlifeRenderSystem?.update?.(ctx.time, { x: camera.position.x, z: camera.position.z }, deps.getTerrainHeight, 0.1, true, state.dayNightCycle?.timeOfDay ?? 12000);
    deps.buildingRenderSystem.update(
        ctx.dt,
        ctx.time,
        state.chunks,
        state.factory,
        state.logistics.overlayMode,
        renderDirtyKeys,
        affectedBuildingChunks,
        'FIRST_PERSON',
        0.1,
        deps.render.getRuntimeQuality().smoothDetail
    );
    getBuildingStatusLabelLayer(deps).update(state.chunks, camera, ctx.time, 0.1, 'FIRST_PERSON');
}

function updateSurfaceView(
    ctx: FrameContext,
    state: any,
    affectedBuildingChunks: Set<string>,
    renderDirtyKeys: Set<string>,
    deps: RenderFrameDeps
): void {
    setSurfaceRenderVisible(deps, true);
    deps.dungeonRenderSystem.setVisible(false);
    firstPersonFogOfWarMist?.setVisible(false);

    if (!deps.cameraSystem.enabled) deps.cameraSystem.setEnabled(true);
    if (deps.dungeonCameraSystem.enabled) deps.dungeonCameraSystem.setEnabled(false);
    if (deps.fpsCameraSystem.enabled) deps.fpsCameraSystem.setEnabled(false);

    deps.cameraSystem.update(ctx.dt);
    deps.agentRenderSystem.setSelectedAgent(state.selectedAgentId);

    const zoomLevel = deps.cameraSystem.cameraZoom;
    deps.foliageRenderSystem?.setGroundDetailVisible?.(zoomLevel <= 18);
    if (zoomLevel <= 18) {
        deps.foliageRenderSystem?.updateGroundDetailTime?.(ctx.time, state.dayNightCycle?.timeOfDay ?? 12000);
    }
    const allAgents = [...state.agents, ...state.ambientNpcs];
    const camera = deps.render.getCamera();
    deps.agentRenderSystem.update(ctx.dt, ctx.time, allAgents, zoomLevel, camera);
    deps.terrainRenderSystem.update(deps.cameraSystem.cameraFocus, camera);
    deps.wildlifeRenderSystem?.update?.(ctx.time, deps.cameraSystem.cameraFocus, deps.getTerrainHeight, zoomLevel, false, state.dayNightCycle?.timeOfDay ?? 12000);

    const cursor = deps.inputSystem?.getCurrentCursor() || null;
    const hoverCell = cursor ? { x: Math.round(cursor.x), z: Math.round(cursor.z) } : null;
    getLayeredWorldOverlay(deps).update(state, deps.getTerrainHeight, hoverCell);
    getStarterFogOfWarOverlay(deps).update(state, deps.getTerrainHeight, () => deps.stateManager.markDirty?.('fogExploration'));

    deps.buildingRenderSystem.update(
        ctx.dt,
        ctx.time,
        state.chunks,
        state.factory,
        state.logistics.overlayMode,
        renderDirtyKeys,
        affectedBuildingChunks,
        'SURFACE',
        zoomLevel,
        deps.render.getRuntimeQuality().smoothDetail
    );
    getBuildingStatusLabelLayer(deps).update(state.chunks, camera, ctx.time, zoomLevel, 'SURFACE');
    getSurfacePipeToolTransparency().update(deps, isUndergroundPipeToolActive(state));
}

function updateCursor(state: any, deps: RenderFrameDeps): void {
    if (state.activeView === 'DUNGEON') {
        deps.render.getRenderer().localClippingEnabled = false;
        deps.buildingRenderSystem.updateCursor(null, null);
        return;
    }

    const cursor = deps.inputSystem?.getCurrentCursor() || null;
    if (cursor) {
        const gx = Math.round(cursor.x);
        const gz = Math.round(cursor.z);
        const tile = ChunkStore.getTile(state.chunks, gx, gz);
        cursor.y = tile ? tile.terrainHeight * 0.5 : 0;
    }

    deps.render.getRenderer().localClippingEnabled = false;
    deps.buildingRenderSystem.updateCursor(cursor, deps.cameraSystem.getFocus());
}

function updateEnvironmentAndDraw(ctx: FrameContext, state: any, deps: RenderFrameDeps): void {
    const renderer = deps.render.getRenderer();
    const scene = deps.render.getScene();

    if (state.activeView === 'DUNGEON') {
        renderer.setClearColor(0x000000, 1);
        scene.background = dungeonBackgroundColor;
        scene.fog = new THREE.Fog(0x000000, 32, 110);
        deps.render.draw(ctx);
        return;
    }

    renderer.setClearColor(0x0f172a, 0);
    deps.environmentRenderSystem.update(
        ctx.dt,
        state.dayNightCycle?.timeOfDay || 12000,
        state.weather,
        deps.cameraSystem.cameraFocus
    );

    deps.render.draw(ctx);
}
