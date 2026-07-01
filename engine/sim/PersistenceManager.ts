/**
 * Persistence Manager
 * Handles saving and loading the game state to localStorage.
 * Manages serialization of complex objects like Maps.
 */

import { GameState, Agent, GridTile, BuildingType, FogExplorationState } from '../../types';
import { DEFAULT_VIEW_RADIUS } from '../utils/GameUtils';
import { applyDeepLedgerSurvey } from '../underground/UndergroundGenerator';
import { normalizeLayeredWorldState } from '../worldgen/LayeredWorldGenerator';

export class PersistenceManager {
    private readonly STORAGE_KEY = 'aureus_save_v2';

    /**
     * Serializes and saves the current game state
     */
    public saveGame(state: GameState): boolean {
        try {
            const serialized = JSON.stringify(state, (key, value) => {
                // Prune non-essential chunk data to save space
                if (key === 'chunks' && value && typeof value === 'object') {
                    const prunedChunks: Record<string, any> = {};
                    for (const [chunkKey, chunk] of Object.entries(value)) {
                        const c = chunk as any;
                        prunedChunks[chunkKey] = {
                            tiles: c.tiles.map((tile: GridTile) => {
                                const pruned: any = {
                                    id: tile.id,
                                    x: tile.x,
                                    z: tile.z,
                                    biome: tile.biome
                                };

                                if (tile.buildingType && tile.buildingType !== 'EMPTY') pruned.buildingType = tile.buildingType;
                                if (tile.level && tile.level > 1) pruned.level = tile.level;
                                if (tile.foliage && tile.foliage !== 'NONE') pruned.foliage = tile.foliage;
                                if (tile.terrainHeight !== 0 && tile.terrainHeight !== undefined) pruned.terrainHeight = tile.terrainHeight;
                                if (tile.isUnderConstruction) pruned.isUnderConstruction = tile.isUnderConstruction;
                                if (tile.markedForHarvest) pruned.markedForHarvest = tile.markedForHarvest;

                                if (tile.structureHeadX !== undefined) pruned.structureHeadX = tile.structureHeadX;
                                if (tile.structureHeadZ !== undefined) pruned.structureHeadZ = tile.structureHeadZ;
                                if (tile.explored) pruned.explored = tile.explored;
                                if (tile.locked) pruned.locked = tile.locked;

                                return pruned;
                            })
                        };
                    }
                    return prunedChunks;
                }

                if (key === 'layeredWorld' && value && typeof value === 'object') {
                    return {
                        enabled: value.enabled,
                        minY: value.minY,
                        maxY: value.maxY,
                        surfaceY: value.surfaceY,
                        activeY: value.activeY,
                        accessPoints: value.accessPoints || {},
                        renderVersion: value.renderVersion || 0,
                        migrationVersion: value.migrationVersion || 0,
                        chunks: {},
                    };
                }

                // Exclude large transient objects if any
                if (key === 'pendingEffects') return [];
                if (key === 'commandQueue') return [];

                return value;
            });

            localStorage.setItem(this.STORAGE_KEY, serialized);
            return true;
        } catch (e: any) {
            if (e.name === 'QuotaExceededError') {
                console.warn('[PersistenceManager] Storage quota exceeded. Game state too large for localStorage.');
            } else {
                console.error('[PersistenceManager] Failed to save game:', e);
            }
            return false;
        }
    }

    private ensureIndustryState(state: GameState): void {
        if (!state.industry) {
            state.industry = {
                refinedMaterials: 0,
                alloys: 0,
                machineParts: 0,
                automationKits: 0,
                automatedChains: 0,
                gridLoad: 0,
            };
            return;
        }

        state.industry.refinedMaterials ??= 0;
        state.industry.alloys ??= 0;
        state.industry.machineParts ??= 0;
        state.industry.automationKits ??= 0;
        state.industry.automatedChains ??= 0;
        state.industry.gridLoad ??= 0;
    }

    private ensurePowerGridState(state: GameState): void {
        state.powerGrid ??= {
            totalProduced: 0,
            totalConsumed: 0,
            industrialDemand: 0,
            strandedDemand: 0,
            deficit: 0,
        };

        state.powerGrid.totalProduced ??= 0;
        state.powerGrid.totalConsumed ??= 0;
        state.powerGrid.industrialDemand ??= 0;
        state.powerGrid.strandedDemand ??= 0;
        state.powerGrid.deficit ??= 0;
    }

