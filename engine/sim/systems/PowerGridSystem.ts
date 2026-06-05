/**
 * Power Grid System
 * Calculates total power production and consumption across all buildings.
 * Buildings without sufficient power operate at reduced efficiency.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { GameState, BuildingType, GridTile } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { ChunkStore } from '../../space/ChunkStore';
import { getSolarEfficiency } from '../dayNightCycle';
import { getWeatherGameplayEffects } from '../../weather/weatherModel';

export class PowerGridSystem extends BaseSimSystem {
    readonly id = 'powerGrid';
    readonly priority = 45; // Run before water and production so utility-gated buildings use fresh power state.

    private lastUpdate = 0;
    private readonly INTERVAL = 1.0; // Update every second

    tick(ctx: FixedContext, state: GameState): void {
        if (ctx.time - this.lastUpdate < this.INTERVAL) return;
        this.lastUpdate = ctx.time;

        let totalProduced = 0;
        let totalConsumed = 0;
        let industrialDemand = 0;
        let strandedDemand = 0;

        // 1. Identify Sources and reset network state
        const openSet: { x: number, z: number }[] = [];
        const empoweredTiles = new Set<string>(); // Use "x,z" as key

        const isDaytime = state.dayNightCycle?.isDaytime ?? true;
        const timeOfDay = state.dayNightCycle?.timeOfDay ?? 12000;
        const weatherEffects = getWeatherGameplayEffects(state.weather);

        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!tile) continue;

                const def = BUILDINGS[tile.buildingType];
                if (!def) continue;

                if (tile.buildingType === BuildingType.POWER_LINE || def.power?.produces || def.power?.consumes) {
                    tile.powerStatus = 'DISCONNECTED';
                }

                if (!this.isStructureHead(tile)) continue;

                // Sources
                if (def.power?.produces) {
                    let production = def.power.produces;

                    // Solar Logic
                    if (tile.buildingType === BuildingType.SOLAR_ARRAY) {
                        if (!isDaytime) {
                            production = 0;
                        } else {
                            const solarEfficiency = getSolarEfficiency(timeOfDay);
                            production = Math.floor(def.power.produces * solarEfficiency * weatherEffects.solarMult);
                        }
                    }

                    // Wind turbines should meaningfully respond to gust fronts and storms.
                    if (tile.buildingType === BuildingType.WIND_TURBINE) {
                        production = Math.floor(def.power.produces * weatherEffects.windMult);
                    }

                    totalProduced += production;

                    // If producing power, the full footprint can feed adjacent lines/buildings.
                    if (production > 0) {
                        this.markStructurePowerStatus(state, tile, 'CONNECTED', empoweredTiles, openSet);
                    }
                }
            }
        }

        // 2. BFS Propagation
        let head = 0;
        while (head < openSet.length) {
            const { x, z } = openSet[head++];

            const neighbors = [
                { nx: x + 1, nz: z },
                { nx: x - 1, nz: z },
                { nx: x, nz: z + 1 },
                { nx: x, nz: z - 1 }
            ];

            for (const { nx, nz } of neighbors) {
                const key = `${nx},${nz}`;
                if (empoweredTiles.has(key)) continue;

                // Look up tile in chunks
                const neighbor = ChunkStore.getTile(state.chunks, nx, nz);
                if (!neighbor) continue;

                const nDef = BUILDINGS[neighbor.buildingType];
                if (!nDef) continue;

                if (neighbor.buildingType === BuildingType.POWER_LINE) {
                    neighbor.powerStatus = 'CONNECTED';
                    empoweredTiles.add(key);
                    openSet.push({ x: nx, z: nz });
                } else if (nDef.power?.consumes) {
                    const headTile = this.getStructureHeadTile(state, neighbor);
                    this.markStructurePowerStatus(state, headTile, 'CONNECTED', empoweredTiles);
                    // Do not propagate through buildings to avoid daisy-chaining without wires
                }
            }
        }

        // 3. Calculate connected and stranded demand separately. Only structure heads count demand.
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!tile || !this.isStructureHead(tile)) continue;
                const def = BUILDINGS[tile.buildingType];
                if (!def?.power?.consumes) continue;

                if (tile.powerStatus === 'CONNECTED') {
                    totalConsumed += def.power.consumes;
                    if (this.isIndustrialConsumer(tile.buildingType)) {
                        industrialDemand += def.power.consumes;
                    }
                } else {
                    strandedDemand += def.power.consumes;
                }
            }
        }

        state.powerGrid = {
            totalProduced,
            totalConsumed,
            industrialDemand,
            strandedDemand,
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

    private markStructurePowerStatus(
        state: GameState,
        headTile: GridTile,
        status: 'CONNECTED' | 'DISCONNECTED',
        empoweredTiles?: Set<string>,
        openSet?: { x: number, z: number }[],
    ): void {
        const def = BUILDINGS[headTile.buildingType];
        const width = def?.width || 1;
        const depth = def?.depth || 1;

        for (let dz = 0; dz < depth; dz++) {
            for (let dx = 0; dx < width; dx++) {
                const tile = ChunkStore.getTile(state.chunks, headTile.x + dx, headTile.z + dz);
                if (!tile || tile.buildingType !== headTile.buildingType) continue;

                tile.powerStatus = status;
                if (empoweredTiles) {
                    empoweredTiles.add(`${tile.x},${tile.z}`);
                }
                if (openSet) {
                    openSet.push({ x: tile.x, z: tile.z });
                }
            }
        }
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
}
