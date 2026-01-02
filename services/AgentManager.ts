
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { Agent, AgentRole } from '../types';
import { createAgentGroup } from '../voxels/Agent';
import { createEagle } from '../voxels/Eagle';

// Status indicator configuration
const STATUS_CONFIG = {
    height: 0.7,           // Height above agent
    scale: 0.15,           // Base scale of indicators
    warningThreshold: 30,  // Show warning below this need level
    criticalThreshold: 15, // Critical warning level
};

// Emoji/Icon mappings for states and roles
const STATE_ICONS: Record<string, string> = {
    'MOVING': '🚶',
    'WORKING': '🔨',
    'SLEEPING': '💤',
    'EATING': '🍔',
    'RELAXING': '☕',
    'SOCIALIZING': '💬',
    'PATROLLING': '👁️',
    'IDLE': '⏳',
    'OFF_DUTY': '🌙',
};

const ROLE_ICONS: Record<AgentRole, { icon: string; color: string }> = {
    'ENGINEER': { icon: '🔧', color: '#3b82f6' },
    'MINER': { icon: '⛏️', color: '#ef4444' },
    'BOTANIST': { icon: '🌿', color: '#22c55e' },
    'SECURITY': { icon: '🛡️', color: '#e11d48' },
    'WORKER': { icon: '👷', color: '#f59e0b' },
    'ILLEGAL_MINER': { icon: '👤', color: '#0f172a' },
};

const WARNING_ICONS = {
    energy: '😴',
    hunger: '🍽️',
    mood: '😟',
};

export class AgentManager {
    private scene: THREE.Scene;
    private gridSize: number;

    public agentMeshes: Map<string, THREE.Group> = new Map();
    private statusSprites: Map<string, THREE.Group> = new Map();
    private spriteTextures: Map<string, THREE.CanvasTexture> = new Map();
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