    private ensureFogExplorationState(state: GameState): void {
        const existing = state.fogExploration;
        const centers = Array.isArray(existing?.centers)
            ? existing.centers.filter((center: any) => (
                typeof center?.key === 'string'
                && typeof center.x === 'number'
                && Number.isFinite(center.x)
                && typeof center.z === 'number'
                && Number.isFinite(center.z)
                && typeof center.radius === 'number'
                && Number.isFinite(center.radius)
                && center.radius > 0
            ))
            : [];

        const version = typeof existing?.version === 'number' && Number.isFinite(existing.version)
            ? existing.version
            : centers.length;

        state.fogExploration = { centers, version } satisfies FogExplorationState;
    }

    private reviveTiles(state: GameState): void {
        if (!state.chunks) return;

        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                // Fill in defaults for pruned fields
                if (tile.buildingType === undefined) tile.buildingType = BuildingType.EMPTY;
                if (tile.level === undefined) tile.level = 1;
                if (tile.foliage === undefined) tile.foliage = 'NONE';
                if (tile.terrainHeight === undefined) tile.terrainHeight = 0;

                // Ensure explored and unlocked
                tile.locked = false;
                tile.explored = true;
            }
        }
    }

    private ensureLayeredWorldState(state: GameState): void {
        state.layeredWorld = normalizeLayeredWorldState(state.chunks || {}, state.layeredWorld);
    }

    /**
     * Loads and deserializes the game state
     */
    public loadGame(): GameState | null {
        try {
            const serialized = localStorage.getItem(this.STORAGE_KEY);
            if (!serialized) return null;

            const state = JSON.parse(serialized, (key, value) => {
                // Revive Maps
                if (typeof value === 'object' && value !== null && value.dataType === 'Map') {
                    return new Map(value.value);
                }
                return value;
            }) as GameState;

            // Post-load validation / migration
            // Ensure essential arrays exist
            if (!state.agents) state.agents = [];
            if (!state.jobs) state.jobs = [];
            if (!state.pendingEffects) state.pendingEffects = [];
            if (!state.commandQueue) state.commandQueue = [];
            this.ensureIndustryState(state);
            this.ensurePowerGridState(state);
            this.ensureFogExplorationState(state);
            this.reviveTiles(state);
            this.ensureLayeredWorldState(state);

            if (state.chunks) {
                console.log('[PersistenceManager] Revived and migrated chunk tiles.');
            }

            // Revive Grid: JSON.parse makes generic objects, but GridTile is an interface so it's fine.
            // If we had class instances, we'd need to re-instantiate them.

            applyDeepLedgerSurvey(state as any);

            console.log('[PersistenceManager] Game loaded successfully.');
            return state;
        } catch (e) {
            console.error('[PersistenceManager] Failed to load game:', e);
            return null;
        }
    }

    /**
     * Revives state from a provided string
     */
    public reviveState(serialized: string): GameState | null {
        try {
            const state = JSON.parse(serialized, (key, value) => {
                // Revive Maps
                if (typeof value === 'object' && value !== null && value.dataType === 'Map') {
                    return new Map(value.value);
                }
                return value;
            }) as GameState;

            // Post-load validation / migration
            if (!state.agents) state.agents = [];
            if (!state.jobs) state.jobs = [];
            if (!state.pendingEffects) state.pendingEffects = [];
            if (!state.commandQueue) state.commandQueue = [];
            this.ensureIndustryState(state);
            this.ensurePowerGridState(state);
            this.ensureFogExplorationState(state);
            this.reviveTiles(state);
            this.ensureLayeredWorldState(state);

            applyDeepLedgerSurvey(state as any);

            return state;
        } catch (e) {
            console.error('[PersistenceManager] Failed to revive state:', e);
            return null;
        }
    }

    public hasSave(): boolean {
        return !!localStorage.getItem(this.STORAGE_KEY);
    }

    public clearSave(): void {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('[PersistenceManager] Save cleared.');
    }
}