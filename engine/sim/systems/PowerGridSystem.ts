/**
 * Power Grid System
 * Calculates power production and allocates connected demand by priority.
 * Buildings that are wired but not supplied during a brownout are marked disconnected.
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
        let strandedDemand = 0;
        const previouslyPoweredConsumers = this.getPreviouslyPoweredConsumers(state);

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

                const isPowerParticipant = tile.buildingType === BuildingType.POWER_LINE || Boolean(def.power?.produces || def.power?.consumes);
                if (isPowerParticipant) {
                    if (tile.isUnderConstruction) {
                        tile.powerStatus = undefined;
                        continue;
                    }
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
                if (!neighbor || neighbor.isUnderConstruction) continue;

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

        // 3. Allocate connected demand by priority. A connected wire is not enough during brownouts.
        const connectedConsumers: GridTile[] = [];
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!tile || tile.isUnderConstruction || !this.isStructureHead(tile)) continue;
                const def = BUILDINGS[tile.buildingType];
                if (!def?.power?.consumes) continue;

                if (tile.powerStatus === 'CONNECTED') {
                    connectedConsumers.push(tile);
                } else {
                    strandedDemand += def.power.consumes;
                }
            }
        }

        const connectedDemand = connectedConsumers.reduce((sum, tile) => sum + (BUILDINGS[tile.buildingType]?.power?.consumes || 0), 0);
        const suppliedConsumers = this.allocatePowerBudget(ctx, state, connectedConsumers, totalProduced, previouslyPoweredConsumers);
        const totalConsumed = suppliedConsumers.reduce((sum, tile) => sum + (BUILDINGS[tile.buildingType]?.power?.consumes || 0), 0);
        const industrialDemand = suppliedConsumers.reduce((sum, tile) => {
            const demand = BUILDINGS[tile.buildingType]?.power?.consumes || 0;
            return this.isIndustrialConsumer(tile.buildingType) ? sum + demand : sum;
        }, 0);

        state.powerGrid = {
            totalProduced,
            totalConsumed,
            industrialDemand,
            strandedDemand,
            deficit: Math.max(0, connectedDemand - totalProduced)
        };
    }

    private allocatePowerBudget(ctx: FixedContext, state: GameState, consumers: GridTile[], totalProduced: number, previouslyPoweredConsumers: Set<string>): GridTile[] {
        let remaining = totalProduced;
        const supplied: GridTile[] = [];

        for (const tile of [...consumers].sort((a, b) => this.getPowerPriority(b) - this.getPowerPriority(a))) {
            const demand = BUILDINGS[tile.buildingType]?.power?.consumes || 0;
            if (demand <= remaining) {
                remaining -= demand;
                this.markStructurePowerStatus(state, tile, 'CONNECTED');
                supplied.push(tile);
                if (!previouslyPoweredConsumers.has(this.getStructureKey(tile))) {
                    this.pushPowerRestoredNews(ctx, state, tile);
                }
            } else {
                this.markStructurePowerStatus(state, tile, 'DISCONNECTED');
            }
        }

        return supplied;
    }

    private getPowerPriority(tile: GridTile): number {
        if (tile.buildingType === BuildingType.RESERVOIR) return 100;
        if (tile.buildingType === BuildingType.STAFF_QUARTERS) return 90;
        if (this.isIndustrialConsumer(tile.buildingType)) return 70;
        return 50;
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
                if (!tile || tile.buildingType !== headTile.buildingType || tile.isUnderConstruction) continue;

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

    private getPreviouslyPoweredConsumers(state: GameState): Set<string> {
        const connected = new Set<string>();
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!tile || tile.isUnderConstruction || !this.isStructureHead(tile)) continue;
                const def = BUILDINGS[tile.buildingType];
                if (def?.power?.consumes && tile.powerStatus === 'CONNECTED') {
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

    private pushPowerRestoredNews(ctx: FixedContext, state: GameState, tile: GridTile): void {
        const name = BUILDINGS[tile.buildingType]?.name || tile.buildingType;
        state.newsFeed.unshift({
            id: ctx.getNextId?.('power_restored') || `power_restored_${tile.x}_${tile.z}_${state.tickCount}`,
            headline: `RADIO: Power restored to ${name} at X${tile.x}, Z${tile.z}.`,
            type: 'POSITIVE',
            timestamp: state.tickCount,
        });
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