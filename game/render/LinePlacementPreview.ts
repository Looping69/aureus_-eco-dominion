import * as THREE from 'three';
import { BuildingType } from '../../types';
import { getInfrastructureAnchorY, getInfrastructurePreviewY } from '../../engine/render/utils/GroundAnchors';

const PIPE_SUPPLY_RADIUS = 3;
const PIPE_UNDERGROUND_PREVIEW_OFFSET = -0.35;

const PREVIEW_COLORS: Partial<Record<BuildingType, number>> = {
    [BuildingType.ROAD]: 0x94a3b8,
    [BuildingType.PIPE]: 0x22d3ee,
    [BuildingType.POWER_LINE]: 0xfacc15,
    [BuildingType.FENCE]: 0x34d399,
};

export class LinePlacementPreview {
    private scene: THREE.Scene;
    private getTerrainHeight: (worldX: number, worldZ: number) => number;
    private group = new THREE.Group();
    private material = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
    });
    private anchorMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
    });
    private pipeCoverageMaterial = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    constructor(scene: THREE.Scene, getTerrainHeight: (worldX: number, worldZ: number) => number) {
        this.scene = scene;
        this.getTerrainHeight = getTerrainHeight;
        this.group.renderOrder = 12;
        this.scene.add(this.group);
    }

    setLine(startX: number, startZ: number, endX: number, endZ: number, type: BuildingType, available: number = Infinity): void {
        this.clearChildren();
        this.material.color.setHex(PREVIEW_COLORS[type] ?? 0x22d3ee);

        const deltaX = endX - startX;
        const deltaZ = endZ - startZ;
        const horizontal = Math.abs(deltaX) >= Math.abs(deltaZ);
        const finalX = horizontal ? endX : startX;
        const finalZ = horizontal ? startZ : endZ;
        const stepX = Math.sign(finalX - startX);
        const stepZ = Math.sign(finalZ - startZ);
        const requestedLength = Math.max(Math.abs(finalX - startX), Math.abs(finalZ - startZ)) + 1;
        const count = Math.max(1, Math.min(requestedLength, available));
        const pipeCoverage = new Set<string>();

        for (let i = 0; i < count; i++) {
            const x = startX + stepX * i;
            const z = startZ + stepZ * i;
            const terrainY = this.getTerrainHeight(x, z);
            const y = type === BuildingType.PIPE
                ? getInfrastructurePreviewY(terrainY) + PIPE_UNDERGROUND_PREVIEW_OFFSET
                : getInfrastructurePreviewY(terrainY);
            const tile = new THREE.Mesh(
                new THREE.BoxGeometry(0.86, 0.055, 0.86),
                this.material
            );
            tile.position.set(x, y, z);
            this.group.add(tile);

            if (type === BuildingType.PIPE) {
                this.collectPipeCoverage(pipeCoverage, x, z);
            }
        }

        if (type === BuildingType.PIPE) {
            this.addPipeCoverageTiles(pipeCoverage);
        }

        const anchorY = type === BuildingType.PIPE
            ? getInfrastructureAnchorY(this.getTerrainHeight(startX, startZ)) + PIPE_UNDERGROUND_PREVIEW_OFFSET
            : getInfrastructureAnchorY(this.getTerrainHeight(startX, startZ));
        const anchor = new THREE.Mesh(
            new THREE.BoxGeometry(0.34, 0.16, 0.34),
            this.anchorMaterial
        );
        anchor.position.set(startX, anchorY, startZ);
        this.group.add(anchor);
    }

    clear(): void {
        this.clearChildren();
    }

    dispose(): void {
        this.clearChildren();
        this.scene.remove(this.group);
        this.material.dispose();
        this.anchorMaterial.dispose();
        this.pipeCoverageMaterial.dispose();
    }

    private collectPipeCoverage(pipeCoverage: Set<string>, centerX: number, centerZ: number): void {
        for (let dz = -PIPE_SUPPLY_RADIUS; dz <= PIPE_SUPPLY_RADIUS; dz++) {
            for (let dx = -PIPE_SUPPLY_RADIUS; dx <= PIPE_SUPPLY_RADIUS; dx++) {
                pipeCoverage.add(`${centerX + dx},${centerZ + dz}`);
            }
        }
    }

    private addPipeCoverageTiles(pipeCoverage: Set<string>): void {
        for (const key of pipeCoverage) {
            const [x, z] = key.split(',').map(Number);
            const y = this.getTerrainHeight(x, z) + 0.075;
            const tile = new THREE.Mesh(
                new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2),
                this.pipeCoverageMaterial
            );
            tile.position.set(x, y, z);
            tile.renderOrder = 11;
            this.group.add(tile);
        }
    }

    private clearChildren(): void {
        while (this.group.children.length > 0) {
            const child = this.group.children.pop();
            if (!child) continue;
            const mesh = child as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
        }
    }
}