import { BaseSimSystem } from '../Simulation';
import { FixedContext } from '../../kernel';
import { Chunk, GameState, GridTile } from '../../../types';
import { ChunkStore } from '../../space/ChunkStore';
import { CHUNK_SIZE, worldToChunk } from '../../utils/coords';
import { isHarvestable } from '../../utils/GameUtils';
import { getHarvestVisualStage } from '../logic/HarvestVisualProgress';
import { isSubsurfaceDigJob } from '../../subsurface/SubsurfaceModel';

export class HarvestVisualProgressSystem extends BaseSimSystem {
    readonly id = 'harvest_visual_progress';
    readonly priority = 20;

    tick(_ctx: FixedContext, state: GameState): void {
        const updatesByChunk = new Map<string, GridTile[]>();

        for (const job of state.jobs) {
            if (job.type !== 'MINE' || isSubsurfaceDigJob(job) || typeof job.progress !== 'number') continue;
            const tile = ChunkStore.getTile(state.chunks, job.targetX, job.targetZ);
            if (!tile || !isHarvestable(tile.foliage)) continue;

            tile.integrity = Math.max(0, 100 - Math.min(100, job.progress));
            this.queueStageUpdate(state.chunks, tile, updatesByChunk);
        }

        for (const chunk of Object.values(state.chunks)) {
            for (const tile of chunk.tiles) {
                if (!isHarvestable(tile.foliage) || typeof tile.integrity !== 'number') continue;
                this.queueStageUpdate(state.chunks, tile, updatesByChunk);
            }
        }

        for (const [key, updates] of updatesByChunk) {
            const [cx, cz] = key.split(',').map(Number);
            state.pendingEffects.push({ type: 'CHUNK_UPDATE', cx, cz, updates });
        }
    }

    private queueStageUpdate(chunks: Record<string, Chunk>, tile: GridTile, updatesByChunk: Map<string, GridTile[]>): void {
        const nextStage = getHarvestVisualStage(tile.integrity);
        if (tile.harvestVisualStage === nextStage) return;

        tile.harvestVisualStage = nextStage;
        const { cx, cz } = worldToChunk(tile.x, tile.z, CHUNK_SIZE);
        const key = `${cx},${cz}`;
        const chunk = chunks[key];
        if (chunk) {
            chunk.meshDirty = true;
            chunk.simDirty = true;
        }

        const updates = updatesByChunk.get(key) || [];
        updatesByChunk.set(key, updates);
        if (!updates.includes(tile)) {
            updates.push(tile);
        }
    }
}
