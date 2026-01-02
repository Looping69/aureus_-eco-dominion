/**
 * Engine Render - Three.js Render Adapter
 * Concrete implementation of RenderAdapter for Three.js
 */

import * as THREE from 'three';
import { FrameContext } from '../kernel/Types';
import { RenderAdapter, RenderStats } from './RenderAdapter';

/** Three.js adapter configuration */
export interface ThreeRenderConfig {
    antialias: boolean;
    shadowMap: boolean;
    pixelRatio: number;
    clearColor: number;
    fogEnabled: boolean;
    fogColor: number;
    fogNear: number;
    fogFar: number;
}

const DEFAULT_CONFIG: ThreeRenderConfig = {
    antialias: true,
    shadowMap: true,
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    clearColor: 0x1a1a2e,
    fogEnabled: true,
    fogColor: 0x1a1a2e,
    fogNear: 40,
    fogFar: 120,
};

export class ThreeRenderAdapter implements RenderAdapter {
    private renderer!: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private container: HTMLElement | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private config: ThreeRenderConfig;

    constructor(config: Partial<ThreeRenderConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
        this.camera.position.set(0, 40, 50);
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Initialize the Three.js renderer
     */
    init(container: HTMLElement): void {
        this.container = container;

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: this.config.antialias,
            powerPreference: 'high-performance',
            alpha: true, // Enable transparency
        });

        this.renderer.setPixelRatio(this.config.pixelRatio);
        this.renderer.setClearColor(this.config.clearColor, 0); // Transparent clear
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        if (this.config.shadowMap) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        // Style for overlay
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.pointerEvents = 'none'; // Let clicks pass through for now
        this.renderer.domElement.style.zIndex = '10'; // On top of legacy

        container.appendChild(this.renderer.domElement);

        // Setup fog
        if (this.config.fogEnabled) {
            this.scene.fog = new THREE.Fog(
                this.config.fogColor,
                this.config.fogNear,
                this.config.fogFar
            );
        }

        // Handle resize
        this.resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                const { width, height } = entry.contentRect;
                this.resize(width, height);
            }
        });
        this.resizeObserver.observe(container);

        // Initial size
        this.resize(container.clientWidth, container.clientHeight);

        // Add default lighting
        this.setupDefaultLighting();
    }

    /**
     * Setup default scene lighting
     */
    private setupDefaultLighting(): void {
        // Ambient light
        const ambient = new THREE.AmbientLight(0x404050, 0.6);
        this.scene.add(ambient);

        // Main directional light (sun)
        const sun = new THREE.DirectionalLight(0xfff5e0, 1.0);
        sun.position.set(50, 80, 30);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 200;
        sun.shadow.camera.left = -60;
        sun.shadow.camera.right = 60;
        sun.shadow.camera.top = 60;
        sun.shadow.camera.bottom = -60;
        this.scene.add(sun);

        // Hemisphere light for ambient variation
        const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3d2817, 0.4);
        this.scene.add(hemi);
    }

    /**
     * Sync phase - update renderable state
     */
    sync(_ctx: FrameContext): void {
        // Override in game-specific adapter or use scene hooks
        // This is where instances/meshes would be updated
    }

    /**
     * Draw phase - render the scene
     */
    draw(_ctx: FrameContext): void {
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Handle container resize
     */
    resize(width: number, height: number): void {
        if (width <= 0 || height <= 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }

    /**
     * Dispose all resources
     */
    dispose(): void {
        this.resizeObserver?.disconnect();
        this.renderer?.dispose();

        // Dispose scene objects
        this.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry?.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material?.dispose();
                }
            }
        });

        this.scene.clear();
    }

    /**
     * Get renderer statistics
     */
    getStats(): RenderStats {
        const info = this.renderer.info;
        return {
            drawCalls: info.render.calls,
            triangles: info.render.triangles,
            points: info.render.points,
            lines: info.render.lines,
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            programs: info.programs?.length ?? 0,
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC ACCESSORS
    // ═══════════════════════════════════════════════════════════════

    /** Get the Three.js scene */
    getScene(): THREE.Scene {
        return this.scene;
    }

    /** Get the camera */
    getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }

    /** Get the renderer */
    getRenderer(): THREE.WebGLRenderer {
        return this.renderer;
    }

    /** Get the DOM canvas element */
    getCanvas(): HTMLCanvasElement {
        return this.renderer.domElement;
    }
}
