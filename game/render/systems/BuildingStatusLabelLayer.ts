import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { BuildingType, Chunk, GridTile } from '../../../types';
import { BUILDINGS } from '../../../engine/data/VoxelConstants';

type BuildingStatusText = InstanceType<typeof Text>;
type BuildingStatusTone = 'online' | 'construction' | 'warning' | 'blocked';

interface BuildingStatusCandidate {
    tile: GridTile;
    label: string;
    tone: BuildingStatusTone;
    priority: number;
    distanceSq: number;
    showLabel: boolean;
}

const INFRASTRUCTURE_TYPES = new Set<BuildingType>([
    BuildingType.ROAD,
    BuildingType.PIPE,
    BuildingType.POWER_LINE,
    BuildingType.FENCE,
    BuildingType.RAIL_LINE,
]);

const TONE_STYLE: Record<BuildingStatusTone, { color: string; outlineColor: string; outlineWidth: number; halo: number }> = {
    online: { color: '#bbf7d0', outlineColor: '#052e16', outlineWidth: 0.008, halo: 0x22c55e },
    construction: { color: '#cffafe', outlineColor: '#164e63', outlineWidth: 0.01, halo: 0x22d3ee },
    warning: { color: '#fde68a', outlineColor: '#451a03', outlineWidth: 0.012, halo: 0xf59e0b },
    blocked: { color: '#fecdd3', outlineColor: '#450a0a', outlineWidth: 0.014, halo: 0xef4444 },
};

