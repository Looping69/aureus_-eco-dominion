/**
 * Aureus Engine - Main Export
 * 
 * A modular voxel game engine built for:
 * - Deterministic fixed-step simulation
 * - Streaming/chunked worlds
 * - Worker-based parallel processing
 * - Clean separation of simulation and rendering
 * 
 * Frame Spine Order:
 * 1. Input (frameBegin)
 * 2. Streaming (chunk load/unload decisions)
 * 3. Jobs Flush (apply worker results)
 * 4. Simulation (fixed-step gameplay)
 * 5. Render Sync (update meshes from state)
 * 6. Draw (GPU submit)
 * 7. Frame End (cleanup, telemetry)
 * 
 * (|/) Klaasvaakie
 */

// Kernel
export * from './kernel';

// World
export * from './world';

// Space (Chunking/Streaming)
export * from './space';

// Jobs (Worker Tasks)
export * from './jobs';

// Render (Three.js Adapter)
export * from './render';

// Simulation
export * from './sim';

// Tools (Debug)
export * from './tools';
