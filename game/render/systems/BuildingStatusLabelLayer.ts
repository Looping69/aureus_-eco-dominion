import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { BuildingType, Chunk, GridTile } from '../../../types';
import { BUILDINGS } from '../../../engine/data/VoxelConstants';

type BuildingStatusText = InstanceType<typeof Text>;
type BuildingStatusTone = 'construction' | 'warning' | 'blocked';

interface BuildingStatusCandidate {
    tile: GridTile;
    label: string;
    tone: BuildingStatusTone;
    priority: number;
    distanceSq: number;
}

const INFRASTRUCTURE_TYPES = new Set<BuildingType>([
    BuildingType.ROAD,
    BuildingType.PIPE,
    BuildingType.POWER_LINE,
    BuildingType.FENCE,
    BuildingType.RAIL_LINE,
]);

const TONE_STYLE: Record<BuildingStatusTone, { color: string; outlineColor: string; outlineWidth: number }> = {
    construction: { color: '#cffafe', outlineColor: '#164e63', outlineWidth: 0.01 },
    warning: { color: '#fde68a', outlineColor: '#451a03', outlineWidth: 0.012 },
    blocked: { color: '#fecdd3', outlineColor: '#450a0a', outlineWidth: 0.014 },
};

export class BuildingStatusLabelLayer {
    private scene: THREE.Scene;
    private labels = new Map<number, BuildingStatusText>();
    private lastScanTime = -Infinity;
    private readonly scanIntervalSeconds = 0.35;
    private readonly maxLabels = 12;

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
            return;
        }

        if (time - this.lastScanTime >= this.scanIntervalSeconds) {
            this.syncLabels(chunks, camera, viewMode);
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
    }

    private syncLabels(chunks: Record<string, Chunk>, camera: THREE.Camera, viewMode: 'SURFACE' | 'FIRST_PERSON'): void {
        const candidates = this.collectCandidates(chunks, camera, viewMode);
        const activeIds = new Set(candidates.map((candidate) => candidate.tile.id));

        this.labels.forEach((label, tileId) => {
            if (!activeIds.has(tileId)) {
                this.scene.remove(label);
                label.dispose();
                this.labels.delete(tileId);
            }
        });

        for (const candidate of candidates) {
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
            .sort((a, b) => (b.priority - a.priority) || (a.distanceSq - b.distanceSq))
            .slice(0, this.maxLabels);
    }

    private isStructureHead(tile: GridTile): boolean {
        if (!tile.buildingType || tile.buildingType === BuildingType.EMPTY || tile.buildingType === BuildingType.POND) return false;
        if (INFRASTRUCTURE_TYPES.has(tile.buildingType)) return false;
        if (tile.structureHeadX === undefined || tile.structureHeadZ === undefined) return true;
        return tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ;
    }

    private getBuildingStatus(tile: GridTile): { label: string; tone: BuildingStatusTone; priority: number } | null {
        const name = BUILDINGS[tile.buildingType]?.name || 'Building';

        if (tile.powerStatus === 'DISCONNECTED' && tile.waterStatus === 'DISCONNECTED') {
            return { label: `${name} offline: no power + water`, tone: 'blocked', priority: 4 };
        }
        if (tile.powerStatus === 'DISCONNECTED') {
            return { label: `${name} offline: no power`, tone: 'blocked', priority: 3 };
        }
        if (tile.waterStatus === 'DISCONNECTED') {
            return { label: `${name} water-starved`, tone: 'warning', priority: 2 };
        }
        if (tile.isUnderConstruction) {
            const buildTime = BUILDINGS[tile.buildingType]?.buildTime || 1;
            const progress = Math.max(0, Math.min(1, 1 - ((tile.constructionTimeLeft || 0) / buildTime)));
            return { label: `Building ${name}: ${Math.round(progress * 100)}%`, tone: 'construction', priority: 1 };
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
