/**
 * Agent Simulation System
 * Handles agent AI, Movement, and Needs
 * "The Brain and Legs of the Colony"
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { Agent, GameState, GridTile, BuildingType, AgentRole } from '../../../types';
import { GRID_SIZE } from '../algorithms/Pathfinding';


// Configuration
const CONFIG = {
    SPEED: { BASE: 4.0 }, // Tiles per second
    DECISION_INTERVAL: 60, // Ticks between AI thinks
};

import { JobSystem, createJob, PathfindResult } from '../../jobs';
import { findPath } from '../algorithms/Pathfinding';
import { calculateUtilityScores } from './AgentAI';

export class AgentSystem extends BaseSimSystem {
    readonly id = 'agents';
    readonly priority = 100;

    private jobSystem: JobSystem;
    private tickCounter = 0; // Internal tick counter

    /**
     * Staggered AI updates
     * Key: AgentID, Value: Tick offset
     */
    private agentOffsets: Map<string, number> = new Map();

    /**
     * Pending Pathfinding Requests
     * Key: JobID, Value: AgentID
     */
    private pendingPaths: Map<string, string> = new Map();

    constructor(jobSystem: JobSystem) {
        super();
        this.jobSystem = jobSystem;
    }

    /**
     * Update agents
     * This runs every fixed step (60Hz)
     */
    tick(ctx: FixedContext, state: GameState): void {
        this.tickCounter++; // Increment internal tick counter

        const agents = state.agents;
        const grid = state.grid;
        if (!agents || !grid) return;

        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];

            // 1. NEEDS SIMULATION (Per Frame)
            // DEBUG: Force Wiggle to check Render Sync
            // agent.x += Math.sin(ctx.time * 5) * 0.02;
            // agent.visualX = agent.x;

            if (this.updateNeeds(agent, ctx.fixedDt, state)) {
                // Agent died
                agents.splice(i, 1);
                i--;
                continue;
            }

            // 2. AI DECISION (Periodic)
            // Initialize offset if missing
            if (!this.agentOffsets.has(agent.id)) this.agentOffsets.set(agent.id, Math.floor(Math.random() * 60));

            // Check if it's time to think or if we desperately need to think (IDLE)
            const offset = this.agentOffsets.get(agent.id)!;
            const shouldThink = (this.tickCounter + offset) % CONFIG.DECISION_INTERVAL === 0;

            if (shouldThink || (agent.state === 'IDLE' && agent.currentJobId === null)) {
                this.runAI(agent, grid, state);
            }

            if (this.tickCounter % 60 === 0 && i === 0) {
                console.log(`[AgentSystem] Agent ${agent.name} State: ${agent.state} Job: ${agent.currentJobId} Path: ${agent.path?.length} Pos: ${agent.x.toFixed(2)},${agent.z.toFixed(2)}`);
            }

            // 3. EXECUTION (Per Frame)
            if (agent.state !== 'PLANNING') {
                this.executeAction(agent, grid, ctx.fixedDt, state);
            }
        }
    }

    /**
     * Receive job results (called from World)
     */
    public receiveJobResult(result: PathfindResult, state: GameState): void {
        if (result.kind === 'PATHFIND' && this.pendingPaths.has(result.jobId)) {
            const agentId = this.pendingPaths.get(result.jobId)!;
            this.pendingPaths.delete(result.jobId);

            const agent = state.agents.find(a => a.id === agentId);
            if (agent) {
                if (result.success && result.path && result.path.length > 0) {
                    console.log(`[AgentSystem] Path found for ${agent.name}: ${result.path.length} steps`);
                    agent.path = result.path;
                    agent.state = 'MOVING';
                } else {
                    // Path failed
                    console.warn(`[AgentSystem] Pathfinding failed for ${agent.name}`);
                    agent.path = null;
                    agent.state = 'IDLE';
                    agent.currentJobId = null; // Drop job
                    agent.targetTileId = null; // Drop target
                }
            }
        }
    }

    /**
     * Update Energy, Hunger, Mood
     * @returns true if agent died
     */
    private updateNeeds(agent: Agent, dt: number, state: GameState): boolean {
        const isIllegal = agent.type === 'ILLEGAL_MINER';
        const decayMod = isIllegal ? 0.5 : 1.0;

        // Rates (Per Second)
        const RATES = {
            DECAY: { ENERGY: 0.15, HUNGER: 0.12, MOOD: 0.10 },
            REGEN: { SLEEP: 15, EAT: 20, RELAX: 10, SOCIAL: 15 }
        };

        // --- DECAY ---
        if (agent.state !== 'SLEEPING') agent.energy = Math.max(0, agent.energy - RATES.DECAY.ENERGY * decayMod * dt);
        if (agent.state !== 'EATING') agent.hunger = Math.max(0, agent.hunger - RATES.DECAY.HUNGER * decayMod * dt);
        agent.mood = Math.max(0, agent.mood - RATES.DECAY.MOOD * decayMod * dt);

        // --- REGEN ---
        if (agent.state === 'SLEEPING') agent.energy = Math.min(100, agent.energy + RATES.REGEN.SLEEP * dt);
        else if (agent.state === 'EATING') agent.hunger = Math.min(100, agent.hunger + RATES.REGEN.EAT * dt);
        else if (agent.state === 'RELAXING') agent.mood = Math.min(100, agent.mood + RATES.REGEN.RELAX * dt);
        else if (agent.state === 'SOCIALIZING') agent.mood = Math.min(100, agent.mood + RATES.REGEN.SOCIAL * dt);

        // Check for Death
        if (agent.energy <= 0 || agent.hunger <= 0) {
            // Die
            state.pendingEffects.push({ type: 'FX', fxType: 'DEATH', index: Math.floor(agent.z) * GRID_SIZE + Math.floor(agent.x) });
            state.pendingEffects.push({ type: 'AUDIO', sfx: 'DEATH' });
            return true;
        }

        return false;
    }

    /**
     * Execute the current state (Movement, Work progress)
     */
    private executeAction(agent: Agent, grid: GridTile[], dt: number, state: GameState): void {
        if (agent.state === 'MOVING') {
            this.handleMovement(agent, grid, dt);
        } else if (agent.state === 'WORKING') {
            this.performWork(agent, grid, state);
        } else if (['SLEEPING', 'EATING', 'RELAXING', 'SOCIALIZING'].includes(agent.state)) {
            // Check for completion
            if (agent.state === 'SLEEPING' && agent.energy >= 99) agent.state = 'IDLE';
            if (agent.state === 'EATING' && agent.hunger >= 99) agent.state = 'IDLE';
            if ((agent.state === 'RELAXING' || agent.state === 'SOCIALIZING') && agent.mood >= 99) agent.state = 'IDLE';
        }
    }

    /**
     * Perform work on the current job
     */
    private performWork(agent: Agent, grid: GridTile[], state: GameState): void {
        const jobId = agent.currentJobId;
        if (!jobId) {
            agent.state = 'IDLE';
            return;
        }

        const jobIndex = state.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) {
            // Job cancelled or missing
            agent.currentJobId = null;
            agent.state = 'IDLE';
            return;
        }

        const job = state.jobs[jobIndex];
        const tile = grid[job.targetTileId];

        // verify proximity (simplistic)
        const dist = Math.abs(agent.x - (job.targetTileId % GRID_SIZE)) + Math.abs(agent.z - Math.floor(job.targetTileId / GRID_SIZE));
        if (dist > 1.5) {
            // Moved away? path again?
            agent.state = 'IDLE'; // Trigger re-think
            return;
        }

        if (job.type === 'BUILD') {
            if (tile.isUnderConstruction && tile.constructionTimeLeft! > 0) {
                // Progress construction
                // Base speed is 1 tick. Modifiers handled here.
                const buildSpeed = (1 + (agent.skills.construction / 100)); // 1.0 to 2.0x
                tile.constructionTimeLeft = Math.max(0, tile.constructionTimeLeft! - buildSpeed);

                // Add dust effect occasionally
                if (Math.random() < 0.1) {
                    state.pendingEffects.push({ type: 'FX', fxType: 'DUST', index: tile.id });
                }

                if (tile.constructionTimeLeft <= 0) {
                    // Complete!
                    tile.isUnderConstruction = false;
                    tile.constructionTimeLeft = 0;

                    // Grant XP
                    agent.experience!.buildingsConstructed++;
                    agent.experience!.constructionProgress += 5;
                    agent.experience!.totalWorkTicks++;

                    // Sfx
                    state.pendingEffects.push({ type: 'AUDIO', sfx: 'COMPLETE' });

                    // Remove job
                    state.jobs.splice(jobIndex, 1);
                    agent.currentJobId = null;
                    agent.state = 'IDLE';
                }
            } else {
                // Done or invalid
                state.jobs.splice(jobIndex, 1);
                agent.state = 'IDLE';
            }
        } else if (job.type === 'MINE') {
            // Instant mine for now, or progressive? Let's do progressive if we want loops
            // For now, let's treat mining as picking up resources.
            // But usually mining is continuous on a vein.
            // Legacy logic was likely: Hit tile -> Get Resource -> Job Done (or repeat).

            // Let's implement generic resource gain
            state.resources.minerals += 10 * (1 + agent.skills.mining / 50);
            if (Math.random() < 0.2) state.resources.gems += 1;

            // Add FX
            state.pendingEffects.push({ type: 'FX', fxType: 'MINING', index: tile.id });
            if (Math.random() < 0.3) state.pendingEffects.push({ type: 'AUDIO', sfx: 'MINING_HIT' });

            // XP
            agent.experience!.resourcesMined++;
            agent.experience!.miningProgress += 2;

            // Job complete (one hit) - AgentAI will re-assign if more work needed
            state.jobs.splice(jobIndex, 1);
            agent.currentJobId = null;
            agent.state = 'IDLE';

            // Deplete tile? check foliage
            if (tile.foliage === 'GOLD_VEIN') {
                // chance to deplete
                if (Math.random() < 0.1) tile.foliage = 'NONE';
            }

        } else if (job.type === 'REHABILITATE') {
            tile.rehabProgress = (tile.rehabProgress || 0) + (1 + agent.skills.plants / 50);

            if (Math.random() < 0.1) {
                state.pendingEffects.push({ type: 'FX', fxType: 'ECO_REHAB', index: tile.id });
            }

            if (tile.rehabProgress >= 100) {
                // Success
                tile.biome = 'GRASS';
                tile.foliage = 'FLOWER_YELLOW';
                tile.rehabProgress = 0;

                // Rewards
                state.resources.eco += 10;
                agent.experience!.plantsGrown++;
                agent.experience!.plantsProgress += 5;

                // Job Done
                state.jobs.splice(jobIndex, 1);
                agent.currentJobId = null;
                agent.state = 'IDLE';
            }
        } else {
            // Unknown job type for 'WORKING'
            state.jobs.splice(jobIndex, 1);
            agent.state = 'IDLE';
        }
    }

    /**
     * Handle physical movement along path
     */
    private handleMovement(agent: Agent, grid: GridTile[], dt: number): void {
        if (!agent.path || agent.path.length === 0) {
            // Arrived
            agent.state = this.getNextState(agent);
            return;
        }

        const nextNode = agent.path[0];
        const tx = nextNode % GRID_SIZE;
        const ty = Math.floor(nextNode / GRID_SIZE);

        const dx = tx - agent.x;
        const dy = ty - agent.z;
        const distSq = dx * dx + dy * dy;

        const moveSpeed = CONFIG.SPEED.BASE * dt;

        if (distSq < (moveSpeed * moveSpeed)) {
            // Snap to node
            agent.x = tx;
            agent.z = ty;
            agent.path.shift(); // Remove node
        } else {
            // Move towards
            const angle = Math.atan2(dy, dx);
            agent.x += Math.cos(angle) * moveSpeed;
            agent.z += Math.sin(angle) * moveSpeed;
        }

        // Sync visual position
        agent.visualX = agent.x;
        agent.visualZ = agent.z;
    }

    /**
     * Determine what state to enter after arriving
     */
    private getNextState(agent: Agent): any {
        if (!agent.currentJobId) return 'IDLE';
        if (agent.currentJobId === 'sys_sleep') return 'SLEEPING';
        if (agent.currentJobId === 'sys_eat') return 'EATING';
        if (agent.currentJobId.startsWith('sys_social')) return 'SOCIALIZING';
        if (agent.currentJobId === 'sys_fun') return 'RELAXING';
        if (agent.currentJobId === 'sys_patrol') return 'PATROLLING';
        if (agent.currentJobId.startsWith('build_')) return 'WORKING';
        if (agent.currentJobId === 'sys_wander') return 'IDLE';

        return 'IDLE';
    }

    /**
     * The Brain: Decide what to do using Utility AI
     */
    private runAI(agent: Agent, grid: GridTile[], state: GameState): void {
        // Only think if IDLE or MOVING (allow interrupts later)
        // If PLANNING (waiting for path), do nothing
        if (agent.state === 'PLANNING') return;

        // If performing a sustained action, let it complete
        if (['SLEEPING', 'EATING', 'WORKING', 'SOCIALIZING', 'RELAXING'].includes(agent.state)) return;

        // Calculate scores for all options
        const options = calculateUtilityScores(agent, grid, state.jobs, state.agents);

        // Pick best option
        if (options.length > 0) {
            const best = options[0];

            // Apply decision
            if (best.type === 'WANDER' && agent.state === 'IDLE') {
                // Only wander if truly nothing better to do
                if (Math.random() > 0.3) return; // Don't wander constantly
            }

            // Only switch if different or IDLE
            if (agent.currentJobId !== best.jobId || agent.state === 'IDLE') {
                // Special handling for immediate actions (no travel needed?)
                // For now, always travel
                if (best.targetTileId !== null) {
                    this.startJob(agent, best.jobId, best.targetTileId, state);
                }
            }
        }
    }

    private startJob(agent: Agent, jobId: string | null, targetIdx: number, state: GameState): void {
        agent.currentJobId = jobId;
        agent.targetTileId = targetIdx;

        const startX = Math.floor(agent.x);
        const startZ = Math.floor(agent.z);
        const endX = targetIdx % GRID_SIZE;
        const endZ = Math.floor(targetIdx / GRID_SIZE);
        const startIdx = startZ * GRID_SIZE + startX;

        // Synchronous Pathfinding (Fix for Worker issues)
        // console.log(`[AgentSystem] Sync Pathfinding for ${agent.name}: ${startIdx} -> ${targetIdx}`);
        try {
            const path = findPath(startIdx, targetIdx, state.grid);

            if (path && path.length > 0) {
                // console.log(`[AgentSystem] Path found: ${path.length} steps`);
                agent.path = path;
                agent.state = 'MOVING';
            } else {
                console.warn(`[AgentSystem] No path found for ${agent.name}`);
                agent.state = 'IDLE';
                agent.currentJobId = null;
                agent.targetTileId = null;
            }
        } catch (e) {
            console.error(`[AgentSystem] Pathfinding error:`, e);
            agent.state = 'IDLE';
        }

        // Old Async Logic (disabled)
        /*
        const job = createJob('PATHFIND', {
            startX,
            startZ,
            endX,
            endZ,
            agentId: agent.id,
            priority: 50
        });

        this.jobSystem.enqueue(job);
        this.pendingPaths.set(job.id, agent.id);
        agent.state = 'PLANNING';
        */
    }
}

