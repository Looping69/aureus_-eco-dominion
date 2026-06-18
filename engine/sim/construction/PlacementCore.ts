import { CommandErrorCode, CommandResult } from '../../kernel/Types';
import { BuildingType, GameState, GridTile } from '../../../types';
import { BUILDINGS } from '../../data/VoxelConstants';
import { ChunkStore } from '../../space/ChunkStore';
import { CHUNK_SIZE, worldToChunk } from '../../utils/coords';

export interface CompletedConstructionResult {
    headTile: GridTile;
    affectedChunks: Set<string>;
}

export function completeConstructionCore(
    hx: number,
    hz: number,
    state: GameState,
): CompletedConstructionResult | null {
    const headTile = ChunkStore.getTile(state.chunks, hx, hz);
    if (!headTile) return null;

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
): CommandResult {
    const def = BUILDINGS[buildingType];
    if (!def) return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: `Unknown building type: ${buildingType}` };

    const available = state.inventory?.[buildingType] || 0;
    if (!state.cheatsEnabled && available <= 0) {
        state.pendingEffects.push({ type: 'AUDIO', sfx: 'ERROR' as any });
        return { ok: false, code: CommandErrorCode.INVALID_STATE, reason: `No ${def.name} in inventory` };
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

    if (!state.cheatsEnabled) {
        const remaining = Math.max(0, (state.inventory?.[buildingType] || 0) - 1);
        state.inventory[buildingType] = remaining;
        if (remaining === 0 && state.selectedBuilding === buildingType) {
            state.selectedBuilding = null;
            state.interactionMode = 'INSPECT';
        }
    }

    return { ok: true };
}
