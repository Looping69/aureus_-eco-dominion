/**
 * Engine Tools - Debug HUD
 * Overlay for performance monitoring and debugging
 */

import { Runtime } from '../kernel/Runtime';
import { Profiler } from '../kernel/Profiler';
import { RenderStats } from '../render/RenderAdapter';

export interface DebugHudConfig {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    showFps: boolean;
    showTiming: boolean;
    showMemory: boolean;
    showRender: boolean;
}

const DEFAULT_CONFIG: DebugHudConfig = {
    position: 'top-right',
    showFps: true,
    showTiming: true,
    showMemory: true,
    showRender: true,
};

/**
 * Debug HUD overlay
 * Creates a DOM overlay for performance stats
 */
export class DebugHud {
    private container: HTMLDivElement | null = null;
    private config: DebugHudConfig;
    private runtime: Runtime | null = null;
    private getRenderStats: (() => RenderStats) | null = null;

    constructor(config: Partial<DebugHudConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize and attach to DOM
     */
    init(
        parent: HTMLElement,
        runtime: Runtime,
        getRenderStats?: () => RenderStats
    ): void {
        this.runtime = runtime;
        this.getRenderStats = getRenderStats || null;

        this.container = document.createElement('div');
        this.container.id = 'engine-debug-hud';
        this.container.style.cssText = this.getPositionStyles();

        parent.appendChild(this.container);
    }

    private getPositionStyles(): string {
        const base = `
      position: fixed;
      z-index: 10000;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      color: #00ff88;
      background: rgba(0, 0, 0, 0.8);
      padding: 8px 12px;
      pointer-events: none;
      border-radius: 4px;
      line-height: 1.5;
    `;

        switch (this.config.position) {
            case 'top-left':
                return base + 'top: 8px; left: 8px;';
            case 'top-right':
                return base + 'top: 8px; right: 8px;';
            case 'bottom-left':
                return base + 'bottom: 8px; left: 8px;';
            case 'bottom-right':
                return base + 'bottom: 8px; right: 8px;';
        }
    }

    /**
     * Update the HUD display
     * Call this once per frame (or less frequently for performance)
     */
    update(): void {
        if (!this.container || !this.runtime) return;

        const profiler = this.runtime.profiler;
        const status = this.runtime.getStatus();
        const lines: string[] = [];

        // FPS
        if (this.config.showFps) {
            const fps = status.fps.toFixed(0);
            const fpsColor = status.fps >= 55 ? '#00ff88' : status.fps >= 30 ? '#ffaa00' : '#ff4444';
            lines.push(`<span style="color:${fpsColor}">FPS: ${fps}</span> | Frame: ${status.frame}`);
        }

        // Timing
        if (this.config.showTiming) {
            lines.push('─── Timing ───');
            lines.push(`Frame:    ${profiler.get('frame').toFixed(2)}ms`);
            lines.push(`Stream:   ${profiler.get('streaming').toFixed(2)}ms`);
            lines.push(`Jobs:     ${profiler.get('jobsFlush').toFixed(2)}ms`);
            lines.push(`Sim:      ${profiler.get('simulation').toFixed(2)}ms`);
            lines.push(`Render:   ${profiler.get('renderSync').toFixed(2)}ms`);
            lines.push(`Draw:     ${profiler.get('draw').toFixed(2)}ms`);
        }

        // Memory
        if (this.config.showMemory && (performance as any).memory) {
            const mem = (performance as any).memory;
            const used = (mem.usedJSHeapSize / 1048576).toFixed(1);
            const total = (mem.totalJSHeapSize / 1048576).toFixed(1);
            lines.push('─── Memory ───');
            lines.push(`Heap: ${used} / ${total} MB`);
        }

        // Render stats
        if (this.config.showRender && this.getRenderStats) {
            const stats = this.getRenderStats();
            lines.push('─── Render ───');
            lines.push(`Draws: ${stats.drawCalls}`);
            lines.push(`Tris:  ${stats.triangles.toLocaleString()}`);
            lines.push(`Geoms: ${stats.geometries}`);
            lines.push(`Tex:   ${stats.textures}`);
        }

        this.container.innerHTML = lines.join('<br>');
    }

    /**
     * Show the HUD
     */
    show(): void {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }

    /**
     * Hide the HUD
     */
    hide(): void {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * Toggle visibility
     */
    toggle(): void {
        if (this.container) {
            this.container.style.display =
                this.container.style.display === 'none' ? 'block' : 'none';
        }
    }

    /**
     * Cleanup
     */
    dispose(): void {
        this.container?.remove();
        this.container = null;
    }
}
