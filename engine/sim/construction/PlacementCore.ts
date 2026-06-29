import { CommandErrorCode, CommandResult } from '../../kernel/Types';
import { BuildingType, GameState, GridTile } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { ChunkStore } from '../../space/ChunkStore';
import { CHUNK_SIZE, worldToChunk } from '../../utils/coords';

export interface CompletedConstructionResult {
    headTile: GridTile;
    affectedChunks: Set<string>;
}

function getPipeConstructionPhase(timeLeft: number, buildTime: number): GridTile['undergroundPipePhase'] {
    const progress = buildTime <= 0 ? 1 : 1 - (timeLeft / buildTime);
    if (progress < 0.34) return 'EXCAVATE';
    if (progress < 0.67) return 'INSTALL';
    return 'COVER';
}

function hasQueuedPipeRun(state: GameState): boolean {
    return state.jobs.some(job => job.type === 'BUILD' && job.id.startsWith('build_pipe_'));
}

function applyPipeConstructionPhase(tile: GridTile, state: GameState): void {
    if (tile.undergroundPipePhase === 'EXCAVATE') {
        tile.undergroundPipeBlockCleared = false;
        tile.undergroundPipeInstalled = false;
        state.pendingEffects.push({ type: 'FX', fxType: 'MINING', x: tile.x, z: tile.z });
        return;
    }

    if (tile.undergroundPipePhase === 'INSTALL') {
        tile.undergroundPipeBlockCleared = true;
        tile.undergroundPipeInstalled = false;
        state.pendingEffects.push({ type: 'FX', fxType: 'SMOKE', x: tile.x, z: tile.z });
        return;
    }

    if (tile.undergroundPipePhase === 'COVER') {
        tile.undergroundPipeBlockCleared = true;
        tile.undergroundPipeInstalled = true;
        state.pendingEffects.push({ type: 'FX', fxType: 'DUST', x: tile.x, z: tile.z });
    }
}

export function completeConstructionCore(
    hx: number,
    hz: number,
    state: GameState,
): CompletedConstructionResult | null {
    const headTile = ChunkStore.getTile(state.chunks, hx, hz);
    if (!headTile) return null;

    if (headTile.undergroundPipeUnderConstruction) {
        headTile.undergroundPipe = true;
        headTile.undergroundPipeUnderConstruction = false;
        headTile.undergroundPipePhase = undefined;
        headTile.undergroundPipeBlockCleared = false;
        headTile.undergroundPipeInstalled = true;
        headTile.isUnderConstruction = false;
        headTile.constructionTimeLeft = 0;
        headTile.structureHeadX = undefined;
        headTile.structureHeadZ = undefined;
        headTile.waterStatus = 'DISCONNECTED';
        headTile.waterShortage = false;

        const { cx, cz } = worldToChunk(hx, hz, CHUNK_SIZE);
        return { headTile, affectedChunks: new Set([`${cx},${cz}`]) };
    }

    const def = BUILDINGS[headTile.buildingType];
    if (!def) return null;

    const w = def.width || 1;
    const d = def.depth || 1;
    const affectedChunks = new Set<string>();

    for (let dz = 0; dz < d; dz++) {
        for (let dx = 0; dx < w; dx++) {
            const tx = hx + dx;
            const tz = hz + dz;
            const pTile = ChunkStore.getTile(state.chunks, tx, tz);

            if (pTile && (pTile.structureHeadX === hx && pTile.structureHeadZ === hz)) {
                pTile.isUnderConstruction = false;
                pTile.constructionTimeLeft = 0;

                if (pTile.structureHeadX === undefined) {
                    pTile.structureHeadX = hx;
                    pTile.structureHeadZ = hz;
                }

                const { cx, cz } = worldToChunk(tx, tz, CHUNK_SIZE);
                affectedChunks.add(`${cx},${cz}`);
            }
        }
    }

    return { headTile, affectedChunks };
}

