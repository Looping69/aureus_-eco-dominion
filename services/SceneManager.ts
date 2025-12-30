
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { COLORS } from '../utils/voxelConstants';

export class SceneManager {
    public scene: THREE.Scene;
    public camera: THREE.OrthographicCamera;
    public renderer: THREE.WebGLRenderer;

    // Camera State
    public cameraZoom = 40;
    public cameraFocus = new THREE.Vector3(0, 0, 0);
    public cameraAngle = Math.PI / 4;
    public cameraElevation = Math.PI / 3.5;

    // Environment State (For smooth transitions)
    private targetBgColor = new THREE.Color(COLORS.BG);
    private currentBgColor = new THREE.Color(COLORS.BG);

    private targetFogColor = new THREE.Color(COLORS.BG);
    private currentFogColor = new THREE.Color(COLORS.BG);
    private targetFogDensity = 0.0;
    private currentFogDensity = 0.0;

    private targetLightColor = new THREE.Color(0xffcd75);
    private currentLightColor = new THREE.Color(0xffcd75);
    private targetLightIntensity = 1.2;
    private currentLightIntensity = 1.2;

    private dirLight: THREE.DirectionalLight;
    private ambientLight: THREE.AmbientLight;

    // Weather Systems
    private rainSystem: THREE.InstancedMesh | null = null;
    private isRaining = false;

    public shadowsEnabled = true;
    public isMobile = false;

    constructor(container: HTMLElement, gridSize: number) {
        this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 800;

        this.scene = new THREE.Scene();
        this.scene.background = this.currentBgColor;
        this.scene.fog = new THREE.FogExp2(this.currentFogColor, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: !this.isMobile, // Disable MSAA on mobile for performance
            alpha: false,
            powerPreference: 'high-performance',
            precision: this.isMobile ? 'mediump' : 'highp'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Cap pixel ratio to 1 on mobile to prevent massive fill-rate cost
        this.renderer.setPixelRatio(this.isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5));

        this.renderer.shadowMap.enabled = true;
        // Use faster shadow map type on mobile
        this.renderer.shadowMap.type = this.isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = this.cameraZoom;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            -1000, 2000
        );
        this.updateCameraTransform();

        // Lights
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(this.ambientLight);

