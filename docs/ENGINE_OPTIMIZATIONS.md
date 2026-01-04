# Aureus Engine Optimization Guide

> **Last Updated:** 2026-01-04  
> **Status:** Planning Phase  
> **Target:** Maintain 60 FPS with large worlds and 50+ agents

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [High Impact Optimizations](#high-impact-optimizations)
3. [Medium Impact Optimizations](#medium-impact-optimizations)
4. [Quick Wins](#quick-wins)
5. [Profiling Targets](#profiling-targets)
6. [Implementation Roadmap](#implementation-roadmap)

---

## Architecture Overview

The Aureus engine uses a well-structured phase-based loop:

```
┌─────────────────────────────────────────────────────────────┐
│                        FRAME LOOP                           │
├──────────┬──────────┬──────────┬──────────┬────────┬───────┤
│  input   │streaming │jobsFlush │simulation│renderSync│ draw │
│  <1ms    │  <1ms    │   <1ms   │   <4ms   │  <2ms   │ <8ms │
└──────────┴──────────┴──────────┴──────────┴─────────┴──────┘
                           Target: 16.67ms total (60 FPS)
```

### Key Components

| Component | File | Responsibility |
|-----------|------|----------------|
| Runtime | `engine/kernel/Runtime.ts` | Main loop orchestration |
| Profiler | `engine/kernel/Profiler.ts` | Performance measurement |
| WorkerPool | `engine/jobs/WorkerPool.ts` | Parallel job execution |
| JobSystem | `engine/jobs/JobSystem.ts` | Job queue management |
| TerrainRenderSystem | `game/render/systems/TerrainRenderSystem.ts` | Chunk meshing & rendering |
| AgentSystem | `engine/sim/systems/AgentSystem.ts` | Agent AI & pathfinding |
| StateManager | `engine/state/StateManager.ts` | Authoritative game state |

---

## High Impact Optimizations

### 1. Greedy Meshing for Voxel Chunks

**File:** `engine/jobs/engine.worker.ts`  
**Function:** `processMeshChunk()` → `buildGeometry()`  
**Impact:** 60-80% reduction in triangle count  
**Effort:** High  

#### Problem

Current mesher generates per-voxel per-face geometry. For a 16×16×16 solid chunk, this can produce:
- Worst case: 16³ × 6 faces × 2 triangles = 49,152 triangles per chunk

#### Solution

Implement greedy meshing to merge coplanar, same-material faces into larger quads.

```typescript
// Before: Individual voxel faces
// ┌─┬─┬─┐
// ├─┼─┼─┤  = 9 quads (18 triangles)
// └─┴─┴─┘

// After: Greedy merged
// ┌─────┐
// │     │  = 1 quad (2 triangles)
// └─────┘
```

#### Implementation Outline

```typescript
function greedyMesh(voxels: Map<string, string>, axis: 'x' | 'y' | 'z') {
    // 1. Build 2D slices perpendicular to axis
    // 2. For each slice, find maximal rectangles of same material
    // 3. Emit single quad per rectangle
    // 4. Mark used voxels to avoid re-processing
}
```

#### References
- [0fps.net - Greedy Meshing](https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/)
- [Mikola Lysenko's Implementation](https://github.com/mikolalysenko/mikolern/blob/master/greedy.js)

---

### 2. Chunk Level-of-Detail (LOD) System

**File:** `game/render/systems/TerrainRenderSystem.ts`  
**Function:** `update()`  
**Impact:** 40-60% reduction in distant chunk geometry  
**Effort:** Medium  

#### Problem

All visible chunks are meshed at full 16×16 resolution regardless of distance.

#### Solution

```typescript
interface LODLevel {
    maxDistance: number;  // In chunks
    resolution: number;   // Voxels per edge (16, 8, 4, 2)
    skipMeshing: boolean; // For very far chunks
}

const LOD_LEVELS: LODLevel[] = [
    { maxDistance: 3, resolution: 16, skipMeshing: false },
    { maxDistance: 6, resolution: 8, skipMeshing: false },
    { maxDistance: 9, resolution: 4, skipMeshing: false },
    { maxDistance: 12, resolution: 2, skipMeshing: false },
    { maxDistance: Infinity, resolution: 0, skipMeshing: true },
];
```

#### Implementation

1. Calculate chunk distance in `update()`
2. Pass LOD level to `MeshChunkJob` payload
3. In worker, sample voxels at LOD resolution
4. Track current LOD per chunk to avoid re-meshing on small camera moves

---

### 3. Enable Frustum Culling

**File:** `game/render/systems/TerrainRenderSystem.ts`  
**Line:** 237  
**Impact:** 20-40% reduction in draw calls (view-dependent)  
**Effort:** Low (2-line change)  

#### Problem

```typescript
// Line 237 - Currently DISABLED
mesh.frustumCulled = false;
```

This forces Three.js to submit every chunk to the GPU, even those entirely off-screen.

#### Solution

```typescript
// Enable culling - let Three.js skip off-screen chunks
mesh.frustumCulled = true;

// Ensure bounding boxes are computed (already done on line 230-231)
geo.computeBoundingSphere();
geo.computeBoundingBox();
```

---

### 4. Object Pooling for Pathfinding

**File:** `engine/sim/systems/AgentSystem.ts`  
**Functions:** `goTo()`, path handling  
**Impact:** Reduced GC pressure, smoother frame times  
**Effort:** Medium  

#### Problem

Each pathfinding result allocates a new `number[]` for the path. With 50+ agents pathfinding every few seconds, this creates significant garbage.

#### Solution

```typescript
// New file: engine/utils/PathPool.ts

export class PathPool {
    private static pool: number[][] = [];
    private static readonly MAX_POOL_SIZE = 100;

    static acquire(minCapacity: number = 64): number[] {
        const path = this.pool.pop();
        if (path) {
            path.length = 0;
            return path;
        }
        return new Array(minCapacity);
    }

    static release(path: number[]): void {
        if (this.pool.length < this.MAX_POOL_SIZE) {
            path.length = 0;
            this.pool.push(path);
        }
    }
}
```

#### Usage

```typescript
// In AgentSystem.goTo()
const path = PathPool.acquire();
// ... populate path ...
agent.path = path;

// In AgentSystem.finishActivity() or when path completed
if (agent.path) {
    PathPool.release(agent.path);
    agent.path = null;
}
```

---

## Medium Impact Optimizations

### 5. Batch State Notifications

**File:** `engine/state/StateManager.ts`  
**Function:** `notifyIfDirty()`  
**Impact:** Reduced object allocation, faster React updates  
**Effort:** Medium  

#### Problem

```typescript
// Line 166-171 - Creates new object every dirty frame
notifyIfDirty(): void {
    if (this.dirtyFlag) {
        this.dirtyFlag = false;
        const snapshot = { ...this.state };  // ← Shallow copy every frame
        this.listeners.forEach(listener => listener(snapshot));
    }
}
```

#### Solutions

**Option A: Track dirty keys**
```typescript
private dirtyKeys = new Set<keyof GameState>();

mutate<K extends keyof GameState>(key: K, value: GameState[K]): void {
    this.state[key] = value;
    this.dirtyKeys.add(key);
}

notifyIfDirty(): void {
    if (this.dirtyKeys.size > 0) {
        const changes = Object.fromEntries(
            [...this.dirtyKeys].map(k => [k, this.state[k]])
        );
        this.dirtyKeys.clear();
        this.listeners.forEach(listener => listener(this.state, changes));
    }
}
```

**Option B: Immutable sub-states**
```typescript
// Only copy sub-objects that actually changed
if (agentsChanged) {
    this.state.agents = [...this.state.agents];
}
```

---

### 6. Binary Heap Job Queue

**File:** `engine/jobs/JobSystem.ts`  
**Function:** `enqueue()`  
**Impact:** O(log n) insert vs O(n log n) sort  
**Effort:** Medium  

#### Problem

```typescript
// Line 43 - Sorts entire queue on every enqueue
this.queue.sort((a, b) => b.priority - a.priority);
```

#### Solution

```typescript
// engine/utils/BinaryHeap.ts

export class BinaryHeap<T> {
    private heap: T[] = [];
    
    constructor(private compareFn: (a: T, b: T) => number) {}

    push(item: T): void {
        this.heap.push(item);
        this.bubbleUp(this.heap.length - 1);
    }

    pop(): T | undefined {
        if (this.heap.length === 0) return undefined;
        const top = this.heap[0];
        const last = this.heap.pop()!;
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this.bubbleDown(0);
        }
        return top;
    }

    private bubbleUp(i: number): void {
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.compareFn(this.heap[i], this.heap[parent]) >= 0) break;
            [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
            i = parent;
        }
    }

    private bubbleDown(i: number): void {
        const len = this.heap.length;
        while (true) {
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            let smallest = i;
            
            if (left < len && this.compareFn(this.heap[left], this.heap[smallest]) < 0) {
                smallest = left;
            }
            if (right < len && this.compareFn(this.heap[right], this.heap[smallest]) < 0) {
                smallest = right;
            }
            if (smallest === i) break;
            
            [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
            i = smallest;
        }
    }

    get length(): number { return this.heap.length; }
}
```

---

### 7. Persistent Worker Message Handler

**File:** `engine/jobs/WorkerPool.ts`  
**Function:** `dispatch()`  
**Impact:** Reduced event listener overhead  
**Effort:** Low  

#### Problem

```typescript
// Lines 94-109 - New handler per job
const handler = (e: MessageEvent) => {
    // ...
    entry.worker.removeEventListener('message', handler);
    // ...
};
entry.worker.addEventListener('message', handler);
```

#### Solution

```typescript
// In constructor or init()
for (const entry of this.workers) {
    entry.worker.onmessage = (e: MessageEvent) => {
        const result = e.data as JobResult;
        const pending = this.pendingJobs.get(result.jobId);
        if (pending) {
            this.pendingJobs.delete(result.jobId);
            pending.entry.busy = false;
            pending.entry.currentJobId = null;
            this.jobSystem.pushResult(result);
        }
    };
}
```

---

### 8. Dynamic Shadow Quality

**File:** `engine/render/ThreeRenderAdapter.ts`  
**Function:** `setupDefaultLighting()`  
**Impact:** Lower GPU memory on weak devices  
**Effort:** Low  

#### Current

```typescript
// Lines 122-123 - Fixed 2048×2048
this.directionalLight.shadow.mapSize.width = 2048;
this.directionalLight.shadow.mapSize.height = 2048;
```

#### Solution

```typescript
private getShadowMapSize(): number {
    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = (navigator as any).deviceMemory ?? 4;
    
    if (cores >= 8 && memory >= 8) return 2048;
    if (cores >= 4 && memory >= 4) return 1024;
    return 512;
}

// In setupDefaultLighting()
const shadowSize = this.getShadowMapSize();
this.directionalLight.shadow.mapSize.width = shadowSize;
this.directionalLight.shadow.mapSize.height = shadowSize;
```

---

## Quick Wins

### 9. Numeric Hash Keys for Voxels

**File:** `engine/jobs/engine.worker.ts`  
**Lines:** 100-101  
**Impact:** ~30% faster voxel lookup  
**Effort:** Low  

#### Before

```typescript
const getKey = (x: number, y: number, z: number) => `${x},${y},${z}`;
```

#### After

```typescript
// Pack coords into single integer (assumes x,y,z in range [-512, 511])
const getKey = (x: number, y: number, z: number): number => 
    ((x + 512) & 0x3FF) | 
    (((y + 512) & 0x3FF) << 10) | 
    (((z + 512) & 0x3FF) << 20);

// Change Map type
const baseVoxels = new Map<number, string>();
```

---

### 10. Reuse Geometry Buffers

**File:** `engine/jobs/engine.worker.ts`  
**Function:** `buildGeometry()`  
**Impact:** Reduced allocation in hot path  
**Effort:** Low  

#### Before

```typescript
// Lines 239-242 - New arrays per chunk
const positions: number[] = [];
const normals: number[] = [];
const colors: number[] = [];
const uvs: number[] = [];
```

#### After

```typescript
// Pre-allocated buffers (reused between chunks)
const BUFFER_SIZE = 65536;
const positionBuffer = new Float32Array(BUFFER_SIZE * 3);
const normalBuffer = new Float32Array(BUFFER_SIZE * 3);
const colorBuffer = new Float32Array(BUFFER_SIZE * 3);
const uvBuffer = new Float32Array(BUFFER_SIZE * 2);

function buildGeometry(map: Map<number, string>) {
    let vertexCount = 0;
    
    // Write directly to typed arrays
    for (const [key, mat] of map) {
        // ... write to buffers at vertexCount offset ...
        vertexCount += 6;
    }
    
    // Return sliced views
    return {
        positions: positionBuffer.subarray(0, vertexCount * 3),
        normals: normalBuffer.subarray(0, vertexCount * 3),
        colors: colorBuffer.subarray(0, vertexCount * 3),
        uvs: uvBuffer.subarray(0, vertexCount * 2),
    };
}
```

---

### 11. Skip Profiler in Release Mode

**File:** `engine/kernel/Profiler.ts`  
**Impact:** Eliminates profiler overhead entirely  
**Effort:** Low  

```typescript
// Add build-time constant
const PROFILER_ENABLED = import.meta.env.DEV;

export class Profiler {
    begin(label: string): void {
        if (!PROFILER_ENABLED) return;
        if (!this.enabled) return;
        this.marks.set(label, performance.now());
    }
    
    end(label: string): number {
        if (!PROFILER_ENABLED) return 0;
        // ...
    }
}
```

---

## Profiling Targets

Use the built-in `Profiler` to measure each phase. Add this to a debug UI:

```typescript
// In AureusWorld or debug component
const stats = runtime.getProfiler().getAllStats();
console.table(Object.fromEntries(
    [...stats.entries()].map(([k, v]) => [k, v.average.toFixed(2) + 'ms'])
));
```

### Target Budgets

| Phase | Target | Warning | Critical |
|-------|--------|---------|----------|
| `frame` | <16.67ms | 16-20ms | >20ms |
| `input` | <0.5ms | 0.5-1ms | >1ms |
| `streaming` | <1ms | 1-2ms | >2ms |
| `jobsFlush` | <1ms | 1-2ms | >2ms |
| `simulation` | <4ms | 4-6ms | >6ms |
| `renderSync` | <2ms | 2-4ms | >4ms |
| `draw` | <8ms | 8-12ms | >12ms |

### Memory Targets

| Metric | Target | Warning |
|--------|--------|---------|
| Heap Used | <100MB | >150MB |
| Geometries | <200 | >500 |
| Textures | <50 | >100 |
| Draw Calls | <100 | >200 |

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 hours)
- [x] Document optimizations
- [ ] Enable frustum culling
- [ ] Numeric voxel keys
- [ ] Skip profiler in production

### Phase 2: Memory (4-6 hours)
- [ ] Path object pooling
- [ ] Reusable geometry buffers
- [ ] Persistent worker handlers

### Phase 3: Rendering (8-12 hours)
- [ ] Greedy meshing implementation
- [ ] Dynamic shadow quality
- [ ] Chunk LOD system

### Phase 4: Architecture (4-8 hours)
- [ ] Binary heap job queue
- [ ] Batched state notifications
- [ ] Delta-based worker sync

---

## Appendix: Measurement Commands

```typescript
// Add to console for quick profiling
window.engineProfile = () => {
    const p = window.aureusWorld?.getProfiler?.();
    if (p) console.log(p.report());
};

window.renderStats = () => {
    const r = window.aureusWorld?.render?.getStats?.();
    if (r) console.table(r);
};
```
