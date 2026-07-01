/**
 * Construction System
 * Handles building placement, bulldozing, and construction site management.
 * Manages consistency for multi-tile structures.
 */

import { BaseSimSystem } from '../Simulation';
import { FixedContext, CommandContext, CommandResult, CommandErrorCode } from '../../kernel/Types';
import { GameState, GridTile, BuildingType, SfxType, Chunk, GameCommand } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { updateWaterConnectivity } from '../../utils/GameUtils';
import { ChunkStore } from '../../space/ChunkStore';
import { worldToChunk, worldToLocal, CHUNK_SIZE } from '../../utils/coords';
import { DungeonEngine } from '../../dungeon/DungeonEngine';
import { applyDeepLedgerSurvey } from '../../underground/UndergroundGenerator';
import { completeConstructionCore, placeBuildingCore, progressConstructionCore } from '../construction/PlacementCore';

export class ConstructionSystem extends BaseSimSystem {
    readonly id = 'construction';
    readonly priority = 60; // Run high to handle placement/removal before sim systems
    tick(_ctx: FixedContext, state: GameState): void {
        // Construction progress is worker-driven through AgentSystem.performWork -> progressConstruction.
        // This consistency pass only repairs impossible child tiles; it does not advance build timers.
        if (state.tickCount % 120 === 0) {
            this.enforceMultiTileConsistency(state);
        }
    }

    handleCommand(cmd: GameCommand, ctx: CommandContext, state: GameState): CommandResult | null {
        switch (cmd.type) {
            case 'PLACE_BUILDING':
                return this.placeBuilding(cmd.payload.x, cmd.payload.z, cmd.payload.buildingType, state, cmd.payload.isInstant, cmd.payload.level);
            case 'SPEED_UP':
                return this.speedUpConstruction(cmd.payload.x, cmd.payload.z, state);
            case 'REHABILITATE':
                return this.rehabilitateTile(ctx, cmd.payload.x, cmd.payload.z, state);
            case 'UPGRADE_BUILDING':
                return this.upgradeBuilding(ctx, cmd.payload.x, cmd.payload.z, state);
            case 'BULLDOZE':
                return this.bulldozeBuilding(cmd.payload.x, cmd.payload.z, state);
            case 'MARK_HARVEST':
                return this.handleMarkHarvest(cmd.payload.x, cmd.payload.z, state);
            default:
                return null;
        }
    }

    /**
     * Advances construction progress on a tile.
     * Handles multi-tile synchronization.
     */
    public progressConstruction(x: number, z: number, amount: number, state: GameState): boolean {
        return progressConstructionCore(x, z, amount, state, (hx, hz, targetState) => {
            this.completeConstruction(hx, hz, targetState);
        });
    }