        const cx = gridSize / 2;
        const cz = gridSize / 2;
        this.dirLight = new THREE.DirectionalLight(this.currentLightColor, this.currentLightIntensity);
        this.dirLight.position.set(cx + 20, 60, cz + 20);
        this.dirLight.target.position.set(cx, 0, cz);
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);

        this.dirLight.castShadow = true;
        // Reduced shadow map size for performance (1024 desktop, 512 mobile)
        const shadowSize = this.isMobile ? 512 : 1024;
        this.dirLight.shadow.mapSize.width = shadowSize;
        this.dirLight.shadow.mapSize.height = shadowSize;

        // Tweak bias to prevent artifacts with lower precision
        this.dirLight.shadow.bias = -0.0005;

        // Initialize Rain System
        this.initRainSystem();

        // Bind resize
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
    }

    private initRainSystem() {
        // Heavily reduced particle count for performance
        const count = this.isMobile ? 100 : 500;
        const geo = new THREE.BoxGeometry(0.05, 0.8, 0.05);
        const mat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 });
        this.rainSystem = new THREE.InstancedMesh(geo, mat, count);
        this.rainSystem.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.rainSystem.visible = false;

        // Randomize initial positions
        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * 100,
                Math.random() * 60,
                (Math.random() - 0.5) * 100
            );
            dummy.updateMatrix();
            this.rainSystem.setMatrixAt(i, dummy.matrix);
        }
        this.scene.add(this.rainSystem);
    }

    public updateCameraTransform() {
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = this.cameraZoom;
        this.camera.left = -frustumSize * aspect / 2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;
        this.camera.updateProjectionMatrix();

        const dist = 100;
        const y = dist * Math.sin(this.cameraElevation);
        const h = dist * Math.cos(this.cameraElevation);
        const x = h * Math.sin(this.cameraAngle);
        const z = h * Math.cos(this.cameraAngle);

        this.camera.position.set(this.cameraFocus.x + x, this.cameraFocus.y + y, this.cameraFocus.z + z);
        this.camera.lookAt(this.cameraFocus);
    }

    public pan(delta: THREE.Vector3) {
        this.camera.position.add(delta);
        this.cameraFocus.add(delta);
        this.updateCameraTransform();
    }

    public rotate(deltaX: number) {
        this.cameraAngle -= deltaX * 0.005;
        this.updateCameraTransform();
    }

    public zoom(delta: number) {
        this.cameraZoom = Math.max(10, Math.min(150, this.cameraZoom + delta * 0.2));
        this.updateCameraTransform();
    }

    public playIntroAnimation(onComplete: () => void) {
        let progress = 0;
        const startZoom = 150;
        const targetZoom = this.cameraZoom;

        const animate = () => {
            progress += 0.015;
            if (progress >= 1) {
                this.cameraZoom = targetZoom;
                this.updateCameraTransform();
                onComplete();
                return;
            }
            this.cameraZoom = startZoom + (targetZoom - startZoom) * (1 - Math.pow(1 - progress, 3));
            this.updateCameraTransform();
            requestAnimationFrame(animate);
        };
        animate();
    }

    public setShadowsEnabled(enabled: boolean) {
        if (this.shadowsEnabled === enabled) return;
        this.shadowsEnabled = enabled;
        this.dirLight.castShadow = enabled;
        // Adjust ambient slightly to compensate for loss of GI-like bounce or contrast
        this.ambientLight.intensity = enabled ? 0.7 : 0.85;
    }

    private handleResize() {
        this.updateCameraTransform();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // --- Environment Control ---

    public setEnvironmentTarget(type: 'NORMAL' | 'TOXIC' | 'HEAT' | 'GOLDEN') {
        if (type === 'TOXIC') {
            this.targetBgColor.setHex(0x1a2e1a); // Dark Green
            this.targetFogColor.setHex(0x2d4a2d); // Green Fog
            this.targetFogDensity = 0.03;
            this.targetLightColor.setHex(0x88ff88); // Sickly Green Light
            this.targetLightIntensity = 0.6; // Dim
            this.isRaining = true;
        } else if (type === 'HEAT') {
            this.targetBgColor.setHex(0x552200); // Deep Orange/Red
            this.targetFogColor.setHex(0xffaa00);
            this.targetFogDensity = 0.005; // Light haze
            this.targetLightColor.setHex(0xffaa55); // Orange Light
            this.targetLightIntensity = 1.8; // Bright/Harsh
            this.isRaining = false;
        } else if (type === 'GOLDEN') {
            this.targetBgColor.setHex(0x332200); // Gold-ish dark
            this.targetFogColor.setHex(0xffd700);
            this.targetFogDensity = 0.01;
            this.targetLightColor.setHex(0xffe066);
            this.targetLightIntensity = 1.4;
            this.isRaining = false;
        } else {
            // NORMAL
            this.targetBgColor.setHex(COLORS.BG);
            this.targetFogColor.setHex(COLORS.BG);
            this.targetFogDensity = 0.0;
            this.targetLightColor.setHex(0xffcd75);
            this.targetLightIntensity = 1.2;
            this.isRaining = false;
        }
    }

    public updateEnvironment(dt: number) {
        // Lerp Colors
        const lerpSpeed = dt * 1.0; // Transition speed

        this.currentBgColor.lerp(this.targetBgColor, lerpSpeed);
        this.currentFogColor.lerp(this.targetFogColor, lerpSpeed);
        this.currentLightColor.lerp(this.targetLightColor, lerpSpeed);

        this.currentFogDensity = THREE.MathUtils.lerp(this.currentFogDensity, this.targetFogDensity, lerpSpeed);
        this.currentLightIntensity = THREE.MathUtils.lerp(this.currentLightIntensity, this.targetLightIntensity, lerpSpeed);

        // Apply
        this.scene.background = this.currentBgColor;
        if (this.scene.fog instanceof THREE.FogExp2) {
            this.scene.fog.color = this.currentFogColor;
            this.scene.fog.density = this.currentFogDensity;
        }
        this.dirLight.color = this.currentLightColor;
        this.dirLight.intensity = this.currentLightIntensity;

        // Rain Update
        if (this.rainSystem) {
            this.rainSystem.visible = this.isRaining || (this.rainSystem.visible && this.currentFogDensity > 0.01); // Keep visible during fade out of toxic
            if (this.rainSystem.visible) {
                const dummy = new THREE.Object3D();
                for (let i = 0; i < this.rainSystem.count; i++) {
                    this.rainSystem.getMatrixAt(i, dummy.matrix);
                    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

                    dummy.position.y -= 25 * dt; // Fall speed
                    if (dummy.position.y < 0) {
                        dummy.position.y = 60;
                        dummy.position.x = this.cameraFocus.x + (Math.random() - 0.5) * 60; // Respawn around camera
                        dummy.position.z = this.cameraFocus.z + (Math.random() - 0.5) * 60;
                    }

                    dummy.updateMatrix();
                    this.rainSystem.setMatrixAt(i, dummy.matrix);
                }
                this.rainSystem.instanceMatrix.needsUpdate = true;
            }
        }
    }

    public render() {
        this.renderer.render(this.scene, this.camera);
    }

    public cleanup() {
        window.removeEventListener('resize', this.handleResize);
        this.renderer.dispose();
    }
}
