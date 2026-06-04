/**
 * Engine Worker
 * Handles heavy computations in a background thread:
 * - Pathfinding
 * - Terrain Meshing (Surface Shell Optimized)
 * (|/) Klaasvaakie
 */

import { GridTile, Chunk } from '../../types';
import { getTerrainMacroStep } from '../render/utils/TerrainLod';
import { getBiomeAt as getBiomeAtImpl, getFoliageAt as getFoliageAtImpl } from '../worldgen/Core';
import { Job, PathfindJob, PathfindResult, MeshChunkJob, MeshChunkResult, ENGINE_SCHEMA_VERSION } from './jobs.types';
import { findPath } from '../sim/algorithms/Pathfinding';

let localChunks: Record<string, Chunk> = {};
const VOXEL_SIDE_EPSILON = 0.01;
const BLOCK_TOP_NORMAL: [number, number, number] = [0, 1, 0];

const PALETTE: Record<string, number[]> = {
    'grass': [0.42, 0.60, 0.27],
    'grassLight': [0.56, 0.68, 0.31],
    'dirt': [0.44, 0.30, 0.18],
    'sand': [0.78, 0.68, 0.48],
    'stone': [0.44, 0.47, 0.48],
    'snow': [0.86, 0.88, 0.84],
    'water': [0.16, 0.52, 0.62],
    'concrete': [0.56, 0.60, 0.64],
    'wood': [0.48, 0.30, 0.16],
    'leaf': [0.20, 0.43, 0.18],
    'pine': [0.12, 0.28, 0.16],
    'birch': [0.78, 0.74, 0.63],
    'birchLeaf': [0.43, 0.55, 0.24],
    'cactus': [0.28, 0.48, 0.28],
    'rock': [0.42, 0.42, 0.40],
    'flower': [0.64, 0.28, 0.56],
    'flowerYellow': [0.82, 0.66, 0.18],
    'dead': [0.32, 0.28, 0.22],
    'crystal': [0.32, 0.70, 0.72],
    'gold': [0.86, 0.65, 0.18]
};

self.onmessage = (e: MessageEvent) => {
    const msg = e.data;

    if (msg.type === 'SYNC_CHUNKS') {
        localChunks = msg.payload;
        return;
    }

    if (msg.type === 'UPDATE_CHUNK') {
        const { key, chunk } = msg.payload;
        localChunks[key] = chunk;
        return;
    }

    const job = msg as Job;
    if (!job.id || !job.kind) return;

    if (job.schemaVersion !== ENGINE_SCHEMA_VERSION) {
        console.warn(`[EngineWorker] Schema version mismatch. Job: ${job.schemaVersion}, Internal: ${ENGINE_SCHEMA_VERSION}. This is normal during hmr/build.`);
    }

    try {
        let result: any = null;

        if (job.kind === 'PATHFIND') {
            result = processPathfind(job as PathfindJob);
        } else if (job.kind === 'MESH_CHUNK') {
            result = processMeshChunk(job as MeshChunkJob);
        }

        if (result) {
            if (job.kind === 'MESH_CHUNK' && result.success) {
                const transfer: Transferable[] = [];
                if (result.solid) transfer.push(result.solid.p.buffer, result.solid.n.buffer, result.solid.c.buffer, result.solid.u.buffer);
                if (result.water) transfer.push(result.water.p.buffer, result.water.n.buffer, result.water.c.buffer, result.water.u.buffer);
                if (result.ghost) transfer.push(result.ghost.p.buffer, result.ghost.n.buffer, result.ghost.c.buffer, result.ghost.u.buffer);
                (self as unknown as Worker).postMessage(result, transfer);
            } else {
                self.postMessage(result);
            }
        }
    } catch (err) {
        self.postMessage({
            jobId: job.id,
            kind: job.kind,
            success: false,
            error: String(err),
            completedAt: Date.now(),
            queuedAt: job.queuedAt,
            schemaVersion: ENGINE_SCHEMA_VERSION
        });
    }
};

