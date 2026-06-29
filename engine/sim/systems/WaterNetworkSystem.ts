/**
 * Water Network System
 * Calculates water production and allocates connected demand by priority.
 * Buildings that are piped but not supplied during a shortage are marked disconnected with a shortage flag.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { GameState, BuildingType, GridTile } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { ChunkStore } from '../../space/ChunkStore';
import { getWeatherGameplayEffects } from '../../weather/weatherModel';


export class WaterNetworkSystem extends BaseSimSystem {
    readonly id = 'waterNetwork';
    readonly priority = 44; // Run after power, before production, so water-gated buildings use fresh utility state.

    private lastUpdate = 0;
    private readonly INTERVAL = 1.0; // Update every second

    tick(ctx: FixedContext, state: GameState): void {
        if (ctx.time - this.lastUpdate < this.INTERVAL) return;
        this.lastUpdate = ctx.time;

        // Ensure waterNetwork exists (handles old saves)
        if (!state.waterNetwork) {
            state.waterNetwork = { totalProduced: 0, totalConsumed: 0, deficit: 0 };
        }


        let totalProduced = 0;
        const weatherEffects = getWeatherGameplayEffects(state.weather);
        const previouslyWateredConsumers = this.getPreviouslyWateredConsumers(state);

        // 1. Identify Sources and reset network state
        const openSet: { x: number, z: number }[] = []; // Tiles with water
        const suppliedTiles = new Set<string>(); // Tiles that have received water

        // Pre-scan to reset status and find sources
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!tile) continue;

                const def = BUILDINGS[tile.buildingType];
                if (!def) continue;

                // Reset status primarily for Pipes and Consumers
                const isWaterParticipant = tile.buildingType === BuildingType.PIPE || Boolean(def.water?.produces || def.water?.consumes);
                if (isWaterParticipant) {
                    if (tile.isUnderConstruction) {
                        tile.waterStatus = undefined;
                        tile.waterShortage = undefined;
                        continue;
                    }
                    tile.waterStatus = 'DISCONNECTED';
                    tile.waterShortage = false;
                }

                if (!this.isStructureHead(tile)) continue;

                // Sources start connected and count once per structure, not once per footprint tile.
                if (def.water?.produces) {
                    // Determine actual production
                    let production = def.water.produces;

                    if (tile.buildingType === BuildingType.POND) {
                        production = Math.floor(def.water.produces * weatherEffects.waterCollectionMult);
                    }

                    // Power dependency for Reservoirs
                    if (tile.buildingType === BuildingType.RESERVOIR && tile.powerStatus !== 'CONNECTED') {
                        production = Math.floor(def.water.produces * 0.25);
                    }

                    totalProduced += production;

                    // Mark the full footprint as a water source so pipes can connect to any edge.
                    this.markStructureWaterStatus(state, tile, 'CONNECTED', false, suppliedTiles, openSet);
                }
            }
        }


        // 2. BFS Propagation
        // Flows from Sources -> Pipes -> Pipes/Consumers
        let head = 0;
        while (head < openSet.length) {
            const { x, z } = openSet[head++];

            // Get neighbors (NSEW)
            const neighbors = [
                { nx: x, nz: z - 1 }, // North
                { nx: x, nz: z + 1 }, // South
                { nx: x + 1, nz: z }, // East
                { nx: x - 1, nz: z }  // West
            ];

            // Validate and process neighbors
            for (const { nx, nz } of neighbors) {
                const key = `${nx},${nz}`;
                if (suppliedTiles.has(key)) continue;

                const neighbor = ChunkStore.getTile(state.chunks, nx, nz);
                if (!neighbor || neighbor.isUnderConstruction) continue;

                const nDef = BUILDINGS[neighbor.buildingType];
                if (!nDef) continue;

                // If it's a Pipe, it accepts water and continues the flow
                if (neighbor.buildingType === BuildingType.PIPE) {
                    neighbor.waterStatus = 'CONNECTED';
                    neighbor.waterShortage = false;
                    suppliedTiles.add(key);
                    openSet.push({ x: nx, z: nz }); // Continue flow
                }
                // If it's a Consumer, it accepts water but STOPS flow (terminal node)
                else if (nDef.water?.consumes) {
                    const headTile = this.getStructureHeadTile(state, neighbor);
                    this.markStructureWaterStatus(state, headTile, 'CONNECTED', false, suppliedTiles);
                    // Do NOT push to openSet; consumers don't output water to neighbors
                }
            }
        }

        // 3. Allocate connected demand by priority. A connected pipe is not enough during shortages.
        const connectedConsumers: GridTile[] = [];
        let strandedDemand = 0;
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!tile || tile.isUnderConstruction || !this.isStructureHead(tile)) continue;
                const def = BUILDINGS[tile.buildingType];
                if (!def?.water?.consumes) continue;

                if (tile.waterStatus === 'CONNECTED') {
                    connectedConsumers.push(tile);
                } else {
                    strandedDemand += def.water.consumes;
                }
            }
        }

        const connectedDemand = connectedConsumers.reduce((sum, tile) => sum + (BUILDINGS[tile.buildingType]?.water?.consumes || 0), 0);
        const suppliedConsumers = this.allocateWaterBudget(ctx, state, connectedConsumers, totalProduced, previouslyWateredConsumers);
        const totalConsumed = suppliedConsumers.reduce((sum, tile) => sum + (BUILDINGS[tile.buildingType]?.water?.consumes || 0), 0);


        // Update state
        state.waterNetwork = {
            totalProduced,
            totalConsumed,
            deficit: Math.max(0, connectedDemand - totalProduced)
        };
        (state.waterNetwork as any).strandedDemand = strandedDemand;
    }

    private allocateWaterBudget(ctx: FixedContext, state: GameState, consumers: GridTile[], totalProduced: number, previouslyWateredConsumers: Set<string>): GridTile[] {
        let remaining = totalProduced;
        const supplied: GridTile[] = [];

        for (const tile of [...consumers].sort((a, b) => this.getWaterPriority(b) - this.getWaterPriority(a))) {
            const demand = BUILDINGS[tile.buildingType]?.water?.consumes || 0;
            if (demand <= remaining) {
                remaining -= demand;
                this.markStructureWaterStatus(state, tile, 'CONNECTED', false);
                supplied.push(tile);
                if (!previouslyWateredConsumers.has(this.getStructureKey(tile))) {
                    this.pushWaterRestoredNews(ctx, state, tile);
                }
            } else {
                this.markStructureWaterStatus(state, tile, 'DISCONNECTED', true);
            }
        }

        return supplied;
    }

    private getWaterPriority(tile: GridTile): number {
        if (tile.buildingType === BuildingType.STAFF_QUARTERS) return 100;
        if (tile.buildingType === BuildingType.COMMUNITY_GARDEN) return 95;
        if (tile.buildingType === BuildingType.WASTE_TREATMENT) return 90;
        if (tile.buildingType === BuildingType.GREEN_TECH_LAB) return 80;
        if (this.isIndustrialConsumer(tile.buildingType)) return 65;
        return 50;
    }

    private isIndustrialConsumer(type: BuildingType): boolean {
        return [
            BuildingType.WASH_PLANT,
            BuildingType.RECYCLING_PLANT,
            BuildingType.ORE_FOUNDRY,
            BuildingType.GEM_REFINERY,
            BuildingType.WORKSHOP,
            BuildingType.GREEN_TECH_LAB,
        ].includes(type);
    }

    private isStructureHead(tile: GridTile): boolean {
        return tile.structureHeadX === undefined
            || (tile.x === tile.structureHeadX && tile.z === tile.structureHeadZ);
    }

    private getStructureHeadTile(state: GameState, tile: GridTile): GridTile {
        if (this.isStructureHead(tile)) return tile;
        return ChunkStore.getTile(state.chunks, tile.structureHeadX!, tile.structureHeadZ!) || tile;
    }

    private markStructureWaterStatus(
        state: GameState,
        headTile: GridTile,
        status: 'CONNECTED' | 'DISCONNECTED',
        waterShortage: boolean = false,
        suppliedTiles?: Set<string>,
        openSet?: { x: number, z: number }[],
    ): void {
        const def = BUILDINGS[headTile.buildingType];
        const width = def?.width || 1;
        const depth = def?.depth || 1;

        for (let dz = 0; dz < depth; dz++) {
            for (let dx = 0; dx < width; dx++) {
                const tile = ChunkStore.getTile(state.chunks, headTile.x + dx, headTile.z + dz);
                if (!tile || tile.buildingType !== headTile.buildingType || tile.isUnderConstruction) continue;

                tile.waterStatus = status;
                tile.waterShortage = waterShortage;
                if (suppliedTiles) {
                    suppliedTiles.add(`${tile.x},${tile.z}`);
                }
                if (openSet) {
                    openSet.push({ x: tile.x, z: tile.z });
                }
            }
        }
    }

    private getPreviouslyWateredConsumers(state: GameState): Set<string> {
        const connected = new Set<string>();
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!tile || tile.isUnderConstruction || !this.isStructureHead(tile)) continue;
                const def = BUILDINGS[tile.buildingType];
                if (def?.water?.consumes && tile.waterStatus === 'CONNECTED') {
                    connected.add(this.getStructureKey(tile));
                }
            }
        }
        return connected;
    }

    private getStructureKey(tile: GridTile): string {
        const x = tile.structureHeadX ?? tile.x;
        const z = tile.structureHeadZ ?? tile.z;
        return `${tile.buildingType}:${x},${z}`;
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