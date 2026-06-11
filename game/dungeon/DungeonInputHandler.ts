import * as THREE from 'three';
import { StateManager } from '../../engine/state/StateManager';
import { DungeonEngine } from '../../engine/dungeon/DungeonEngine';

export type DungeonInteractionMode = 'mine' | 'build_support' | 'build_recharger';
type DungeonMinerType = 'driller' | 'excavator' | 'foreman';

const MINER_COSTS: Record<DungeonMinerType, { agt: number; gems: number }> = {
    driller: { agt: 250, gems: 0 },
    excavator: { agt: 600, gems: 0 },
    foreman: { agt: 900, gems: 5 },
};

const MODE_LABELS: Record<DungeonInteractionMode, string> = {
    mine: 'Mine blocks',
    build_support: 'Place supports',
    build_recharger: 'Place rechargers',
};

export class DungeonInputHandler {
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private stateManager: StateManager;
    private dungeonEngine: DungeonEngine | null = null;
    private selectionMesh: THREE.Mesh;
    private mode: DungeonInteractionMode = 'mine';
    private camera: THREE.Camera | null = null;
    private meshGroup: THREE.Group | null = null;
    private uiActionHandler: ((event: Event) => void) | null = null;

    // Energy threshold for assigning miners
    private ENERGY_LOW_THRESHOLD = 20;

    constructor(stateManager: StateManager, scene: THREE.Scene) {
        this.stateManager = stateManager;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Create selection highlight mesh
        const selectionGeometry = new THREE.BoxGeometry(1.02, 1.02, 1.02);
        const selectionMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        this.selectionMesh = new THREE.Mesh(selectionGeometry, selectionMaterial);
        this.selectionMesh.visible = false;
        scene.add(this.selectionMesh);

        if (typeof window !== 'undefined') {
            this.uiActionHandler = (event: Event) => this.handleUiAction(event);
            window.addEventListener('aureus:dungeon-action', this.uiActionHandler);
        }
    }

    /**
     * Set the dungeon engine instance (called when dungeon is initialized)
     */
    public setDungeonEngine(engine: DungeonEngine): void {
        this.dungeonEngine = engine;
    }

    /**
     * Set the mesh group to raycast against
     */
    public setMeshGroup(group: THREE.Group): void {
        this.meshGroup = group;
    }

    /**
     * Set the active camera for raycasting
     */
    public setCamera(camera: THREE.Camera): void {
        this.camera = camera;
    }

    /**
     * Set the interaction mode
     */
    public setMode(mode: DungeonInteractionMode): void {
        this.mode = mode;
        this.selectionMesh.visible = false;
        this.appendLog(`Mine console: ${MODE_LABELS[mode]}.`);
    }

    /**
     * Get current mode
     */
    public getMode(): DungeonInteractionMode {
        return this.mode;
    }

    /**
     * Handle click interaction
     */
    public handleClick(clientX: number, clientY: number): void {
        if (!this.camera || !this.dungeonEngine || !this.meshGroup) return;

        // Convert mouse position to normalized device coordinates
        this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        // Raycast
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.meshGroup.children, true);

        if (intersects.length === 0) {
            this.selectionMesh.visible = false;
            return;
        }

        const intersect = intersects[0];

        // Calculate block position
        // Offset by face normal to get the clicked block (not the adjacent one)
        const point = intersect.point.clone().add(
            intersect.face!.normal.clone().multiplyScalar(-0.5)
        );

        const tx = Math.floor(point.x);
        const ty = Math.floor(point.y);
        const tz = Math.floor(point.z);

        const blockId = this.dungeonEngine.getBlockId(tx, ty, tz);

