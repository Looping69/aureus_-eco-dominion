
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { SceneManager } from './SceneManager';

export class InputManager {
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private interactionPlane: THREE.Mesh;
    private rayPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private dragStartPoint = new THREE.Vector3();
    private dragStartScreen = new THREE.Vector2();
    private isDragging = false;
    private isRightClick = false;
    private lastRotateX = 0;
    private activePointers: Map<number, PointerEvent> = new Map();
    private lastPinchDistance: number | null = null;
    private lastHoverCheckTime = 0;
    
    // Reusable Vectors to prevent GC
    private _tempVec3 = new THREE.Vector3();
    private _tempDelta = new THREE.Vector3();
    
    // Dependencies
    private sceneMgr: SceneManager;
    private domElement: HTMLElement;
    private gridSize: number;
    
    // Callbacks
    private onTileClick: (index: number) => void;
    private onTileRightClick: (index: number) => void;
    private onAgentClick: (id: string | null) => void;
    private onTileHover: (index: number | null, point: THREE.Vector3) => void;
    private getInteractables: () => THREE.Object3D[]; // Terrain instances for raycasting
    private getAgents: () => THREE.Object3D[]; // Agent meshes for raycasting
    private getHeightAt: (idx: number) => number;

    constructor(
        sceneMgr: SceneManager,
        gridSize: number,
        callbacks: {
            onTileClick: (index: number) => void,
            onTileRightClick: (index: number) => void,
            onAgentClick: (id: string | null) => void,
            onTileHover: (index: number | null, point: THREE.Vector3) => void,
            getInteractables: () => THREE.Object3D[],
            getAgents: () => THREE.Object3D[],
            getHeightAt: (idx: number) => number
        }
    ) {
        this.sceneMgr = sceneMgr;
        this.domElement = sceneMgr.renderer.domElement;
        this.gridSize = gridSize;
        this.onTileClick = callbacks.onTileClick;
        this.onTileRightClick = callbacks.onTileRightClick;
        this.onAgentClick = callbacks.onAgentClick;
        this.onTileHover = callbacks.onTileHover;
        this.getInteractables = callbacks.getInteractables;
        this.getAgents = callbacks.getAgents;
        this.getHeightAt = callbacks.getHeightAt;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Invisible plane for panning
        const planeGeo = new THREE.PlaneGeometry(gridSize * 3, gridSize * 3);
        const planeMat = new THREE.MeshBasicMaterial({ visible: false }); 
        this.interactionPlane = new THREE.Mesh(planeGeo, planeMat);
        this.interactionPlane.rotation.x = -Math.PI / 2;
        this.interactionPlane.position.y = -1; 
        this.sceneMgr.scene.add(this.interactionPlane);

        this.bindEvents();
    }

    private bindEvents() {
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);

