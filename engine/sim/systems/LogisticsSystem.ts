/**
 * Logistics System
 * Handles automated grid-wide logic like Fog of War reveal and water connectivity.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { GameState, GridTile } from '../../../types';
import { updateWaterConnectivity, GRID_SIZE } from '../../utils/GameUtils';

export class LogisticsSystem extends BaseSimSystem {
    readonly id = 'logistics';
    readonly priority = 20;

    private lastExplorationUpdate = 0;
    private lastWaterUpdate = 0;

    tick(ctx: FixedContext, state: GameState): void {
        const agents = state.agents;
        const grid = state.grid;
        if (!agents || !grid) return;

        // 1. Fog of War Reveal (Every 0.2s)
        if (ctx.time - this.lastExplorationUpdate > 0.2) {
            this.lastExplorationUpdate = ctx.time;
            this.updateExploration(state);
        }

        // 2. Water Connectivity (Every 1.0s)
        if (ctx.time - this.lastWaterUpdate > 1.0) {
            this.lastWaterUpdate = ctx.time;
            state.grid = updateWaterConnectivity(state.grid);
        }
    }

    private updateExploration(state: GameState) {
        let changed = false;
        const radius = 3;
        const grid = state.grid;

        for (const agent of state.agents) {
            const cx = Math.floor(agent.x);
            const cz = Math.floor(agent.z);

            for (let dz = -radius; dz <= radius; dz++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (dx * dx + dz * dz > radius * radius) continue;

                    const tx = cx + dx;
                    const tz = cz + dz;

                    if (tx >= 0 && tx < GRID_SIZE && tz >= 0 && tz < GRID_SIZE) {
                        const idx = tz * GRID_SIZE + tx;
                        if (!grid[idx].explored) {
                            grid[idx].explored = true;
                            changed = true;
                        }
                    }
                }
            }
        }

        if (changed) {
            // Note: In React we would need to push a GRID_UPDATE effect if we want immediate visual sync for Fog of War
            // But usually the renderer handles exploration visibility.
        }
    }
}