    /**
     * Immediately completes construction for a building.
     */
    private completeConstruction(hx: number, hz: number, state: GameState): void {
        const result = completeConstructionCore(hx, hz, state);
        if (!result) return;

        const { headTile, affectedChunks } = result;

        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.COMPLETE });
        for (const key of affectedChunks) {
            const [cx, cz] = key.split(',').map(Number);
            const chunk = state.chunks[key];
            if (chunk) {
                chunk.meshDirty = true;
                chunk.simDirty = true;
                const updates = chunk.tiles.filter(t => (t.structureHeadX === hx && t.structureHeadZ === hz));
                if (updates.length === 0) updates.push(headTile);
                state.pendingEffects.push({ type: 'CHUNK_UPDATE', cx, cz, updates });
            }
        }
        updateWaterConnectivity(state.chunks);

        if (headTile.buildingType === BuildingType.SURVEY_DRILL) {
            const survey = applyDeepLedgerSurvey(state);
            if (!state.dungeon.voxelData && survey.unlocked) {
                new DungeonEngine(state.dungeon);
            }

            state.newsFeed.unshift({
                id: `survey_drill_${Date.now()}`,
                headline: 'Survey Drill complete! Below Sector authorization is now active.',
                type: 'POSITIVE',
                timestamp: state.tickCount
            });
            state.dungeon.logs.push(`Survey Drill online. ${survey.surveyedTileCount} tiles surveyed in Sector B${state.underground.depthLevel}.`);
        } else if (headTile.buildingType === BuildingType.MINE_SHAFT) {
            if (!state.dungeon.voxelData && (state.underground.unlocked || state.dungeon.unlocked)) {
                new DungeonEngine(state.dungeon);
            }

            state.dungeon.logs.push(
                state.underground.unlocked || state.dungeon.unlocked
                    ? 'Mine Shaft complete! Surface access secured for Below Sector crews.'
                    : 'Mine Shaft complete. Build a Survey Drill to authorize Below Sector operations.'
            );
        }
    }

    public placeBuilding(x: number, z: number, buildingType: BuildingType, state: GameState, isInstant: boolean = false, level: number = 1): CommandResult {
        const result = placeBuildingCore(x, z, buildingType, state, isInstant, level);
        if (result.ok) updateWaterConnectivity(state.chunks);
        return result;
    }

    /**
     * Removes a building or foliage from a tile.
     * Handles multi-tile cleanup.
     */
    public bulldozeBuilding(x: number, z: number, state: GameState): CommandResult {
        const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
        ChunkStore.ensureChunk(state.chunks, cx, cz, state.seed);
        const tile = ChunkStore.getTile(state.chunks, x, z);
        if (!tile) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Tile not found' };

        const updates: GridTile[] = [];
        const affectedChunks = new Set<string>();

        if (tile.foliage === 'ILLEGAL_CAMP') {
            tile.foliage = 'NONE';
            updates.push(tile);
            const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
            affectedChunks.add(`${cx},${cz}`);
        } else if (tile.structureHeadX !== undefined && tile.structureHeadZ !== undefined) {
            const hx = tile.structureHeadX;
            const hz = tile.structureHeadZ;
            const headTile = ChunkStore.getTile(state.chunks, hx, hz);
            if (headTile) {
                const def = BUILDINGS[headTile.buildingType];
                const w = def?.width || 1;
                const d = def?.depth || 1;

                for (let dz = 0; dz < d; dz++) {
                    for (let dx = 0; dx < w; dx++) {
                        const tx = hx + dx;
                        const tz = hz + dz;
                        const pTile = ChunkStore.getTile(state.chunks, tx, tz);
                        if (pTile && pTile.structureHeadX === hx && pTile.structureHeadZ === hz) {
                            Object.assign(pTile, {
                                buildingType: BuildingType.EMPTY,
                                isUnderConstruction: false,
                                structureHeadX: undefined,
                                structureHeadZ: undefined,
                                constructionTimeLeft: 0,
                                undergroundPipeUnderConstruction: false,
                                undergroundPipePhase: undefined,
                            });
                            updates.push(pTile);
                            const { cx, cz } = worldToChunk(tx, tz, CHUNK_SIZE);
                            affectedChunks.add(`${cx},${cz}`);
                        }
                    }
                }
            }
        } else {
            tile.buildingType = BuildingType.EMPTY;
            tile.isUnderConstruction = false;
            tile.structureHeadX = undefined;
            tile.structureHeadZ = undefined;
            tile.undergroundPipeUnderConstruction = false;
            tile.undergroundPipePhase = undefined;
            updates.push(tile);
            const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
            affectedChunks.add(`${cx},${cz}`);
        }

        updateWaterConnectivity(state.chunks);
        for (const key of affectedChunks) {
            const [cx, cz] = key.split(',').map(Number);
            const chunk = state.chunks[`${cx},${cz}`];
            if (chunk) {
                chunk.meshDirty = true;
                chunk.simDirty = true;
            }
            state.pendingEffects.push({
                type: 'CHUNK_UPDATE', cx, cz, updates: updates.filter(t => {
                    const c = worldToChunk(t.x, t.z, CHUNK_SIZE);
                    return c.cx === cx && c.cz === cz;
                })
            });
        }
        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.BULLDOZE });
        return { ok: true };
    }

    /**
     * Instantly completes construction for a gem cost.
     */
    public speedUpConstruction(x: number, z: number, state: GameState): CommandResult {
        const tile = ChunkStore.getTile(state.chunks, x, z);
        if (!tile) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Tile not found' };

        if (!tile.isUnderConstruction) return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: 'No construction in progress' };

        if (state.resources.gems < 1) return { ok: false, code: CommandErrorCode.INSUFFICIENT_RESOURCES, reason: 'Insufficient Gems' };

        const hx = tile.structureHeadX !== undefined ? tile.structureHeadX : x;
        const hz = tile.structureHeadZ !== undefined ? tile.structureHeadZ : z;
        this.completeConstruction(hx, hz, state);

        state.resources.gems = Math.max(0, state.resources.gems - 1);
        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.UI_CLICK });
        return { ok: true };
    }

    /**
     * Initiates rehabilitation of a polluted tile.
     */
    public rehabilitateTile(ctx: FixedContext, x: number, z: number, state: GameState): CommandResult {
        if (state.resources.agt < 100) return { ok: false, code: CommandErrorCode.INSUFFICIENT_RESOURCES, reason: 'Insufficient AGT' };

        const tile = ChunkStore.getTile(state.chunks, x, z);
        if (!tile) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Tile not found' };
        if (!tile.foliage || tile.foliage === 'NONE') {
            // Check if it's generally "dirty" or has some indicator we can use
            if (tile.rehabProgress === undefined) {
                return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: 'Tile does not need rehabilitation' };
            }
        }

        const exists = state.jobs.some(j => j.type === 'REHABILITATE' && j.targetX === x && j.targetZ === z);
        if (!exists) {
            state.jobs.push({
                id: ctx.getNextId?.('rehab') || `rehab_${x}_${z}_${Date.now()}`,
                type: 'REHABILITATE',
                targetX: x,
                targetZ: z,
                priority: 25,
                assignedAgentId: null
            });
            const tile = ChunkStore.getTile(state.chunks, x, z);
            if (tile) {
                tile.rehabProgress = 0.1;
                state.resources.agt -= 100;
                const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
                state.pendingEffects.push({ type: 'CHUNK_UPDATE', cx, cz, updates: [tile] });
            }
            return { ok: true };
        } else {
            return { ok: false, code: CommandErrorCode.ALREADY_PROCESSING, reason: 'Rehabilitation already in progress' };
        }
    }


    /**
     * Ensures all tiles of a multi-tile building are in the same state.
     */
    private enforceMultiTileConsistency(state: GameState): void {
        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (tile.structureHeadX !== undefined && tile.structureHeadZ !== undefined && (tile.structureHeadX !== tile.x || tile.structureHeadZ !== tile.z)) {
                    const head = ChunkStore.getTile(state.chunks, tile.structureHeadX, tile.structureHeadZ);
                    if (!head || head.buildingType === BuildingType.EMPTY) {
                        tile.buildingType = BuildingType.EMPTY;
                        tile.structureHeadX = undefined;
                        tile.structureHeadZ = undefined;
                        tile.isUnderConstruction = false;
                        chunk.meshDirty = true;
                    } else {
                        tile.buildingType = head.buildingType;
                        tile.isUnderConstruction = head.isUnderConstruction;
                    }
                }
            }
        }
    }

    /**
     * Upgrades a building to the next level.
     */
    public upgradeBuilding(ctx: FixedContext | CommandContext, x: number, z: number, state: GameState): CommandResult {
        const tile = ChunkStore.getTile(state.chunks, x, z);
        if (!tile || tile.buildingType === BuildingType.EMPTY) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Building not found' };

        const hx = tile.structureHeadX !== undefined ? tile.structureHeadX : x;
        const hz = tile.structureHeadZ !== undefined ? tile.structureHeadZ : z;
        const headTile = ChunkStore.getTile(state.chunks, hx, hz);
        if (!headTile) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Structure head not found' };

        if (headTile.isUnderConstruction) {
            return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: 'Building is already under construction' };
        }

        const def = BUILDINGS[headTile.buildingType];
        if (!def || !def.upgrades) {
            state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.UI_CLICK });
            return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: 'Building cannot be upgraded' };
        }

        const currentLevel = headTile.level || 1;
        const nextLevel = currentLevel + 1;
        const upgrade = def.upgrades.find(u => u.level === nextLevel);

        if (!upgrade) {
            state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.UI_CLICK });
            return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: `No more upgrades for ${def.name}` };
        }

        if (upgrade.era && state.currentEra < upgrade.era && !state.unlockedEras?.includes(upgrade.era)) {
            if (!state.cheatsEnabled) {
                state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.UI_CLICK });
                return { ok: false, code: CommandErrorCode.FORBIDDEN, reason: 'Required era not unlocked' };
            }
        }

        const costs = upgrade.costs || {};
        if (!state.cheatsEnabled) {
            if ((state.resources.agt || 0) < (costs.agt || 0) ||
                (state.resources.minerals || 0) < (costs.minerals || 0) ||
                (state.resources.wood || 0) < (costs.wood || 0) ||
                (state.resources.stone || 0) < (costs.stone || 0) ||
                (state.resources.gems || 0) < (costs.gems || 0)) {

                state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.UI_CLICK });
                return { ok: false, code: CommandErrorCode.INSUFFICIENT_RESOURCES, reason: 'Insufficient resources for upgrade' };
            }

            state.resources.agt = (state.resources.agt || 0) - (costs.agt || 0);
            state.resources.minerals = (state.resources.minerals || 0) - (costs.minerals || 0);
            state.resources.wood = (state.resources.wood || 0) - (costs.wood || 0);
            state.resources.stone = (state.resources.stone || 0) - (costs.stone || 0);
            state.resources.gems = (state.resources.gems || 0) - (costs.gems || 0);
        }

        headTile.level = nextLevel;
        headTile.isUnderConstruction = true;
        headTile.constructionTimeLeft = def.buildTime || 10;

        const affectedChunks = new Set<string>();
        const updates: GridTile[] = [headTile];
        const { cx: hcx, cz: hcz } = worldToChunk(hx, hz, CHUNK_SIZE);
        affectedChunks.add(`${hcx},${hcz}`);

        if ((def.width || 1) > 1 || (def.depth || 1) > 1) {
            const w = def.width || 1;
            const d = def.depth || 1;
            for (let dz = 0; dz < d; dz++) {
                for (let dx = 0; dx < w; dx++) {
                    const tx = hx + dx;
                    const tz = hz + dz;
                    const pTile = ChunkStore.getTile(state.chunks, tx, tz);
                    if (pTile && pTile.structureHeadX === hx && pTile.structureHeadZ === hz) {
                        pTile.level = headTile.level;
                        pTile.isUnderConstruction = true;
                        pTile.constructionTimeLeft = headTile.constructionTimeLeft;
                        updates.push(pTile);
                        const { cx, cz } = worldToChunk(tx, tz, CHUNK_SIZE);
                        affectedChunks.add(`${cx},${cz}`);
                    }
                }
            }
        }

        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.BUILD_START });
        for (const key of affectedChunks) {
            const [cx, cz] = key.split(',').map(Number);
            const chunk = state.chunks[key];
            if (chunk) {
                chunk.meshDirty = true;
                chunk.simDirty = true;
            }
            state.pendingEffects.push({
                type: 'CHUNK_UPDATE', cx, cz, updates: updates.filter(t => {
                    const c = worldToChunk(t.x, t.z, CHUNK_SIZE);
                    return c.cx === cx && c.cz === cz;
                })
            });
        }

        state.newsFeed.unshift({
            id: ctx.getNextId?.('upgrade') || `upgrade_${Date.now()}`,
            headline: `${def.name} upgrading to Level ${nextLevel}...`,
            type: 'POSITIVE',
            timestamp: state.tickCount
        });

        return { ok: true };
    }

    private handleMarkHarvest(x: number, z: number, state: GameState): CommandResult {
        const tile = ChunkStore.getTile(state.chunks, x, z);
        if (!tile || !tile.foliage || tile.foliage === 'NONE') return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'No foliage to harvest' };

        tile.markedForHarvest = !tile.markedForHarvest;
        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.UI_CLICK });
        return { ok: true };
    }

}