    /**
     * Create a canvas texture with an emoji/icon
     */
    private createIconTexture(icon: string, bgColor?: string): THREE.CanvasTexture {
        const cacheKey = `${icon}_${bgColor || 'none'}`;
        if (this.spriteTextures.has(cacheKey)) {
            return this.spriteTextures.get(cacheKey)!;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;

        // Background circle (optional)
        if (bgColor) {
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            ctx.arc(32, 32, 30, 0, Math.PI * 2);
            ctx.fill();

            // Border
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Draw emoji
        ctx.font = bgColor ? '28px Arial' : '40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(icon, 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        this.spriteTextures.set(cacheKey, texture);
        return texture;
    }

    /**
     * Create a status indicator group for an agent
     */
    private createStatusGroup(agent: Agent): THREE.Group {
        const group = new THREE.Group();
        group.name = 'statusIndicators';

        // Role badge (always visible, positioned left)
        const roleConfig = ROLE_ICONS[agent.type] || ROLE_ICONS['WORKER'];
        const roleMaterial = new THREE.SpriteMaterial({
            map: this.createIconTexture(roleConfig.icon, roleConfig.color),
            transparent: true,
            depthTest: false,
        });
        const roleSprite = new THREE.Sprite(roleMaterial);
        roleSprite.name = 'roleSprite';
        roleSprite.scale.setScalar(STATUS_CONFIG.scale * 0.8);
        roleSprite.position.set(-0.12, 0, 0);
        group.add(roleSprite);

        // State indicator (center)
        const stateMaterial = new THREE.SpriteMaterial({
            map: this.createIconTexture(STATE_ICONS['IDLE']),
            transparent: true,
            depthTest: false,
        });
        const stateSprite = new THREE.Sprite(stateMaterial);
        stateSprite.name = 'stateSprite';
        stateSprite.scale.setScalar(STATUS_CONFIG.scale);
        stateSprite.position.set(0.05, 0, 0);
        group.add(stateSprite);

        // Warning indicator (right, only visible when needed)
        const warningMaterial = new THREE.SpriteMaterial({
            map: this.createIconTexture('⚠️'),
            transparent: true,
            depthTest: false,
            opacity: 0,
        });
        const warningSprite = new THREE.Sprite(warningMaterial);
        warningSprite.name = 'warningSprite';
        warningSprite.scale.setScalar(STATUS_CONFIG.scale * 0.7);
        warningSprite.position.set(0.2, 0, 0);
        warningSprite.visible = false;
        group.add(warningSprite);

        return group;
    }

    /**
     * Update status indicators based on agent state
     */
    private updateStatusIndicators(agent: Agent, statusGroup: THREE.Group, time: number): void {
        const stateSprite = statusGroup.getObjectByName('stateSprite') as THREE.Sprite;
        const warningSprite = statusGroup.getObjectByName('warningSprite') as THREE.Sprite;

        // Update state icon
        if (stateSprite) {
            const stateIcon = STATE_ICONS[agent.state] || STATE_ICONS['IDLE'];
            (stateSprite.material as THREE.SpriteMaterial).map = this.createIconTexture(stateIcon);
            (stateSprite.material as THREE.SpriteMaterial).needsUpdate = true;
        }

        // Check for warnings
        let warningIcon = '';
        let showWarning = false;

        if (agent.energy < STATUS_CONFIG.warningThreshold) {
            warningIcon = WARNING_ICONS.energy;
            showWarning = true;
        } else if (agent.hunger < STATUS_CONFIG.warningThreshold) {
            warningIcon = WARNING_ICONS.hunger;
            showWarning = true;
        } else if (agent.mood < STATUS_CONFIG.warningThreshold) {
            warningIcon = WARNING_ICONS.mood;
            showWarning = true;
        }

        if (warningSprite) {
            if (showWarning) {
                warningSprite.visible = true;
                (warningSprite.material as THREE.SpriteMaterial).map = this.createIconTexture(warningIcon);
                (warningSprite.material as THREE.SpriteMaterial).opacity = 0.6 + Math.sin(time * 8) * 0.4; // Pulsing
                (warningSprite.material as THREE.SpriteMaterial).needsUpdate = true;

                // Critical warning - faster pulse, brighter
                const isCritical = agent.energy < STATUS_CONFIG.criticalThreshold ||
                    agent.hunger < STATUS_CONFIG.criticalThreshold;
                if (isCritical) {
                    (warningSprite.material as THREE.SpriteMaterial).opacity = 0.8 + Math.sin(time * 15) * 0.2;
                    warningSprite.scale.setScalar(STATUS_CONFIG.scale * 0.8);
                } else {
                    warningSprite.scale.setScalar(STATUS_CONFIG.scale * 0.7);
                }
            } else {
                warningSprite.visible = false;
            }
        }

        // Floating animation
        statusGroup.position.y = STATUS_CONFIG.height + Math.sin(time * 2) * 0.02;
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
                // Also remove status sprite
                const statusGroup = this.statusSprites.get(agent.id);
                if (statusGroup) {
                    this.scene.remove(statusGroup);
                    this.statusSprites.delete(agent.id);
                }
                meshGroup = undefined;
            }

            if (!meshGroup) {
                meshGroup = createAgentGroup(agent);
                // Attach ID for raycasting identification in InputManager
                meshGroup.userData.agentId = agent.id;
                meshGroup.userData.role = agent.type;
                this.scene.add(meshGroup);
                this.agentMeshes.set(agent.id, meshGroup);

                // Create status indicator group
                const statusGroup = this.createStatusGroup(agent);
                this.scene.add(statusGroup);
                this.statusSprites.set(agent.id, statusGroup);
            }

            // Calculate world position
            const x = agent.visualX ?? agent.x;
            const z = agent.visualZ ?? agent.z;
            const worldX = x - offset;
            const worldZ = z - offset;

            // Determine Target Rotation - Face the direction of travel
            let targetRot = meshGroup.userData.targetRot ?? meshGroup.rotation.y;

            // Store previous position for direction calculation
            const prevX = meshGroup.userData.prevX ?? worldX;
            const prevZ = meshGroup.userData.prevZ ?? worldZ;

            if (agent.state === 'MOVING') {
                // Option 1: Use path's next waypoint if available
                if (agent.path && agent.path.length > 0) {
                    const nextWaypoint = agent.path[0];
                    const nextX = (nextWaypoint % this.gridSize) - offset;
                    const nextZ = Math.floor(nextWaypoint / this.gridSize) - offset;
                    targetRot = Math.atan2(nextX - worldX, nextZ - worldZ);
                }
                // Option 2: Fall back to using travel direction from position delta
                else {
                    const dx = worldX - prevX;
                    const dz = worldZ - prevZ;
                    // Only update rotation if we've actually moved
                    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
                        targetRot = Math.atan2(dx, dz);
                    }
                }
            }
            // When WORKING, face the target tile (building site, resource, etc.)
            else if (agent.state === 'WORKING' && agent.targetTileId !== null) {
                const tx = (agent.targetTileId % this.gridSize) - offset;
                const tz = Math.floor(agent.targetTileId / this.gridSize) - offset;
                targetRot = Math.atan2(tx - worldX, tz - worldZ);
            }
            // When SOCIALIZING, face towards the center of social area
            else if (agent.state === 'SOCIALIZING' && agent.targetTileId !== null) {
                const tx = (agent.targetTileId % this.gridSize) - offset;
                const tz = Math.floor(agent.targetTileId / this.gridSize) - offset;
                targetRot = Math.atan2(tx - worldX, tz - worldZ);
            }

            meshGroup.userData = {
                ...meshGroup.userData,
                targetPos: new THREE.Vector3(worldX, 0, worldZ),
                agentState: agent.state,
                targetRot: targetRot,
                prevX: worldX,
                prevZ: worldZ,
                // Store agent data for status updates
                agentData: agent
            };
        });

        // Clean up removed agents
        this.agentMeshes.forEach((m, id) => {
            if (!seen.has(id)) {
                this.scene.remove(m);
                this.agentMeshes.delete(id);

                // Also remove status sprite
                const statusGroup = this.statusSprites.get(id);
                if (statusGroup) {
                    this.scene.remove(statusGroup);
                    this.statusSprites.delete(id);
                }
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
            // Always smoothly rotate to face the target direction
            const targetRot = meshGroup.userData.targetRot;
            if (targetRot !== undefined && !isNaN(targetRot)) {
                // Normalize the difference to handle wrap-around at ±π
                let diff = targetRot - meshGroup.rotation.y;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                meshGroup.rotation.y += THREE.MathUtils.lerp(0, diff, 0.12);
            }

            // --- STATUS INDICATOR UPDATE ---
            const statusGroup = this.statusSprites.get(agentId);
            if (statusGroup) {
                // Position the status indicator above the agent
                statusGroup.position.x = meshGroup.position.x;
                statusGroup.position.z = meshGroup.position.z;

                // Get agent data and update indicators
                const agentData = meshGroup.userData.agentData as Agent | undefined;
                if (agentData) {
                    this.updateStatusIndicators(agentData, statusGroup, time);
                    // Base height follows agent
                    statusGroup.position.y = meshGroup.position.y + STATUS_CONFIG.height;
                }

                // Hide status indicators when zoomed out for performance
                statusGroup.visible = zoomLevel <= 50;
            }

            // Get agent state for animation logic
            const state = meshGroup.userData.agentState;

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