export class BuildingStatusLabelLayer {
    private scene: THREE.Scene;
    private labels = new Map<number, BuildingStatusText>();
    private lastScanTime = -Infinity;
    private readonly scanIntervalSeconds = 0.35;
    private readonly maxLabels = 10;
    private readonly maxHalos = 56;
    private haloMesh: THREE.InstancedMesh | null = null;
    private haloGeometry = new THREE.RingGeometry(0.38, 0.48, 28).rotateX(-Math.PI / 2);
    private haloMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexColors: true,
    });
    private haloMatrix = new THREE.Matrix4();
    private haloPosition = new THREE.Vector3();
    private haloQuaternion = new THREE.Quaternion();
    private haloScale = new THREE.Vector3(1, 1, 1);
    private haloColor = new THREE.Color();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public update(
        chunks: Record<string, Chunk>,
        camera: THREE.Camera,
        time: number,
        zoomLevel: number,
        viewMode: 'SURFACE' | 'FIRST_PERSON'
    ): void {
        const shouldShow = viewMode === 'FIRST_PERSON' || zoomLevel <= 30;
        if (!shouldShow) {
            this.clear();
            this.setHaloVisible(false);
            return;
        }

        if (time - this.lastScanTime >= this.scanIntervalSeconds) {
            this.syncStatus(chunks, camera, viewMode, time);
            this.lastScanTime = time;
        }

        this.labels.forEach((label) => {
            label.quaternion.copy(camera.quaternion);
        });
    }

    public clear(): void {
        this.labels.forEach((label) => {
            this.scene.remove(label);
            label.dispose();
        });
        this.labels.clear();
    }

    public dispose(): void {
        this.clear();
        if (this.haloMesh) {
            this.scene.remove(this.haloMesh);
            this.haloMesh.dispose();
            this.haloMesh = null;
        }
        this.haloGeometry.dispose();
        this.haloMaterial.dispose();
    }

    private syncStatus(chunks: Record<string, Chunk>, camera: THREE.Camera, viewMode: 'SURFACE' | 'FIRST_PERSON', time: number): void {
        const candidates = this.collectCandidates(chunks, camera, viewMode);
        this.syncLabels(candidates, camera);
        this.syncHalos(candidates, time);
    }

    private syncLabels(candidates: BuildingStatusCandidate[], camera: THREE.Camera): void {
        const labelCandidates = candidates.filter((candidate) => candidate.showLabel).slice(0, this.maxLabels);
        const activeIds = new Set(labelCandidates.map((candidate) => candidate.tile.id));

        this.labels.forEach((label, tileId) => {
            if (!activeIds.has(tileId)) {
                this.scene.remove(label);
                label.dispose();
                this.labels.delete(tileId);
            }
        });

        for (const candidate of labelCandidates) {
            const { tile, label, tone } = candidate;
            const existing = this.labels.get(tile.id);
            const text = existing || this.createLabel();
            this.applyLabel(text, label, tone);
            this.positionLabel(text, tile);
            text.quaternion.copy(camera.quaternion);

            if (!existing) {
                this.scene.add(text);
                this.labels.set(tile.id, text);
            }
        }
    }

    private syncHalos(candidates: BuildingStatusCandidate[], time: number): void {
        const haloCandidates = candidates.slice(0, this.maxHalos);
        if (haloCandidates.length === 0) {
            this.setHaloVisible(false);
            return;
        }

        this.ensureHaloMesh(haloCandidates.length);
        if (!this.haloMesh) return;

        haloCandidates.forEach((candidate, index) => {
            const tile = candidate.tile;
            const def = BUILDINGS[tile.buildingType];
            const width = def?.width || 1;
            const depth = def?.depth || 1;
            const pulse = candidate.tone === 'blocked'
                ? 1 + Math.sin(time * 5.5) * 0.12
                : candidate.tone === 'construction'
                    ? 1 + Math.sin(time * 3.5) * 0.08
                    : 1;
            const radius = Math.max(width, depth) * 0.55 * pulse;
            this.haloPosition.set(
                tile.x + ((width - 1) / 2),
                (tile.terrainHeight * 0.5) + 0.055,
                tile.z + ((depth - 1) / 2)
            );
            this.haloQuaternion.identity();
            this.haloScale.setScalar(Math.max(0.8, radius));
            this.haloMatrix.compose(this.haloPosition, this.haloQuaternion, this.haloScale);
            this.haloMesh!.setMatrixAt(index, this.haloMatrix);
            this.haloMesh!.setColorAt(index, this.haloColor.setHex(TONE_STYLE[candidate.tone].halo));
        });

        this.haloMesh.count = haloCandidates.length;
        this.haloMesh.instanceMatrix.needsUpdate = true;
        if (this.haloMesh.instanceColor) {
            this.haloMesh.instanceColor.needsUpdate = true;
        }
        this.setHaloVisible(true);
    }

    private ensureHaloMesh(count: number): void {
        if (this.haloMesh && this.haloMesh.instanceMatrix.count >= count) return;
        if (this.haloMesh) {
            this.scene.remove(this.haloMesh);
            this.haloMesh.dispose();
        }
        this.haloMesh = new THREE.InstancedMesh(this.haloGeometry, this.haloMaterial, count);
        this.haloMesh.name = 'building-status-halos';
        this.haloMesh.renderOrder = 21;
        this.haloMesh.frustumCulled = true;
        this.scene.add(this.haloMesh);
    }

    private setHaloVisible(visible: boolean): void {
        if (this.haloMesh) this.haloMesh.visible = visible;
    }

    private collectCandidates(
        chunks: Record<string, Chunk>,
        camera: THREE.Camera,
        viewMode: 'SURFACE' | 'FIRST_PERSON'
    ): BuildingStatusCandidate[] {
        const maxDistanceSq = viewMode === 'FIRST_PERSON' ? 24 * 24 : 38 * 38;
        const cameraX = camera.position.x;
        const cameraZ = camera.position.z;
        const candidates: BuildingStatusCandidate[] = [];

        Object.values(chunks).forEach((chunk) => {
            chunk.tiles.forEach((tile) => {
                if (!this.isStructureHead(tile)) return;

                const status = this.getBuildingStatus(tile);
                if (!status) return;

                const dx = tile.x - cameraX;
                const dz = tile.z - cameraZ;
                const distanceSq = (dx * dx) + (dz * dz);
                if (distanceSq > maxDistanceSq) return;

                candidates.push({ tile, ...status, distanceSq });
            });
        });

        return candidates
            .sort((a, b) => (b.priority - a.priority) || (a.distanceSq - b.distanceSq));
    }

    private isStructureHead(tile: GridTile): boolean {
        if (!tile.buildingType || tile.buildingType === BuildingType.EMPTY || tile.buildingType === BuildingType.POND) return false;
        if (INFRASTRUCTURE_TYPES.has(tile.buildingType)) return false;
        if (tile.structureHeadX === undefined || tile.structureHeadZ === undefined) return true;
        return tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ;
    }

    private getBuildingStatus(tile: GridTile): { label: string; tone: BuildingStatusTone; priority: number; showLabel: boolean } | null {
        const def = BUILDINGS[tile.buildingType];
        const name = def?.name || 'Building';

        if (tile.powerStatus === 'DISCONNECTED' && tile.waterStatus === 'DISCONNECTED') {
            return { label: `${name} offline: no power + water`, tone: 'blocked', priority: 5, showLabel: true };
        }
        if (tile.powerStatus === 'DISCONNECTED') {
            return { label: `${name} offline: no power`, tone: 'blocked', priority: 4, showLabel: true };
        }
        if (tile.waterStatus === 'DISCONNECTED') {
            return { label: `${name} water-starved`, tone: 'warning', priority: 3, showLabel: true };
        }
        if (tile.isUnderConstruction) {
            const buildTime = def?.buildTime || 1;
            const progress = Math.max(0, Math.min(1, 1 - ((tile.constructionTimeLeft || 0) / buildTime)));
            return { label: `Building ${name}: ${Math.round(progress * 100)}%`, tone: 'construction', priority: 2, showLabel: true };
        }
        if (def?.production || def?.power?.produces || def?.power?.consumes || def?.water?.produces || def?.water?.consumes) {
            return { label: `${name} online`, tone: 'online', priority: 1, showLabel: false };
        }

        return null;
    }

    private createLabel(): BuildingStatusText {
        const label = new Text() as BuildingStatusText;
        label.fontSize = 0.13;
        label.maxWidth = 2.75;
        label.textAlign = 'center';
        label.anchorX = 'center';
        label.anchorY = 'middle';
        label.renderOrder = 22;
        label.userData.isTroikaBuildingStatusLabel = true;
        label.userData.statusText = '';
        label.userData.statusTone = null;
        (label as any).depthOffset = -2;
        return label;
    }

    private applyLabel(label: BuildingStatusText, text: string, tone: BuildingStatusTone): void {
        const nextText = text.slice(0, 42);
        if (label.userData.statusText === nextText && label.userData.statusTone === tone) return;

        const style = TONE_STYLE[tone];
        label.text = nextText;
        label.color = style.color;
        label.outlineColor = style.outlineColor;
        label.outlineWidth = style.outlineWidth;
        label.userData.statusText = nextText;
        label.userData.statusTone = tone;
        label.sync();
    }

    private positionLabel(label: BuildingStatusText, tile: GridTile): void {
        const def = BUILDINGS[tile.buildingType];
        const width = def?.width || 1;
        const depth = def?.depth || 1;
        const centerX = tile.x + ((width - 1) / 2);
        const centerZ = tile.z + ((depth - 1) / 2);
        const y = (tile.terrainHeight * 0.5) + 1.15 + Math.min(0.55, Math.max(width, depth) * 0.12);
        label.position.set(centerX, y, centerZ);
    }
}
