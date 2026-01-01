/**
 * Engine Render - Render Adapter Interface
 * Abstract interface for rendering backends (Three.js, WebGPU, etc)
 */

import { FrameContext } from '../kernel/Types';

/** Renderer statistics */
export interface RenderStats {
    drawCalls: number;
    triangles: number;
    points: number;
    lines: number;
    geometries: number;
    textures: number;
    programs: number;
}

/**
 * Render adapter interface
 * Implement this to support different rendering backends
 */
export interface RenderAdapter {
    /** Initialize renderer with DOM container */
    init(container: HTMLElement): void;

    /** 
     * Sync phase: Update renderable state from authoritative data
     * This is where you update meshes, instances, etc.
     * DO NOT create new truth here - only reflect existing state.
     */
    sync(ctx: FrameContext): void;

    /** 
     * Draw phase: Submit draw calls to GPU
     */
    draw(ctx: FrameContext): void;

    /** 
     * Handle resize events
     */
    resize(width: number, height: number): void;

    /** 
     * Cleanup all GPU resources
     */
    dispose(): void;

    /** 
     * Get current render stats
     */
    getStats(): RenderStats;
}
