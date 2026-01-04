/**
 * Simple Agent System
 * A streamlined, easy-to-read Finite State Machine for colony agents.
 * This version uses Synchronous Pathfinding for immediate response.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { Agent, GameState, GridTile, BuildingType, SfxType } from '../../../types';
import { GRID_SIZE, findPath } from '../algorithms/Pathfinding';
import { JobSystem, PathfindResult } from '../../jobs';
import { ConstructionSystem } from './ConstructionSystem';
import { PathPool } from '../../utils/PathPool';

// Configuration
const CONFIG = {
    SPEED: 3.5,            // Tiles per second
    THINK_INTERVAL: 60,    // Ticks between AI decisions (1 second at 60Hz)
    NEED_CRITICAL: 30,     // Threshold to seek help
    NEED_SATISFIED: 95,    // Threshold to stop seeking help
};

export class AgentSystem extends BaseSimSystem {
    readonly id = 'agents';
    readonly priority = 100;
    private tickCounter = 0;
    private jobSystem: JobSystem;
    private constructionSystem: ConstructionSystem;

    constructor(jobSystem: JobSystem, constructionSystem: ConstructionSystem) {
        super();
        this.jobSystem = jobSystem;
        this.constructionSystem = constructionSystem;
    }

    /** Compatibility for legacy pathfinding results (unused in simple mode) */
    public receiveJobResult(result: PathfindResult, state: GameState): void {
        // Simple mode uses synchronous pathfinding
    }

    tick(ctx: FixedContext, state: GameState): void {
        this.tickCounter++;
        const { agents, grid } = state;
        if (!agents || !grid) return;

        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];

            // 1. Update Needs (Decay)
            this.updateNeeds(agent, ctx.fixedDt);

            // 2. Decide what to do (AI)
            // We think if we are IDLE or if it's been a second.
            // BUGFIX: Previously IDLE agents thought EVERY TICK. If pathfinding failed, 
            // 50 agents would run 5000 iterations each every frame = Freeze.
            if (this.tickCounter % CONFIG.THINK_INTERVAL === 0) {
                this.updateAI(agent, state);
            }

            // 3. Act based on current state
            this.executeState(agent, state, ctx.fixedDt);

            // 4. Update Visuals (must match logic position for the renderer)
            agent.visualX = agent.x;
            agent.visualZ = agent.z;
        }
    }

    private updateNeeds(agent: Agent, dt: number): void {
        // Slow decay unless sleeping/eating
        if (agent.state !== 'SLEEPING') agent.energy = Math.max(0, agent.energy - 0.2 * dt);
        if (agent.state !== 'EATING') agent.hunger = Math.max(0, agent.hunger - 0.15 * dt);
        agent.mood = Math.max(0, agent.mood - 0.1 * dt);
    }

    private updateAI(agent: Agent, state: GameState): void {
        // Don't interrupt persistent actions (work/eat/sleep) until they are done
        if (['SLEEPING', 'EATING', 'WORKING'].includes(agent.state)) return;

        // --- PRIORITY 1: Manual Commands ---
        if (agent.currentJobId?.startsWith('manual_')) {
            // If we are MOVING to a manual target, keep going.
            // If we are already there and IDLE, it means we finished.
            if (agent.state === 'MOVING') return;
        }

        // --- PRIORITY 2: Critical Needs ---
        if (agent.energy < CONFIG.NEED_CRITICAL) {
            const bed = this.findNearest(agent, BuildingType.STAFF_QUARTERS, state.grid);
            if (bed !== null) {
                this.goTo(agent, bed, 'sys_sleep', state.grid);
                return;
            }
        }
        if (agent.hunger < CONFIG.NEED_CRITICAL) {
            const food = this.findNearest(agent, BuildingType.CANTEEN, state.grid);
            if (food !== null) {
                this.goTo(agent, food, 'sys_eat', state.grid);
                return;
            }
        }

        // --- PRIORITY 3: Work (Construction) ---
        const buildJob = state.jobs.find(j =>
            j.type === 'BUILD' &&
            (!j.assignedAgentId || j.assignedAgentId === agent.id)
        );
        if (buildJob) {
            this.goTo(agent, buildJob.targetTileId, buildJob.id, state.grid);
            return;
        }

        // --- PRIORITY 4: Idleness / Wander ---
        if (agent.state === 'IDLE' && Math.random() < 0.3) {
            const wanderTarget = this.getRandomNearby(agent);
            this.goTo(agent, wanderTarget, 'sys_wander', state.grid);
        }
    }

    private executeState(agent: Agent, state: GameState, dt: number): void {
        switch (agent.state) {
            case 'MOVING':
                this.moveAlongPath(agent, dt);
                break;

            case 'SLEEPING':
                agent.energy = Math.min(100, agent.energy + 15 * dt);
                if (agent.energy >= CONFIG.NEED_SATISFIED) this.finishActivity(agent);
                break;

            case 'EATING':
                agent.hunger = Math.min(100, agent.hunger + 20 * dt);
                if (agent.hunger >= CONFIG.NEED_SATISFIED) this.finishActivity(agent);
                break;

            case 'WORKING':
                this.performWork(agent, state);
                break;
        }
    }

    private moveAlongPath(agent: Agent, dt: number): void {
        if (!agent.path || agent.path.length === 0) {
            // Arrival ceremony: Snap to grid coordinate
            agent.x = Math.round(agent.x);
            agent.z = Math.round(agent.z);

            // Transition to the actual activity we traveled for
            if (agent.currentJobId === 'sys_sleep') agent.state = 'SLEEPING';
            else if (agent.currentJobId === 'sys_eat') agent.state = 'EATING';
            else if (agent.currentJobId?.startsWith('build_') || agent.currentJobId?.includes('mine')) agent.state = 'WORKING';
            else this.finishActivity(agent); // Wander or manual move finished
            return;
        }

        const next = agent.path[0];
        const tx = next % GRID_SIZE;
        const ty = Math.floor(next / GRID_SIZE);

        const dx = tx - agent.x;
        const dy = ty - agent.z;
        const distSq = dx * dx + dy * dy;
        const frameStep = CONFIG.SPEED * dt;

        if (distSq < (frameStep * frameStep)) {
            // Snap to node and pop it
            agent.x = tx;
            agent.z = ty;
            agent.path.shift();

            if (agent.path.length === 0) {
                PathPool.release(agent.path);
                agent.path = null;
            }
        } else {
            // Linear lerp towards next node
            const dist = Math.sqrt(distSq);
            agent.x += (dx / dist) * frameStep;
            agent.z += (dy / dist) * frameStep;
        }
    }

    private performWork(agent: Agent, state: GameState): void {
        const jobIdx = state.jobs.findIndex(j => j.id === agent.currentJobId);
        if (jobIdx === -1) {
            this.finishActivity(agent);
            return;
        }

        const job = state.jobs[jobIdx];
        const tile = state.grid[job.targetTileId];

        if (tile.isUnderConstruction) {
            // Use specialized system to handle multi-tile buildings
            const amount = (1 + agent.skills.construction / 10);
            const finished = this.constructionSystem.progressConstruction(job.targetTileId, amount, state);

            if (finished) {
                state.jobs.splice(jobIdx, 1);
                this.finishActivity(agent);
            }
        } else if (job.type === 'MINE') {
            // Instant mine for now
            state.resources.minerals += 15 * (1 + agent.skills.mining / 5);
            state.pendingEffects.push({ type: 'FX', fxType: 'MINING', index: tile.id });
            state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.MINING_HIT });

            // Skill XP
            agent.skills.mining += 0.5;

            // Deplete or finish
            state.jobs.splice(jobIdx, 1);
            this.finishActivity(agent);

            // Deplete vein?
            if (tile.foliage === 'GOLD_VEIN' && Math.random() < 0.1) {
                tile.foliage = 'NONE';
                state.pendingEffects.push({ type: 'GRID_UPDATE', updates: [tile] });
            }
        } else {
            // Already finished or site removed
            state.jobs.splice(jobIdx, 1);
            this.finishActivity(agent);
        }
    }

    private finishActivity(agent: Agent): void {
        agent.state = 'IDLE';
        agent.currentJobId = null;
        agent.targetTileId = null;
        PathPool.release(agent.path);
        agent.path = null;
    }

    private goTo(agent: Agent, targetIdx: number, jobId: string, grid: GridTile[]): void {
        const ax = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(agent.x)));
        const az = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(agent.z)));
        const startIdx = az * GRID_SIZE + ax;

        // If we're already there, start the action immediately
        if (startIdx === targetIdx) {
            agent.currentJobId = jobId;
            if (jobId === 'sys_sleep') agent.state = 'SLEEPING';
            else if (jobId === 'sys_eat') agent.state = 'EATING';
            else if (jobId.startsWith('build_')) agent.state = 'WORKING';
            else agent.state = 'IDLE';
            return;
        }

        try {
            const path = findPath(startIdx, targetIdx, grid);
            if (path && path.length > 0) {
                PathPool.release(agent.path); // Free old path
                agent.path = path;
                agent.state = 'MOVING';
                agent.currentJobId = jobId;
                agent.targetTileId = targetIdx;
            } else {
                PathPool.release(agent.path);
                agent.path = null;
                agent.state = 'IDLE';
            }
        } catch (e) {
            console.error(`[AgentSystem] Pathfinding crashed for ${agent.name}:`, e);
            agent.state = 'IDLE';
        }
    }

    private findNearest(agent: Agent, type: BuildingType, grid: GridTile[]): number | null {
        let bestIdx = null;
        let minDist = Infinity;
        const ax = Math.floor(agent.x);
        const az = Math.floor(agent.z);

        for (let i = 0; i < grid.length; i++) {
            if (grid[i].buildingType === type && !grid[i].isUnderConstruction) {
                const tx = i % GRID_SIZE;
                const ty = Math.floor(i / GRID_SIZE);
                const d = Math.abs(tx - ax) + Math.abs(ty - az);
                if (d < minDist) {
                    minDist = d;
                    bestIdx = i;
                }
            }
        }
        return bestIdx;
    }

    private getRandomNearby(agent: Agent): number {
        const range = 6;
        const rx = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(agent.x + (Math.random() - 0.5) * range * 2)));
        const rz = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(agent.z + (Math.random() - 0.5) * range * 2)));
        return rz * GRID_SIZE + rx;
    }
}
