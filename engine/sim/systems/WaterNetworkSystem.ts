/**
 * Water Network System
 * Calculates total water production and consumption across all buildings.
 * Buildings without sufficient water operate at reduced efficiency.
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
        let totalConsumed = 0;
        const weatherEffects = getWeatherGameplayEffects(state.weather);

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
                if (tile.buildingType === BuildingType.PIPE || def.water?.produces || def.water?.consumes) {
                    tile.waterStatus = 'DISCONNECTED';
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
                    if (tile.buildingType === BuildingType.RESERVOIR && state.powerGrid?.deficit > 0) {
                        production = Math.floor(def.water.produces * 0.25);
                    }

                    totalProduced += production;

                    // Mark the full footprint as a water source so pipes can connect to any edge.
                    this.markStructureWaterStatus(state, tile, 'CONNECTED', suppliedTiles, openSet);
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
                if (!neighbor) continue;

                const nDef = BUILDINGS[neighbor.buildingType];
                if (!nDef) continue;

                // If it's a Pipe, it accepts water and continues the flow
                if (neighbor.buildingType === BuildingType.PIPE) {
                    neighbor.waterStatus = 'CONNECTED';
                    suppliedTiles.add(key);
                    openSet.push({ x: nx, z: nz }); // Continue flow
                }
                // If it's a Consumer, it accepts water but STOPS flow (terminal node)
                else if (nDef.water?.consumes) {
                    const headTile = this.getStructureHeadTile(state, neighbor);
                    this.markStructureWaterStatus(state, headTile, 'CONNECTED', suppliedTiles);
                    // Do NOT push to openSet; consumers don't output water to neighbors
                }
            }
        }

        // 3. Calculate Consumption & Deficit. Only structure heads count demand.
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!tile || !this.isStructureHead(tile)) continue;
                const def = BUILDINGS[tile.buildingType];
                if (def && def.water?.consumes) {
                    totalConsumed += def.water.consumes;
                }
            }
        }


        // Update state
        state.waterNetwork = {
            totalProduced,
            totalConsumed,
            deficit: Math.max(0, totalConsumed - totalProduced)
        };
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
        suppliedTiles?: Set<string>,
        openSet?: { x: number, z: number }[],
    ): void {
        const def = BUILDINGS[headTile.buildingType];
        const width = def?.width || 1;
        const depth = def?.depth || 1;

        for (let dz = 0; dz < depth; dz++) {
            for (let dx = 0; dx < width; dx++) {
                const tile = ChunkStore.getTile(state.chunks, headTile.x + dx, headTile.z + dz);
                if (!tile || tile.buildingType !== headTile.buildingType) continue;

                tile.waterStatus = status;
                if (suppliedTiles) {
                    suppliedTiles.add(`${tile.x},${tile.z}`);
                }
                if (openSet) {
                    openSet.push({ x: tile.x, z: tile.z });
                }
            }
        }
    }
}