        this.domElement.addEventListener('pointerdown', this.handlePointerDown);
        window.addEventListener('pointermove', this.handlePointerMove);
        window.addEventListener('pointerup', this.handlePointerUp);
        window.addEventListener('pointercancel', this.handlePointerUp);
        this.domElement.addEventListener('wheel', this.handleWheel, { passive: false });
        this.domElement.addEventListener('contextmenu', this.handleContextMenu);
    }

    public cleanup() {
        this.domElement.removeEventListener('pointerdown', this.handlePointerDown); 
        window.removeEventListener('pointermove', this.handlePointerMove); 
        window.removeEventListener('pointerup', this.handlePointerUp); 
        window.removeEventListener('pointercancel', this.handlePointerUp); 
        this.domElement.removeEventListener('wheel', this.handleWheel);
        this.domElement.removeEventListener('contextmenu', this.handleContextMenu);
    }

    private getRayPlaneIntersection(clientX: number, clientY: number, target: THREE.Vector3) {
        this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.sceneMgr.camera);
        this.raycaster.ray.intersectPlane(this.rayPlane, target);
        return target;
    }

    private handlePointerDown(e: PointerEvent) {
        this.activePointers.set(e.pointerId, e);
        if (this.activePointers.size === 1) {
            this.isDragging = true;
            this.dragStartScreen.set(e.clientX, e.clientY);
            this.isRightClick = (e.button === 2 || e.pointerType === 'touch' && e.isPrimary === false); 
            this.lastRotateX = e.clientX;
            if (!this.isRightClick) this.getRayPlaneIntersection(e.clientX, e.clientY, this.dragStartPoint);
        } else if (this.activePointers.size === 2) {
            this.isDragging = false; 
            const pointers = Array.from(this.activePointers.values());
            const dx = pointers[0].clientX - pointers[1].clientX, dy = pointers[0].clientY - pointers[1].clientY;
            this.lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
        }
    }

    private handlePointerMove(e: PointerEvent) {
        this.activePointers.set(e.pointerId, e);
        
        // Pinch Zoom
        if (this.activePointers.size === 2) {
            const pointers = Array.from(this.activePointers.values());
            const dx = pointers[0].clientX - pointers[1].clientX, dy = pointers[0].clientY - pointers[1].clientY;
            const currentDistance = Math.sqrt(dx * dx + dy * dy);
            if (this.lastPinchDistance !== null) {
                const delta = this.lastPinchDistance - currentDistance;
                this.sceneMgr.zoom(delta);
            }
            this.lastPinchDistance = currentDistance;
            return;
        }

        // Mouse Move / Hover
        if (!this.isRightClick && this.activePointers.size === 1) {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            if (!this.isDragging) {
                // Throttle raycasting to ~30fps (33ms)
                const now = Date.now();
                if (now - this.lastHoverCheckTime > 32) {
                    this.checkHover();
                    this.lastHoverCheckTime = now;
                }
            }
        }

        // Dragging / Panning / Rotating
        if (this.isDragging && this.activePointers.size === 1) {
            if (this.isRightClick) {
                this.sceneMgr.rotate(e.clientX - this.lastRotateX);
                this.lastRotateX = e.clientX;
            } else {
                this.getRayPlaneIntersection(e.clientX, e.clientY, this._tempVec3);
                this._tempDelta.subVectors(this.dragStartPoint, this._tempVec3);
                this.sceneMgr.pan(this._tempDelta);
            }
        }
    }

    private handlePointerUp(e: PointerEvent) {
        this.activePointers.delete(e.pointerId);
        if (this.activePointers.size < 2) this.lastPinchDistance = null;
        if (!this.isDragging) return;
        this.isDragging = false;
        
        // Click Detection (Small drag distance)
        const dist = this.dragStartScreen.distanceTo(new THREE.Vector2(e.clientX, e.clientY));
        if (dist < 5) {
            if (this.isRightClick) {
                const hit = this.getIntersection();
                if (hit) this.onTileRightClick(hit.index);
            } else {
                // Check Agents First
                this.raycaster.setFromCamera(this.mouse, this.sceneMgr.camera);
                const agentIntersections = this.raycaster.intersectObjects(this.getAgents(), true);
                if (agentIntersections.length > 0) {
                    let clickedAgentId: string | null = null;
                    let obj = agentIntersections[0].object;
                    // Traverse up to find the group with the agent ID
                    while (obj.parent) {
                        if (obj.userData.agentId) {
                            clickedAgentId = obj.userData.agentId;
                            break;
                        }
                        obj = obj.parent;
                    }
                    
                    if (clickedAgentId) {
                        this.onAgentClick(clickedAgentId);
                    } else {
                        // Fallback if ID not found on parents (shouldn't happen with correct AgentManager)
                        const hit = this.getIntersection();
                        if (hit) { 
                            this.onTileClick(hit.index); 
                            this.onAgentClick(null); 
                        }
                    }
                } else {
                    const hit = this.getIntersection();
                    if (hit) { 
                        this.onTileClick(hit.index); 
                        this.onAgentClick(null); 
                    }
                }
            }
        }
    }

    private handleWheel(e: WheelEvent) { 
        e.preventDefault(); 
        this.sceneMgr.zoom(e.deltaY * 0.05); 
    }
    
    private handleContextMenu(e: MouseEvent) { e.preventDefault(); }

    private getIntersection(): { index: number, point: THREE.Vector3 } | null {
        this.raycaster.setFromCamera(this.mouse, this.sceneMgr.camera);
        // Include interactionPlane as fallback
        const interactables = [...this.getInteractables(), this.interactionPlane];
        const intersections = this.raycaster.intersectObjects(interactables, false);
        
        if (intersections.length > 0) {
            const hit = intersections[0];
            let tileIndex = -1;
            
            if (hit.object instanceof THREE.InstancedMesh) {
                // We assume WorldManager sets map logic or we fallback to math.
                // Since we don't have the instanceId map here easily without tight coupling,
                // we rely on grid position calculation which is robust for a grid game.
                const offset = (this.gridSize - 1) / 2;
                const x = Math.round(hit.point.x + offset);
                const z = Math.round(hit.point.z + offset);
                if (x >= 0 && x < this.gridSize && z >= 0 && z < this.gridSize) {
                    tileIndex = z * this.gridSize + x;
                }
            } else {
                const offset = (this.gridSize - 1) / 2;
                const x = Math.round(hit.point.x + offset);
                const z = Math.round(hit.point.z + offset);
                if (x >= 0 && x < this.gridSize && z >= 0 && z < this.gridSize) {
                    tileIndex = z * this.gridSize + x;
                }
            }

            if (tileIndex !== -1) {
                const offset = (this.gridSize - 1) / 2;
                const height = this.getHeightAt(tileIndex);
                const point = new THREE.Vector3(
                    (tileIndex % this.gridSize) - offset, 
                    height, 
                    Math.floor(tileIndex / this.gridSize) - offset
                );
                return { index: tileIndex, point };
            }
        }
        return null;
    }

    private checkHover() {
        const hit = this.getIntersection();
        if (hit) {
            this.onTileHover(hit.index, hit.point);
        } else {
            this.onTileHover(null, new THREE.Vector3());
        }
    }
}