export function progressConstructionCore(
    x: number,
    z: number,
    amount: number,
    state: GameState,
    completeConstruction: (hx: number, hz: number, state: GameState) => void,
): boolean {
    const tile = ChunkStore.getTile(state.chunks, x, z);
    if (!tile || !tile.isUnderConstruction) return false;

    const hx = tile.structureHeadX !== undefined ? tile.structureHeadX : x;
    const hz = tile.structureHeadZ !== undefined ? tile.structureHeadZ : z;
    const headTile = ChunkStore.getTile(state.chunks, hx, hz);

    if (!headTile) return false;

    headTile.constructionTimeLeft = Math.max(0, (headTile.constructionTimeLeft || 0) - amount);

    if (headTile.undergroundPipeUnderConstruction) {
        const buildTime = BUILDINGS[BuildingType.PIPE]?.buildTime || 1;
        headTile.undergroundPipePhase = getPipeConstructionPhase(headTile.constructionTimeLeft || 0, buildTime);
        applyPipeConstructionPhase(headTile, state);
    }

    if (headTile.constructionTimeLeft <= 0) {
        completeConstruction(hx, hz, state);
        return true;
    }

    return false;
}

export function placeBuildingCore(
    x: number,
    z: number,
    buildingType: BuildingType,
    state: GameState,
    isInstant: boolean = false,
    level: number = 1,
    skipInventorySpend: boolean = false,
): CommandResult {
    const def = BUILDINGS[buildingType];
    if (!def) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: `Unknown building type: ${buildingType}` };

    const available = state.inventory?.[buildingType] || 0;
    const canContinueQueuedPipeRun = buildingType === BuildingType.PIPE && hasQueuedPipeRun(state);
    if (!skipInventorySpend && !canContinueQueuedPipeRun && !state.cheatsEnabled && available <= 0) {
        state.pendingEffects.push({ type: 'AUDIO', sfx: 'ERROR' as any });
        return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: `No ${def.name} in inventory` };
    }

    if (buildingType === BuildingType.PIPE) {
        return placeUndergroundPipe(x, z, state, skipInventorySpend || canContinueQueuedPipeRun);
    }

    const w = def.width || 1;
    const d = def.depth || 1;
    const footprint: Array<{ tile: GridTile; cx: number; cz: number }> = [];

    for (let dz = 0; dz < d; dz++) {
        for (let dx = 0; dx < w; dx++) {
            const tx = x + dx;
            const tz = z + dz;
            const { cx, cz } = worldToChunk(tx, tz, CHUNK_SIZE);
            ChunkStore.ensureChunk(state.chunks, cx, cz, state.seed);
            const tile = ChunkStore.getTile(state.chunks, tx, tz);
            if (!tile) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: `Tile at (${tx}, ${tz}) not found despite generation` };

            if (tile.buildingType === BuildingType.PIPE) {
                tile.undergroundPipe = true;
                tile.undergroundPipeUnderConstruction = false;
                tile.undergroundPipePhase = undefined;
                tile.undergroundPipeBlockCleared = false;
                tile.undergroundPipeInstalled = true;
                tile.buildingType = BuildingType.EMPTY;
                tile.isUnderConstruction = false;
                tile.constructionTimeLeft = 0;
                tile.structureHeadX = undefined;
                tile.structureHeadZ = undefined;
            }

            if (tile.undergroundPipeUnderConstruction) {
                return { ok: false, code: CommandErrorCode.ALREADY_PROCESSING, reason: `Tile at (${tx}, ${tz}) is being excavated for a pipe` };
            }

            if (tile.buildingType !== BuildingType.EMPTY && tile.buildingType !== BuildingType.POND) {
                return { ok: false, code: CommandErrorCode.TILE_OCCUPIED, reason: `Tile at (${tx}, ${tz}) is already occupied` };
            }

            if (tile.buildingType === BuildingType.POND && !def.waterPlaceable) {
                return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: `Cannot build ${def.name} on water` };
            }

            footprint.push({ tile, cx, cz });
        }
    }

    const affectedChunks = new Set<string>();
    const updates: GridTile[] = [];

    for (const { tile, cx, cz } of footprint) {
        Object.assign(tile, {
            buildingType,
            isUnderConstruction: !isInstant,
            constructionTimeLeft: isInstant ? 0 : def.buildTime,
            structureHeadX: x,
            structureHeadZ: z,
            explored: true,
            level: level || 1,
            foliage: 'NONE',
            markedForHarvest: false,
        });
        updates.push(tile);
        affectedChunks.add(`${cx},${cz}`);
    }

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
    state.pendingEffects.push({ type: 'AUDIO', sfx: 'BUILD_START' as any });

    if (!skipInventorySpend) spendInventory(state, buildingType);

    return { ok: true };
}