        if (this.mode === 'mine') {
            this.handleMineMode(tx, ty, tz, blockId);
        } else {
            this.handleBuildMode(tx, ty, tz, blockId);
        }
    }

    /**
     * Handle mining interaction
     */
    private handleMineMode(x: number, y: number, z: number, blockId: number): void {
        const state = this.stateManager.getState();

        // Can't mine air or heart, and must be above ground level
        if (blockId === DungeonEngine.BLOCK.AIR ||
            blockId === DungeonEngine.BLOCK.HEART ||
            y <= 0) {
            this.selectionMesh.visible = false;
            return;
        }

        // Show selection
        this.selectionMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
        this.selectionMesh.visible = true;

        // Find an idle miner with enough energy
        const eligibleMiner = state.dungeon.miners.find(
            m => m.state === 'idle' && m.energy > this.ENERGY_LOW_THRESHOLD
        );

        if (!eligibleMiner) {
            // No available miners
            state.dungeon.logs.push('No available miners. Hire more or wait for recharge.');
            this.stateManager.markDirty('dungeon');
            return;
        }

        // Assign miner to target block
        eligibleMiner.state = 'walking';
        eligibleMiner.targetBlock = { x, y, z };
        state.dungeon.logs.push(`Assigned ${eligibleMiner.type} to mine ${x}, ${z}.`);
        this.stateManager.markDirty('dungeon');
    }

    /**
     * Handle building placement
     */
    private handleBuildMode(x: number, y: number, z: number, blockId: number): void {
        const state = this.stateManager.getState();

        // Can only build in air blocks at ground level (y=1)
        if (blockId !== DungeonEngine.BLOCK.AIR || y !== 1) {
            this.selectionMesh.visible = false;
            return;
        }

        if (this.mode === 'build_support') {
            // Support pillar costs stone
            if (state.resources.stone < 50) {
                state.dungeon.logs.push('Not enough stone to build support pillar.');
                this.stateManager.markDirty('dungeon');
                return;
            }

            // Deduct cost
            state.resources.stone -= 50;

            // Place support pillar (3 blocks tall)
            this.dungeonEngine!.setBlockId(x, 1, z, DungeonEngine.BLOCK.SUPPORT);
            this.dungeonEngine!.setBlockId(x, 2, z, DungeonEngine.BLOCK.SUPPORT);
            this.dungeonEngine!.setBlockId(x, 3, z, DungeonEngine.BLOCK.SUPPORT);

            // Add to buildings list
            state.dungeon.buildings.push({
                id: `support_${Date.now()}`,
                type: 'support',
                position: { x, y: 1, z }
            });

            state.dungeon.logs.push('Support pillar placed.');
            this.stateManager.markDirty('dungeon', 'resources');

        } else if (this.mode === 'build_recharger') {
            // Recharger costs AGT and gems
            if (state.resources.agt < 100 || state.resources.gems < 50) {
                state.dungeon.logs.push('Not enough resources for recharger (100 AGT, 50 gems).');
                this.stateManager.markDirty('dungeon');
                return;
            }

            // Deduct cost
            state.resources.agt -= 100;
            state.resources.gems -= 50;

            // Place recharger
            this.dungeonEngine!.setBlockId(x, 1, z, DungeonEngine.BLOCK.RECHARGER);

            // Add to buildings list
            state.dungeon.buildings.push({
                id: `recharger_${Date.now()}`,
                type: 'recharger',
                position: { x, y: 1, z }
            });

            state.dungeon.logs.push('Recharger placed.');
            this.stateManager.markDirty('dungeon', 'resources');
        }
    }

    /**
     * Handle hover (for preview/feedback)
     */
    public handleHover(clientX: number, clientY: number): void {
        if (!this.camera || !this.meshGroup) return;

        this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.meshGroup.children, true);

        if (intersects.length > 0 && this.mode !== 'mine') {
            const intersect = intersects[0];
            const point = intersect.point.clone().add(
                intersect.face!.normal.clone().multiplyScalar(0.5)
            );

            const tx = Math.floor(point.x);
            const ty = Math.floor(point.y);
            const tz = Math.floor(point.z);

            // Show preview for build mode
            this.selectionMesh.position.set(tx + 0.5, ty + 0.5, tz + 0.5);
            this.selectionMesh.visible = true;
        } else {
            // Hide selection when not hovering in build mode
            if (this.mode !== 'mine') {
                this.selectionMesh.visible = false;
            }
        }
    }

    private handleUiAction(event: Event): void {
        const detail = (event as CustomEvent<{ type?: string; payload?: any }>).detail || {};
        const payload = detail.payload || {};

        if (detail.type === 'SET_MODE') {
            const mode = payload.mode as DungeonInteractionMode;
            if (mode === 'mine' || mode === 'build_support' || mode === 'build_recharger') {
                this.setMode(mode);
                this.pushSfx('UI_CLICK');
            }
            return;
        }

        if (detail.type === 'HIRE_MINER') {
            this.hireMiner((payload.minerType || 'driller') as DungeonMinerType);
            return;
        }

        if (detail.type === 'SURFACE_RESOURCES') {
            this.surfaceResources();
        }
    }

    private hireMiner(minerType: DungeonMinerType): void {
        const state = this.stateManager.getState();
        if (!state.dungeon.unlocked) {
            this.appendLog('Below Sector is locked. Build a Survey Drill first.');
            this.pushSfx('ERROR');
            return;
        }

        const cost = MINER_COSTS[minerType] || MINER_COSTS.driller;
        if (state.resources.agt < cost.agt || state.resources.gems < cost.gems) {
            this.appendLog(`Not enough resources to hire ${minerType}.`);
            this.pushSfx('ERROR');
            return;
        }

        state.resources.agt -= cost.agt;
        state.resources.gems -= cost.gems;

        const midX = Math.floor(state.dungeon.gridSize.x / 2);
        const midZ = Math.floor(state.dungeon.gridSize.z / 2);
        const offset = state.dungeon.miners.length % 5;
        state.dungeon.miners.push({
            id: `miner_${Date.now()}_${state.dungeon.miners.length}`,
            type: minerType,
            position: { x: midX + 0.5 + (offset - 2) * 0.35, y: 1, z: midZ + 0.5 },
            state: 'idle',
            energy: 100,
            miningProgress: 0,
        });

        this.appendLog(`${minerType} hired and ready at the heart chamber.`);
        this.pushSfx('UI_COIN');
        this.stateManager.markDirty('dungeon', 'resources', 'pendingEffects');
        this.stateManager.notifyIfDirty();
    }

    private surfaceResources(): void {
        const state = this.stateManager.getState();
        const gold = state.dungeon.gold || 0;
        const gems = state.dungeon.gems || 0;
        const mana = state.dungeon.mana || 0;
        if (gold <= 0 && gems <= 0 && mana <= 0) {
            this.appendLog('No underground valuables are ready to surface.');
            this.pushSfx('ERROR');
            return;
        }

        const agtGain = Math.round(gold * 8 + mana * 3);
        state.resources.agt += agtGain;
        state.resources.gems += gems;
        state.dungeon.gold = 0;
        state.dungeon.gems = 0;
        state.dungeon.mana = 0;

        this.appendLog(`Surfaced valuables: +${agtGain} AGT, +${gems} gems.`);
        this.pushSfx('COMPLETE');
        this.stateManager.markDirty('dungeon', 'resources', 'pendingEffects');
        this.stateManager.notifyIfDirty();
    }

    private appendLog(message: string): void {
        const state = this.stateManager.getState();
        state.dungeon.logs.push(message);
        state.dungeon.logs = state.dungeon.logs.slice(-10);
        this.stateManager.markDirty('dungeon');
    }

    private pushSfx(sfx: string): void {
        const state = this.stateManager.getState();
        state.pendingEffects.push({ type: 'AUDIO', sfx } as any);
        this.stateManager.markDirty('pendingEffects');
    }

    /**
     * Cleanup
     */
    public dispose(): void {
        if (this.uiActionHandler && typeof window !== 'undefined') {
            window.removeEventListener('aureus:dungeon-action', this.uiActionHandler);
            this.uiActionHandler = null;
        }
        this.selectionMesh.geometry.dispose();
        (this.selectionMesh.material as THREE.Material).dispose();
        this.selectionMesh.parent?.remove(this.selectionMesh);
    }
}
