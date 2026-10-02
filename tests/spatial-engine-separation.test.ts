import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ChunkStore } from '../game/space/ChunkStore';
import { findPath } from '../game/sim/algorithms/Pathfinding';
import { ensureChunk, getTile } from '../engine/space/TileStore';
import { findGridPath } from '../engine/sim/algorithms/GridPathfinding';
import { WorkerPool } from '../engine/jobs/WorkerPool';
import type { Chunk } from '../types';

test('Aureus chunks and exact routes preserve pre-extraction fixtures', () => {
    const fixtures = JSON.parse(readFileSync(new URL('./fixtures/spatial-before-extraction.json', import.meta.url), 'utf8'));
    for (const fixture of fixtures) {
        const chunks: Record<string, Chunk> = {};
        const ordered = [[-1,-1],[-1,0],[0,-1],[0,0],[1,0]].map(([cx,cz]) => {
            const chunk = ChunkStore.ensureChunk(chunks,cx,cz,fixture.seed);
            return { cx, cz, tiles: chunk.tiles };
        });
        assert.equal(createHash('sha256').update(JSON.stringify(ordered)).digest('hex'), fixture.digest);
        const paths = [[-2,-2,3,3],[-16,0,17,2],[0,0,0,0],[0,0,90,90]].map(([sx,sz,ex,ez]) => findPath(sx,sz,ex,ez,chunks));
        assert.deepEqual(paths, fixture.paths);
    }
});

test('tile storage accepts unrelated tiles and preserves negative-coordinate indexing', () => {
    const chunks: Record<string, {tiles: string[]}> = {};
    let calls = 0;
    const factory = () => { calls++; return {tiles:['a','b','c','d']}; };
    const first = ensureChunk(chunks,-1,-1,factory);
    assert.equal(ensureChunk(chunks,-1,-1,factory), first);
    assert.equal(calls,1);
    assert.equal(getTile(chunks,-1,-1,2),'d');
    assert.equal(getTile(chunks,-2,-2,2),'a');
    assert.equal(getTile(chunks,0,0,2),null);
});

test('generic pathfinding uses supplied traversal rules without Aureus tiles', () => {
    assert.deepEqual(findGridPath(0,0,2,0,(x,z) => z === 0 && x >= 0 && x <= 2 ? 1 : null), [{x:1,z:0},{x:2,z:0}]);
    assert.equal(findGridPath(0,0,2,0,() => null),null);
});

test('worker pool requires a game-supplied worker implementation', () => {
    assert.throws(() => new WorkerPool().init(), /requires a worker factory/);
    let created = 0;
    const pool = new WorkerPool({workerCount:2,createWorker:() => { created++; return {terminate(){}} as Worker; }});
    pool.init();
    pool.init();
    assert.equal(created,2);
});
