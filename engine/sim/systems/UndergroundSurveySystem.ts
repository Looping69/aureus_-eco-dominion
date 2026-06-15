import { FixedContext } from '../../kernel/Types';
import { BuildingType, GameState } from '../../../types';
import { BaseSimSystem } from '../Simulation';
import { applyDeepLedgerSurvey } from '../../underground/UndergroundGenerator';
import {
    SUBSURFACE_CLEAR_RUBBLE_JOB_PREFIX,
    SUBSURFACE_DIG_JOB_PREFIX,
    SUBSURFACE_MAX_OPEN_PIT_DEPTH,
    SUBSURFACE_SURFACE_RUBBLE_DUMP_CAPACITY,
} from '../../subsurface/SubsurfaceModel';

/**
 * Engine-owned Phase 1 Deep Ledger survey sync. (|/) Klaasvaakie
 */
export class UndergroundSurveySystem extends BaseSimSystem {
    readonly id = 'underground_survey';
    readonly priority = 55;

    tick(_ctx: FixedContext, state: GameState): void {
        syncOpenPitTelemetry(state);
        if (state.tickCount % 30 !== 0) return;
        applyDeepLedgerSurvey(state);
    }
}

function isStructureHead(tile: { x: number; z: number; structureHeadX?: number; structureHeadZ?: number }): boolean {
    return tile.structureHeadX === undefined || (tile.structureHeadX === tile.x && tile.structureHeadZ === tile.z);
}

function getSurfaceStockpileCapacity(state: GameState): number {
    let capacity = 0;
    for (const chunk of Object.values(state.chunks)) {
        for (const tile of chunk.tiles) {
            if (tile.isUnderConstruction) continue;
            if (!isStructureHead(tile)) continue;
            if (tile.buildingType === BuildingType.STOCKPILE) capacity += SUBSURFACE_SURFACE_RUBBLE_DUMP_CAPACITY;
        }
    }
    return capacity;
}

function getUndergroundDumpCapacity(state: GameState): number {
    return Object.values(state.layeredWorld.rubbleDropZones || {}).reduce((total, zone) => total + zone.capacity, 0);
}

function syncOpenPitTelemetry(state: GameState): void {
    const layeredWorld = state.layeredWorld;
    const rubbleStored = Math.max(0, Math.round(layeredWorld.rubbleStockpile || 0));
    const stockpileCapacity = getSurfaceStockpileCapacity(state);
    const undergroundDumpCapacity = getUndergroundDumpCapacity(state);
    const rubbleCapacity = stockpileCapacity + undergroundDumpCapacity;
    let openPitTiles = 0;
    let deepestOpenPitDepth = 0;
    let surfaceRubbleTiles = 0;

    for (const chunk of Object.values(state.chunks)) {
        for (const tile of chunk.tiles) {
            const depth = Math.max(0, Math.round(tile.openPitDepth || 0));
            if (depth > 0) {
                openPitTiles += 1;
                deepestOpenPitDepth = Math.max(deepestOpenPitDepth, depth);
            }
            if (tile.foliage === 'ROCK_PEBBLE') surfaceRubbleTiles += 1;
        }
    }

    const excavationJobs = state.jobs.filter(job => Number.isFinite(job.targetY) || job.id?.startsWith(`${SUBSURFACE_DIG_JOB_PREFIX}_`) || job.id?.startsWith(`${SUBSURFACE_CLEAR_RUBBLE_JOB_PREFIX}_`));
    const queuedDigJobs = excavationJobs.filter(job => job.id?.startsWith(`${SUBSURFACE_DIG_JOB_PREFIX}_`) && !job.id?.startsWith(`${SUBSURFACE_CLEAR_RUBBLE_JOB_PREFIX}_`)).length;
    const queuedClearJobs = excavationJobs.filter(job => job.id?.startsWith(`${SUBSURFACE_CLEAR_RUBBLE_JOB_PREFIX}_`)).length;
    const assignedExcavationJobs = excavationJobs.filter(job => Boolean(job.assignedAgentId)).length;
    const activeWorkers = state.agents.filter(agent => agent.currentJobId && excavationJobs.some(job => job.id === agent.currentJobId)).length;
    const capacityBlocked = rubbleCapacity <= 0 || rubbleStored >= rubbleCapacity;

    let nextAction = 'Use Dig mode to mark an open-pit block.';
    if (capacityBlocked) nextAction = 'Build a Rubble & Resource Stockpile or clear dump space.';
    else if (queuedClearJobs > 0) nextAction = 'Workers are clearing rubble into available stockpile space.';
    else if (queuedDigJobs > 0) nextAction = 'Workers are cutting rock into rubble. Clear each pile before digging deeper.';
    else if (surfaceRubbleTiles > 0) nextAction = 'Click rubble piles in Dig mode to clear them before extracting ore.';
    else if (openPitTiles > 0 && deepestOpenPitDepth >= SUBSURFACE_MAX_OPEN_PIT_DEPTH) nextAction = 'Open-pit depth limit reached. Use a shaft for deeper mining later.';

    state.underground.openPit = {
        activeLayer: layeredWorld.activeY,
        surfaceLayer: layeredWorld.surfaceY,
        maxOpenPitDepth: SUBSURFACE_MAX_OPEN_PIT_DEPTH,
        deepestOpenPitDepth,
        openPitTiles,
        surfaceRubbleTiles,
        rubbleStored,
        rubbleCapacity,
        stockpileCapacity,
        undergroundDumpCapacity,
        queuedDigJobs,
        queuedClearJobs,
        assignedExcavationJobs,
        activeWorkers,
        capacityBlocked,
        nextAction,
    };
}
