
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { Agent } from '../types';
import { createAgentGroup } from '../voxels/Agent';
import { createEagle } from '../voxels/Eagle';

export class AgentManager {
    private scene: THREE.Scene;
    private gridSize: number;

    public agentMeshes: Map<string, THREE.Group> = new Map();
    private eagle: THREE.Group | null = null;

    private agentSelectionRing: THREE.Mesh;
    private selectedAgentId: string | null = null;
    private getHeightAt: (x: number, z: number) => number;
    private lastTime: number = 0;

    constructor(scene: THREE.Scene, gridSize: number, getHeightAt: (x: number, z: number) => number) {
        this.scene = scene;
        this.gridSize = gridSize;
        this.getHeightAt = getHeightAt;

        // Selection Ring
        this.agentSelectionRing = new THREE.Mesh(
            new THREE.RingGeometry(0.2, 0.25, 32),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
        );
        this.agentSelectionRing.rotation.x = -Math.PI / 2;
        this.agentSelectionRing.visible = false;
        this.scene.add(this.agentSelectionRing);

        // Eagle
        this.eagle = createEagle();
        this.eagle.visible = true; // Always visible now
        // Initial random start pos
        const range = (this.gridSize / 2) * 0.8;
        this.eagle.position.set((Math.random() - 0.5) * 2 * range, 30, (Math.random() - 0.5) * 2 * range);
        this.scene.add(this.eagle);
    }

    public updateAgents(agents: Agent[]) {
        const offset = (this.gridSize - 1) / 2;
        const seen = new Set<string>();

        agents.forEach(agent => {
            seen.add(agent.id);
            let meshGroup = this.agentMeshes.get(agent.id);

            // Check if role changed, if so recreate mesh
            if (meshGroup && meshGroup.userData.role !== agent.type) {
                this.scene.remove(meshGroup);
                this.agentMeshes.delete(agent.id);
                meshGroup = undefined;
            }

            if (!meshGroup) {
                meshGroup = createAgentGroup(agent);
                // Attach ID for raycasting identification in InputManager
                meshGroup.userData.agentId = agent.id;
                meshGroup.userData.role = agent.type;
                this.scene.add(meshGroup);
                this.agentMeshes.set(agent.id, meshGroup);
            }

            // Determine Target Rotation
            let targetRot = meshGroup.rotation.y;
            if (agent.state === 'MOVING' && agent.targetTileId !== null) {
                const tx = (agent.targetTileId % this.gridSize) - offset;
                const tz = Math.floor(agent.targetTileId / this.gridSize) - offset;
                targetRot = Math.atan2(tx - (agent.x - offset), tz - (agent.z - offset));
            }

            meshGroup.userData = {
                ...meshGroup.userData,
                targetPos: new THREE.Vector3(agent.x - offset, 0, agent.z - offset),
                agentState: agent.state,
                targetRot: targetRot
            };
        });

        this.agentMeshes.forEach((m, id) => {
            if (!seen.has(id)) {
                this.scene.remove(m);
                this.agentMeshes.delete(id);
            }
        });
    }

    public setSelectedAgent(id: string | null) {
        this.selectedAgentId = id;
    }

