import * as THREE from 'three';
import { BuildingType } from '../../../types';
import { BUILDINGS } from '../../../engine/data/VoxelConstants';
import { BuildingFactory } from '../../../engine/render/utils/VoxelGenerators';

export class BuildingPreviewController {
    private scene: THREE.Scene;
    private selectionCursor: THREE.Mesh;
    private ghostBuilding: THREE.Group | null = null;
    private ghostType: BuildingType | null = null;
    private pinnedGhostPos: { x: number; z: number } | null = null;

    constructor(scene: THREE.Scene, selectionCursor: THREE.Mesh) {
        this.scene = scene;
        this.selectionCursor = selectionCursor;
    }

    public setPinnedGhost(pos: { x: number; z: number } | null, y: number = 0) {
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
            const group = BuildingFactory[type]({ level: 1 });
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