function placeUndergroundPipe(x: number, z: number, state: GameState, skipInventorySpend: boolean = false): CommandResult {
    const { cx, cz } = worldToChunk(x, z, CHUNK_SIZE);
    ChunkStore.ensureChunk(state.chunks, cx, cz, state.seed);
    const tile = ChunkStore.getTile(state.chunks, x, z);
    if (!tile) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: `Tile at (${x}, ${z}) not found despite generation` };

    if (tile.undergroundPipe || tile.undergroundPipeUnderConstruction || tile.buildingType === BuildingType.PIPE) {
        return { ok: false, code: CommandErrorCode.TILE_OCCUPIED, reason: `Tile at (${x}, ${z}) already has an underground pipe` };
    }

    if (tile.buildingType !== BuildingType.EMPTY && tile.buildingType !== BuildingType.POND) {
        return { ok: false, code: CommandErrorCode.TILE_OCCUPIED, reason: `Clear the surface tile at (${x}, ${z}) before excavating a pipe` };
    }

    tile.undergroundPipe = false;
    tile.undergroundPipeUnderConstruction = true;
    tile.undergroundPipePhase = 'EXCAVATE';
    tile.undergroundPipeBlockCleared = false;
    tile.undergroundPipeInstalled = false;
    tile.isUnderConstruction = true;
    tile.constructionTimeLeft = BUILDINGS[BuildingType.PIPE]?.buildTime || 1;
    tile.structureHeadX = x;
    tile.structureHeadZ = z;
    tile.explored = true;
    tile.waterStatus = 'DISCONNECTED';
    tile.waterShortage = false;
    tile.foliage = 'NONE';
    tile.markedForHarvest = false;

    const chunk = state.chunks[`${cx},${cz}`];
    if (chunk) {
        chunk.meshDirty = true;
        chunk.simDirty = true;
    }

    const existingJob = state.jobs.some(job => job.type === 'BUILD' && job.targetX === x && job.targetZ === z);
    if (!existingJob) {
        state.jobs.push({
            id: `build_pipe_${x}_${z}_${state.tickCount}`,
            type: 'BUILD',
            targetX: x,
            targetZ: z,
            priority: 30,
            assignedAgentId: null,
        });
    }

    state.pendingEffects.push({ type: 'CHUNK_UPDATE', cx, cz, updates: [tile] });
    state.pendingEffects.push({ type: 'AUDIO', sfx: 'BUILD_START' as any });
    if (!skipInventorySpend) spendInventory(state, BuildingType.PIPE);

    return { ok: true };
}

function spendInventory(state: GameState, buildingType: BuildingType): void {
    if (state.cheatsEnabled) return;

    const remaining = Math.max(0, (state.inventory?.[buildingType] || 0) - 1);
    state.inventory[buildingType] = remaining;
    if (remaining === 0 && state.selectedBuilding === buildingType) {
        state.selectedBuilding = null;
        state.interactionMode = 'INSPECT';
    }
}