    public animate(time: number, zoomLevel: number) {
        if (this.lastTime === 0) this.lastTime = time;
        const delta = Math.min(time - this.lastTime, 0.1); // Cap delta to prevent huge jumps
        this.lastTime = time;

        // LOD Thresholds (Tightened for performance)
        const LOD_MEDIUM = 40;  // Was 60
        const LOD_LOW = 70;     // Was 110

        // 1. Agents
        this.agentMeshes.forEach((meshGroup, agentId) => {
            const targetPos = meshGroup.userData.targetPos;

            // Seed randomness based on agent ID string char code sum
            const idSeed = agentId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) * 0.1;

            // --- POSITION UPDATE (CRITICAL - ALWAYS RUN) ---
            if (targetPos) {
                meshGroup.position.x = THREE.MathUtils.lerp(meshGroup.position.x, targetPos.x, 0.15);
                meshGroup.position.z = THREE.MathUtils.lerp(meshGroup.position.z, targetPos.z, 0.15);
                // Sample height from World Manager via callback
                const h = this.getHeightAt(meshGroup.position.x, meshGroup.position.z);
                meshGroup.position.y = THREE.MathUtils.lerp(meshGroup.position.y, h + 0.05, 0.3);
            }

            // --- ROTATION UPDATE (CRITICAL - ALWAYS RUN) ---
            const state = meshGroup.userData.agentState;
            if (state === 'MOVING' || state === 'SOCIALIZING') {
                const diff = meshGroup.userData.targetRot - meshGroup.rotation.y;
                if (!isNaN(diff)) meshGroup.rotation.y += THREE.MathUtils.lerp(0, diff, 0.1);
            }

            // --- LOD 2: LOW DETAIL (Zoom > 110) ---
            if (zoomLevel > LOD_LOW) {
                // Static sliding meshes. No limb animation costs.
                // Reset limbs once to ensure they aren't stuck in weird poses
                const { armL, armR, legL, legR, head } = meshGroup.userData.parts;
                if (armL) armL.rotation.x = 0;
                if (armR) armR.rotation.x = 0;
                if (legL) legL.rotation.x = 0;
                if (legR) legR.rotation.x = 0;
                if (head) head.rotation.set(0, 0, 0);
                return;
            }

            // Cached part lookup from userData (Optimized)
            const head = meshGroup.userData.parts.head;
            const armL = meshGroup.userData.parts.armL;
            const armR = meshGroup.userData.parts.armR;
            const legL = meshGroup.userData.parts.legL;
            const legR = meshGroup.userData.parts.legR;

            // --- LOD 1: MEDIUM DETAIL (Zoom > 60) ---
            if (zoomLevel > LOD_MEDIUM) {
                if (state === 'MOVING') {
                    // Simplified walk cycle (legs only, no arms, no bob)
                    const walk = Math.sin(time * 12);
                    if (legL) legL.rotation.x = -walk * 0.6;
                    if (legR) legR.rotation.x = walk * 0.6;
                    if (armL) armL.rotation.x = 0;
                    if (armR) armR.rotation.x = 0;
                } else {
                    // Static idle (no breathing/looking)
                    if (armL) armL.rotation.x = 0;
                    if (armR) armR.rotation.x = 0;
                    if (legL) legL.rotation.x = 0;
                    if (legR) legR.rotation.x = 0;
                    if (head) head.rotation.y = 0;
                }
                return;
            }

            // --- LOD 0: HIGH DETAIL (Zoom <= 60) ---

            // Reset rotations if not handled in state
            if (state !== 'MOVING' && state !== 'WORKING' && state !== 'SOCIALIZING') {
                if (armL) armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, 0, 0.1);
                if (armR) armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, 0, 0.1);
                if (legL) legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, 0.1);
                if (legR) legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, 0.1);
                if (head) {
                    head.rotation.y = Math.sin(time * 1.5 + idSeed) * 0.1;
                    head.rotation.x = Math.sin(time * 0.8 + idSeed) * 0.05;
                }
            }

            if (state === 'MOVING') {
                // Full walk cycle with arm swing and bob
                const speed = 12;
                const walk = Math.sin(time * speed);
                const lerpFactor = 0.2;

                if (armL) armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, walk * 0.6, lerpFactor);
                if (armR) armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, -walk * 0.6, lerpFactor);

                if (legL) legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, -walk * 0.6, lerpFactor);
                if (legR) legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, walk * 0.6, lerpFactor);

                meshGroup.position.y += Math.abs(Math.sin(time * (speed * 2))) * 0.01;
            }
            else if (state === 'WORKING') {
                const work = Math.sin(time * 12);
                if (armL) armL.rotation.x = Math.max(0, work) * 0.8;
                meshGroup.position.y += Math.abs(Math.sin(time * 12)) * 0.03;
            }
            else if (state === 'IDLE') {
                const breathe = Math.sin(time * 2 + idSeed) * 0.005;
                meshGroup.position.y += breathe;
                // Looking around
                if (head) {
                    const look = Math.sin(time * 0.5 + idSeed) * 0.2;
                    head.rotation.y = look;
                }
            }
            else if (state === 'SOCIALIZING') {
                const chatBounce = Math.abs(Math.sin(time * 10 + idSeed)) * 0.03;
                meshGroup.position.y += chatBounce;
                if (armL) armL.rotation.x = Math.sin(time * 8 + idSeed) * 0.3;
            }
        });

        // 2. Selection Ring
        if (this.selectedAgentId && this.agentMeshes.has(this.selectedAgentId)) {
            const agent = this.agentMeshes.get(this.selectedAgentId)!;
            this.agentSelectionRing.position.set(agent.position.x, agent.position.y + 0.02, agent.position.z);
            this.agentSelectionRing.scale.setScalar(1 + Math.sin(time * 10) * 0.05);
            this.agentSelectionRing.visible = true;
        } else {
            this.agentSelectionRing.visible = false;
        }

        // 3. Eagle - Natural Circular Soaring
        if (this.eagle) {
            // Hide eagle when zoomed out for performance
            if (zoomLevel > LOD_LOW) {
                this.eagle.visible = false;
                return;
            }
            this.eagle.visible = true;

            // Init angle if not present
            if (typeof this.eagle.userData.angle === 'undefined') {
                this.eagle.userData.angle = 0;
            }

            // Slower speed (approx 30s per orbit) to look natural
            const orbitSpeed = 0.2 * delta;
            this.eagle.userData.angle += orbitSpeed;
            const t = this.eagle.userData.angle;

            // Parametric Orbit: Large circle with drifting radius
            const rBase = 16;
            const rVar = Math.sin(time * 0.1) * 6; // Breathing radius (in/out)
            const r = rBase + rVar;

            // Offset orbit center slightly to make it wander over the map over long periods
            const cx = Math.sin(time * 0.05) * 5;
            const cz = Math.cos(time * 0.07) * 5;

            const x = cx + Math.cos(t) * r;
            const z = cz + Math.sin(t) * r;

            // Altitude: Thermals (Sine waves for gliding up/down)
            const yBase = 32;
            const yVar = Math.sin(time * 0.3) * 2 + Math.sin(time * 0.7) * 1;
            const y = yBase + yVar;

            this.eagle.position.set(x, y, z);

            // Rotation: Face tangent to the circle
            // Tangent vector of circle (cos, sin) is (-sin, cos)
            const dx = -Math.sin(t);
            const dz = Math.cos(t);
            const targetRot = Math.atan2(dx, dz);

            // Smooth rotation update
            let rotDiff = targetRot - this.eagle.rotation.y;
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            this.eagle.rotation.y += rotDiff * 0.1;

            // Banking (Roll into the turn)
            // Constant slight bank for circular motion + slight wobble
            this.eagle.rotation.z = -0.3 + Math.sin(time * 0.5) * 0.05;
            this.eagle.rotation.x = Math.sin(time * 0.25) * 0.05; // Gentle pitch

            // Wing animation - Soaring vs Flapping
            if (zoomLevel <= LOD_LOW) {
                // Flap mostly when climbing (simulating effort)
                const climbRate = Math.cos(time * 0.3); // Derivative of main yVar component
                let flapAmp = 0.05; // Gliding base
                let flapFreq = 1.5;

                if (climbRate > 0.2) {
                    // Climbing -> Flap harder
                    flapAmp = 0.3;
                    flapFreq = 4.0;
                }

                const flap = Math.sin(time * flapFreq) * flapAmp;
                const leftWing = this.eagle.getObjectByName('wingL');
                const rightWing = this.eagle.getObjectByName('wingR');
                if (leftWing) leftWing.rotation.z = flap;
                if (rightWing) rightWing.rotation.z = -flap;
            }
        }
    }

    public getMeshes(): THREE.Object3D[] {
        return Array.from(this.agentMeshes.values());
    }
}
