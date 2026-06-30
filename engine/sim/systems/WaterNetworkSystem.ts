/**
 * Water Network System
 * Calculates water production and allocates connected demand by priority.
 * Buildings that are piped but not supplied during a shortage are marked disconnected with a shortage flag.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { GameState, GridTile } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { solveResourceGridNetwork } from '../resourceGrid/ResourceGridSolver';
import {
    collectAureusWaterGridParticipants,
    isWaterParticipantTile,
    WATER_NETWORK_TYPE,
} from '../resourceGrid/AureusWaterGridAdapter';
import { getStructureKey, isStructureHead, setStructureUtilityStatus } from '../resourceGrid/AureusResourceGridAdapterUtils';

export class WaterNetworkSystem extends BaseSimSystem {
    readonly id = 'waterNetwork';
    readonly priority = 44; // Run after power, before production, so water-gated buildings use fresh utility state.

    private lastUpdate = 0;
    private readonly INTERVAL = 1.0; // Update every second

    tick(ctx: FixedContext, state: GameState): void {
        if (ctx.time - this.lastUpdate < this.INTERVAL) return;
        this.lastUpdate = ctx.time;

        if (!state.waterNetwork) {
            state.waterNetwork = { totalProduced: 0, totalConsumed: 0, deficit: 0 };
        }

        const previouslyWateredConsumers = this.getPreviouslyWateredConsumers(state);
        this.resetWaterParticipants(state);

        const { participants, tilesByParticipantId } = collectAureusWaterGridParticipants(state);
        const result = solveResourceGridNetwork(WATER_NETWORK_TYPE, participants);

        for (const nodeId of result.connectedNodeIds) {
            const tile = tilesByParticipantId.get(nodeId);
            if (tile) this.markStructureWaterStatus(state, tile, 'CONNECTED', false);
        }

        for (const consumer of result.consumers) {
            const tile = tilesByParticipantId.get(consumer.id);
            if (!tile) continue;

            if (consumer.status === 'SUPPLIED') {
                this.markStructureWaterStatus(state, tile, 'CONNECTED', false);
                if (!previouslyWateredConsumers.has(getStructureKey(tile))) {
                    this.pushWaterRestoredNews(ctx, state, tile);
                }
            } else if (consumer.status === 'SHORTAGE') {
                this.markStructureWaterStatus(state, tile, 'DISCONNECTED', true);
            } else {
                this.markStructureWaterStatus(state, tile, 'DISCONNECTED', false);
            }
        }

        state.waterNetwork = {
            totalProduced: result.totalProduced,
            totalConsumed: result.totalConsumed,
            deficit: result.deficit,
        };
        (state.waterNetwork as any).strandedDemand = result.strandedDemand;
    }

    private resetWaterParticipants(state: GameState): void {
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!tile || !isWaterParticipantTile(tile)) continue;

                if (tile.isUnderConstruction) {
                    tile.waterStatus = undefined;
                    tile.waterShortage = undefined;
                    continue;
                }

                tile.waterStatus = 'DISCONNECTED';
                tile.waterShortage = false;
            }
        }
    }

    private markStructureWaterStatus(
        state: GameState,
        headTile: GridTile,
        status: 'CONNECTED' | 'DISCONNECTED',
        waterShortage: boolean = false,
    ): void {
        setStructureUtilityStatus(state, headTile, { waterStatus: status, waterShortage });
    }

    private getPreviouslyWateredConsumers(state: GameState): Set<string> {
        const connected = new Set<string>();
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!tile || tile.isUnderConstruction || !isStructureHead(tile)) continue;
                const def = BUILDINGS[tile.buildingType];
                if (def?.water?.consumes && tile.waterStatus === 'CONNECTED') {
                    connected.add(getStructureKey(tile));
                }
            }
        }
        return connected;
    }

    private pushWaterRestoredNews(ctx: FixedContext, state: GameState, tile: GridTile): void {
        const name = BUILDINGS[tile.buildingType]?.name || tile.buildingType;
        state.newsFeed.unshift({
            id: ctx.getNextId?.('water_restored') || `water_restored_${tile.x}_${tile.z}_${state.tickCount}`,
            headline: `RADIO: Water restored to ${name} at X${tile.x}, Z${tile.z}.`,
            type: 'POSITIVE',
            timestamp: state.tickCount,
        });
    }
}