function processMeshChunk(job: MeshChunkJob): MeshChunkResult {
    const { cx, cz, tiles, lod = 1 } = job.payload;
    const CHUNK_SIZE = 16;
    const macroStep = getTerrainMacroStep(lod);
    const surfaceStep = Math.max(1, macroStep);
    const foliageStep = Math.max(1, macroStep);

    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    const chunkKey = `${cx},${cz}`;
    if (!localChunks[chunkKey]) {
        localChunks[chunkKey] = {
            id: job.payload.chunkId,
            x: cx,
            z: cz,
            tiles: tiles || [],
            buildings: {},
        } as any;
    } else {
        localChunks[chunkKey].tiles = tiles || [];
    }

    const foliageItems: any[] = [];
    const solid = { p: [] as number[], n: [] as number[], c: [] as number[], u: [] as number[] };
    const water = { p: [] as number[], n: [] as number[], c: [] as number[], u: [] as number[] };
    const ghost = { p: [] as number[], n: [] as number[], c: [] as number[], u: [] as number[] };

    const tileMap = new Map<string, GridTile>();
    if (tiles) tiles.forEach(t => tileMap.set(`${t.x},${t.z}`, t));

    const pushVertex = (dest: any, vertex: [number, number, number], normal: [number, number, number], color: number[], uv: [number, number]) => {
        dest.p.push(vertex[0], vertex[1], vertex[2]);
        dest.n.push(normal[0], normal[1], normal[2]);
        dest.c.push(color[0], color[1], color[2]);
        dest.u.push(uv[0], uv[1]);
    };

    const computeNormal = (a: [number, number, number], b: [number, number, number], c: [number, number, number]): [number, number, number] => {
        const abx = b[0] - a[0];
        const aby = b[1] - a[1];
        const abz = b[2] - a[2];
        const acx = c[0] - a[0];
        const acy = c[1] - a[1];
        const acz = c[2] - a[2];
        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;
        const length = Math.hypot(nx, ny, nz) || 1;
        return [nx / length, ny / length, nz / length];
    };

    const addQuad = (
        dest: any,
        a: [number, number, number],
        b: [number, number, number],
        c: [number, number, number],
        d: [number, number, number],
        color: number[]
    ) => {
        const n1 = computeNormal(a, b, c);
        const n2 = computeNormal(a, c, d);
        pushVertex(dest, a, n1, color, [0, 0]);
        pushVertex(dest, b, n1, color, [1, 0]);
        pushVertex(dest, c, n1, color, [1, 1]);
        pushVertex(dest, a, n2, color, [0, 0]);
        pushVertex(dest, c, n2, color, [1, 1]);
        pushVertex(dest, d, n2, color, [0, 1]);
    };

    const addFace = (
        dest: any,
        sx: number,
        sy: number,
        sz: number,
        type: number,
        color: number[],
        hx: number = 0.5,
        hy: number = 0.5,
        hz: number = 0.5
    ) => {
        let v1: [number, number, number], v2: [number, number, number], v3: [number, number, number], v4: [number, number, number];
        if (type === 0) { v1 = [sx + hx, sy - hy, sz + hz]; v2 = [sx + hx, sy - hy, sz - hz]; v3 = [sx + hx, sy + hy, sz - hz]; v4 = [sx + hx, sy + hy, sz + hz]; }
        else if (type === 1) { v1 = [sx - hx, sy - hy, sz - hz]; v2 = [sx - hx, sy - hy, sz + hz]; v3 = [sx - hx, sy + hy, sz + hz]; v4 = [sx - hx, sy + hy, sz - hz]; }
        else if (type === 2) { v1 = [sx - hx, sy + hy, sz + hz]; v2 = [sx + hx, sy + hy, sz + hz]; v3 = [sx + hx, sy + hy, sz - hz]; v4 = [sx - hx, sy + hy, sz - hz]; }
        else if (type === 3) { v1 = [sx - hx, sy - hy, sz - hz]; v2 = [sx + hx, sy - hy, sz - hz]; v3 = [sx + hx, sy - hy, sz + hz]; v4 = [sx - hx, sy - hy, sz + hz]; }
        else if (type === 4) { v1 = [sx - hx, sy - hy, sz + hz]; v2 = [sx + hx, sy - hy, sz + hz]; v3 = [sx + hx, sy + hy, sz + hz]; v4 = [sx - hx, sy + hy, sz + hz]; }
        else { v1 = [sx + hx, sy - hy, sz - hz]; v2 = [sx - hx, sy - hy, sz - hz]; v3 = [sx - hx, sy + hy, sz - hz]; v4 = [sx + hx, sy + hy, sz - hz]; }
        addQuad(dest, v1, v2, v3, v4, color);
    };

    const addBlockTop = (
        dest: any,
        centerX: number,
        centerZ: number,
        hx: number,
        hz: number,
        topY: number,
        color: number[]
    ) => {
        const nw: [number, number, number] = [centerX - hx, topY, centerZ + hz];
        const ne: [number, number, number] = [centerX + hx, topY, centerZ + hz];
        const se: [number, number, number] = [centerX + hx, topY, centerZ - hz];
        const sw: [number, number, number] = [centerX - hx, topY, centerZ - hz];
        pushVertex(dest, nw, BLOCK_TOP_NORMAL, color, [0, 0]);
        pushVertex(dest, ne, BLOCK_TOP_NORMAL, color, [1, 0]);
        pushVertex(dest, se, BLOCK_TOP_NORMAL, color, [1, 1]);
        pushVertex(dest, nw, BLOCK_TOP_NORMAL, color, [0, 0]);
        pushVertex(dest, se, BLOCK_TOP_NORMAL, color, [1, 1]);
        pushVertex(dest, sw, BLOCK_TOP_NORMAL, color, [0, 1]);
    };

    const getBlockSideColor = (color: number[]) => color.map((channel) => Math.min(1, Math.max(0, channel * 0.78 + 0.06)));

    const addBlockSide = (
        dest: any,
        edgeType: number,
        centerX: number,
        centerZ: number,
        hx: number,
        hz: number,
        topY: number,
        bottomY: number,
        color: number[]
    ) => {
        if (topY - bottomY <= VOXEL_SIDE_EPSILON) {
            return;
        }

        let v1: [number, number, number], v2: [number, number, number], v3: [number, number, number], v4: [number, number, number];
        if (edgeType === 0) {
            v1 = [centerX + hx, bottomY, centerZ + hz];
            v2 = [centerX + hx, bottomY, centerZ - hz];
            v3 = [centerX + hx, topY, centerZ - hz];
            v4 = [centerX + hx, topY, centerZ + hz];
        } else if (edgeType === 1) {
            v1 = [centerX - hx, bottomY, centerZ - hz];
            v2 = [centerX - hx, bottomY, centerZ + hz];
            v3 = [centerX - hx, topY, centerZ + hz];
            v4 = [centerX - hx, topY, centerZ - hz];
        } else if (edgeType === 4) {
            v1 = [centerX - hx, bottomY, centerZ + hz];
            v2 = [centerX + hx, bottomY, centerZ + hz];
            v3 = [centerX + hx, topY, centerZ + hz];
            v4 = [centerX - hx, topY, centerZ + hz];
        } else {
            v1 = [centerX + hx, bottomY, centerZ - hz];
            v2 = [centerX - hx, bottomY, centerZ - hz];
            v3 = [centerX - hx, topY, centerZ - hz];
            v4 = [centerX + hx, topY, centerZ - hz];
        }
        addQuad(dest, v1, v2, v3, v4, getBlockSideColor(color));
    };

    const getTile = (gx: number, gz: number): GridTile | null => {
        const key = `${gx},${gz}`;
        if (tileMap.has(key)) return tileMap.get(key)!;

        const chunkX = Math.floor(gx / CHUNK_SIZE);
        const chunkZ = Math.floor(gz / CHUNK_SIZE);
        const neighborChunkKey = `${chunkX},${chunkZ}`;
        const chunk = localChunks[neighborChunkKey];
        if (chunk) {
            return chunk.tiles.find(t => t.x === gx && t.z === gz) || null;
        }
        return null;
    };

    const getData = (gx: number, gz: number) => {
        const t = getTile(gx, gz);
        if (t) {
            return { h: t.terrainHeight, b: t.biome, bt: t.buildingType, f: t.foliage || 'NONE', in: true, marked: t.markedForHarvest };
        }

        const data = getBiomeAtImpl(gx, gz);
        return { h: data.height, b: data.biome, bt: 'EMPTY', f: 'NONE', in: false, marked: false };
    };

    const getTopSurfaceY = (data: { h: number; bt: string; in: boolean }) => {
        let topY = (data.h * 0.5) - 0.5;
        if (data.bt === 'POND' || data.bt === 'RESERVOIR') topY -= 1;
        else if (!data.in && data.h === 0) topY = -2;
        return topY;
    };

    const getMacroData = (worldX: number, worldZ: number, cellWidth: number, cellDepth: number) => {
        const sampleX = Math.min(worldX + Math.floor((cellWidth - 1) * 0.5), startX + CHUNK_SIZE - 1);
        const sampleZ = Math.min(worldZ + Math.floor((cellDepth - 1) * 0.5), startZ + CHUNK_SIZE - 1);
        const data = getData(sampleX, sampleZ);

        let fType = data.f;
        if ((!fType || fType === 'NONE') && data.bt === 'EMPTY' && data.h > 0) {
            const bd = getBiomeAtImpl(sampleX, sampleZ);
            fType = getFoliageAtImpl(sampleX, sampleZ, data.b, data.h, bd.detail);
            if (fType === 'GOLD_VEIN') {
                fType = 'NONE';
            }
        }

        return {
            worldX,
            worldZ,
            sampleX,
            sampleZ,
            cellWidth,
            cellDepth,
            localCenterX: (worldX - startX) + (cellWidth - 1) * 0.5,
            localCenterZ: (worldZ - startZ) + (cellDepth - 1) * 0.5,
            data,
            foliageType: fType,
        };
    };

    for (let z = 0; z < CHUNK_SIZE; z += surfaceStep) {
        for (let x = 0; x < CHUNK_SIZE; x += surfaceStep) {
            const worldX = startX + x;
            const worldZ = startZ + z;
            const cellWidth = Math.min(surfaceStep, CHUNK_SIZE - x);
            const cellDepth = Math.min(surfaceStep, CHUNK_SIZE - z);
            const macro = getMacroData(worldX, worldZ, cellWidth, cellDepth);
            const data = macro.data;
            const isWater = data.bt === 'POND' || data.bt === 'RESERVOIR' || (!data.in && data.h === 0);
            const topY = getTopSurfaceY(data);

            if (x % foliageStep === 0 && z % foliageStep === 0 && macro.foliageType && macro.foliageType !== 'NONE' && macro.foliageType !== 'GOLD_VEIN') {
                foliageItems.push({
                    x: macro.sampleX,
                    y: data.h * 0.5,
                    z: macro.sampleZ,
                    type: macro.foliageType,
                    marked: data.marked
                });
            }

            let matKey = data.b.toLowerCase();
            if (data.b === 'GRASS' && data.h > 2) matKey = 'grassLight';
            const color = PALETTE[matKey] || [1, 1, 1];

            addBlockTop(
                solid,
                macro.localCenterX,
                macro.localCenterZ,
                cellWidth * 0.5,
                cellDepth * 0.5,
                topY,
                color,
            );

            [
                [cellWidth, 0, 0],
                [-surfaceStep, 0, 1],
                [0, cellDepth, 4],
                [0, -surfaceStep, 5]
            ].forEach(([dx, dz, type]) => {
                const neighborTopY = getTopSurfaceY(getData(worldX + dx, worldZ + dz));
                addBlockSide(
                    solid,
                    type,
                    macro.localCenterX,
                    macro.localCenterZ,
                    cellWidth * 0.5,
                    cellDepth * 0.5,
                    topY,
                    neighborTopY,
                    color
                );
            });

            if (isWater) {
                const waterY = data.h === 0 ? 0 : (data.h * 0.5) - 0.5;
                addFace(
                    water,
                    macro.localCenterX,
                    waterY,
                    macro.localCenterZ,
                    2,
                    PALETTE['water'],
                    cellWidth * 0.5,
                    0.5,
                    cellDepth * 0.5
                );
            }
        }
    }

    const serialize = (geo: any) => {
        if (geo.p.length === 0) return null;
        return {
            p: new Float32Array(geo.p),
            n: new Float32Array(geo.n),
            c: new Float32Array(geo.c),
            u: new Float32Array(geo.u)
        };
    };

    return {
        jobId: job.id,
        kind: 'MESH_CHUNK',
        success: true,
        completedAt: Date.now(),
        chunkId: job.payload.chunkId,
        solid: serialize(solid),
        water: serialize(water),
        ghost: serialize(ghost),
        foliage: foliageItems,
        cx, cz, lod,
        queuedAt: job.queuedAt,
        schemaVersion: ENGINE_SCHEMA_VERSION
    };
}

function processPathfind(job: PathfindJob): PathfindResult {
    const path = findPath(job.startX, job.startZ, job.endX, job.endZ, localChunks);
    return {
        jobId: job.id,
        kind: 'PATHFIND',
        success: !!path,
        completedAt: Date.now(),
        queuedAt: job.queuedAt,
        agentId: job.agentId,
        path: path,
        schemaVersion: ENGINE_SCHEMA_VERSION
    };
}