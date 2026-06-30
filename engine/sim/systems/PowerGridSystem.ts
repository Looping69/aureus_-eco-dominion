/**
 * Power Grid System
 * Calculates power production and allocates connected demand by priority.
 * Buildings that are wired but not supplied during a brownout are marked disconnected.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { GameState, GridTile } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { ChunkStore } from '../../space/ChunkStore';
import { solveResourceGridNetwork } from '../resourceGrid/ResourceGridSolver';
import {
    collectAureusPowerGridParticipants,
    getStructureKey,
    isIndustrialPowerConsumer,
    isPowerParticipantTile,
    isStructureHead,
    POWER_NETWORK_TYPE,
} from '../resourceGrid/AureusPowerGridAdapter';

export class PowerGridSystem extends BaseSimSystem {
    readonly id = 'powerGrid';
    readonly priority = 45; // Run before water and production so utility-gated buildings use fresh power state.

    private lastUpdate = 0;
    private readonly INTERVAL = 1.0; // Update every second

    tick(ctx: FixedContext, state: GameState): void {
        if (ctx.time - this.lastUpdate < this.INTERVAL) return;
        this.lastUpdate = ctx.time;

        const previouslyPoweredConsumers = this.getPreviouslyPoweredConsumers(state);
        this.resetPowerParticipants(state);

        const { participants, tilesByParticipantId } = collectAureusPowerGridParticipants(state);
        const result = solveResourceGridNetwork(POWER_NETWORK_TYPE, participants);
        let industrialDemand = 0;

        for (const nodeId of result.connectedNodeIds) {
            const tile = tilesByParticipantId.get(nodeId);
            if (tile) this.markStructurePowerStatus(state, tile, 'CONNECTED');
        }

        for (const consumer of result.consumers) {
            const tile = tilesByParticipantId.get(consumer.id);
            if (!tile) continue;

            if (consumer.status === 'SUPPLIED') {
                this.markStructurePowerStatus(state, tile, 'CONNECTED');
                if (isIndustrialPowerConsumer(tile.buildingType)) {
                    industrialDemand += consumer.allocated;
                }
                if (!previouslyPoweredConsumers.has(getStructureKey(tile))) {
                    this.pushPowerRestoredNews(ctx, state, tile);
                }
            } else {
                this.markStructurePowerStatus(state, tile, 'DISCONNECTED');
            }
        }

        state.powerGrid = {
            totalProduced: result.totalProduced,
            totalConsumed: result.totalConsumed,
            industrialDemand,
            strandedDemand: result.strandedDemand,
            deficit: result.deficit,
        };
    }

    private resetPowerParticipants(state: GameState): void {
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!tile || !isPowerParticipantTile(tile)) continue;

                if (tile.isUnderConstruction) {
                    tile.powerStatus = undefined;
                    continue;
                }

                tile.powerStatus = 'DISCONNECTED';
            }
        }
    }

    private markStructurePowerStatus(
        state: GameState,
        headTile: GridTile,
        status: 'CONNECTED' | 'DISCONNECTED',
    ): void {
        const def = BUILDINGS[headTile.buildingType];
        const width = def?.width || 1;
        const depth = def?.depth || 1;

        for (let dz = 0; dz < depth; dz++) {
            for (let dx = 0; dx < width; dx++) {
                const tile = ChunkStore.getTile(state.chunks, headTile.x + dx, headTile.z + dz);
                if (!tile || tile.buildingType !== headTile.buildingType || tile.isUnderConstruction) continue;

                tile.powerStatus = status;
            }
        }
    }

    private getPreviouslyPoweredConsumers(state: GameState): Set<string> {
        const connected = new Set<string>();
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!tile || tile.isUnderConstruction || !isStructureHead(tile)) continue;
                const def = BUILDINGS[tile.buildingType];
                if (def?.power?.consumes && tile.powerStatus === 'CONNECTED') {
                    connected.add(getStructureKey(tile));
                }
            }
        }
        return connected;
    }

    private pushPowerRestoredNews(ctx: FixedContext, state: GameState, tile: GridTile): void {
        const name = BUILDINGS[tile.buildingType]?.name || tile.buildingType;
        state.newsFeed.unshift({
            id: ctx.getNextId?.('power_restored') || `power_restored_${tile.x}_${tile.z}_${state.tickCount}`,
            headline: `RADIO: Power restored to ${name} at X${tile.x}, Z${tile.z}.`,
            type: 'POSITIVE',
            timestamp: state.tickCount,
        });
    }
}
