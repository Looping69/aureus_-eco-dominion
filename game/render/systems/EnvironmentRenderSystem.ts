/**
 * Environment Render System
 * Handles day/night cycle, weather effects (rain, fog), and atmospheric lighting.
 * Replaces the environment logic from legacy SceneManager.
 */

import * as THREE from 'three';
import { WeatherState } from '../../../types';
import { COLORS } from '../../../engine/data/VoxelConstants';
import { ThreeRenderAdapter } from '../../../engine/render/ThreeRenderAdapter';
import { oilWaterMaterial, reservoirWaterMaterial, waterFlowMaterial } from '../../../engine/render/materials/VoxelMaterials';
import { getCelestialPosition, getDaylightFactor, isDaytime } from '../../../engine/sim/dayNightCycle';
import { isRainWeather, isStormWeather, normalizeWeatherState } from '../../../engine/weather/weatherModel';

const WATER_LIGHTING_PRESETS = [
    {
        material: waterFlowMaterial,
        day: 0x2f8fa3,
        night: 0x17394f,
        foamDay: 0xb9dde2,
        foamNight: 0x6f8fa3,
        dayOpacity: 0.74,
        nightOpacity: 0.66,
    },
    {
        material: oilWaterMaterial,
        day: 0x24384a,
        night: 0x101923,
        foamDay: 0x41515c,
        foamNight: 0x27313b,
        dayOpacity: 0.74,
        nightOpacity: 0.68,
    },
    {
        material: reservoirWaterMaterial,
        day: 0x2d7888,
        night: 0x16394c,
        foamDay: 0x7fc2cc,
        foamNight: 0x547f91,
        dayOpacity: 0.76,
        nightOpacity: 0.68,
    },
];

export class EnvironmentRenderSystem {
    private scene: THREE.Scene;
    private adapter: ThreeRenderAdapter;

    // State
    private timeOfDay = 12000;
    private viewMode: 'SURFACE' | 'FIRST_PERSON' = 'SURFACE';

    // Target Values for Interpolation
    private targetBgColor = new THREE.Color(COLORS.BG);
    private currentBgColor = new THREE.Color(COLORS.BG);

    private targetFogColor = new THREE.Color(COLORS.BG);
    private currentFogColor = new THREE.Color(COLORS.BG);

    // Linear Fog Params
    private targetFogNear = 40;
    private currentFogNear = 40;
    private targetFogFar = 120;
    private currentFogFar = 120;

    private targetLightColor = new THREE.Color(0xffcd75);
    private currentLightColor = new THREE.Color(0xffcd75);
    private targetLightIntensity = 1.2;
    private currentLightIntensity = 1.2;

    // Rain System
    private rainSystem: THREE.InstancedMesh;
    private isRaining = false;
    private cameraFocus = new THREE.Vector3(0, 0, 0);
    private stormFlash = 0;

    // Sun/Moon Visual
    private sunMesh: THREE.Mesh;
    private sunDistance = 150; // Distance from camera focus
    private appliedBgColor = new THREE.Color(COLORS.BG);
    private appliedFogColor = new THREE.Color(COLORS.BG);
    private lightningBgColor = new THREE.Color(0xf6fbff);
    private lightningFogColor = new THREE.Color(0xe4eefc);
    private coolFillColor = new THREE.Color(0x8fb4ff);
    private warmGroundColor = new THREE.Color(0x6b5338);
    private waterColor = new THREE.Color();
    private waterFoamColor = new THREE.Color();

    constructor(adapter: ThreeRenderAdapter) {
        this.adapter = adapter;
        this.scene = adapter.getScene();

        // Initialize Fog (Linear)
        this.scene.fog = new THREE.Fog(this.currentFogColor, this.currentFogNear, this.currentFogFar);
        this.scene.background = this.currentBgColor;

        // Initialize Rain
        this.rainSystem = this.createRainSystem();
        this.scene.add(this.rainSystem);

        // Initialize Sun Sphere
        this.sunMesh = this.createSunSphere();
        this.scene.add(this.sunMesh);
    }

    private createRainSystem(): THREE.InstancedMesh {
        const count = 500;
        const geo = new THREE.BoxGeometry(0.05, 0.8, 0.05);
        const mat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 });
        const mesh = new THREE.InstancedMesh(geo, mat, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.visible = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * 100,
                Math.random() * 60,
                (Math.random() - 0.5) * 100
            );
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        return mesh;
    }

    private createSunSphere(): THREE.Mesh {
        const geo = new THREE.SphereGeometry(8, 16, 16);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffdd44,
            transparent: true,
            opacity: 0.95,
            fog: false // Sun not affected by fog
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 999; // Render on top
        return mesh;
    }

    private calculateSunPosition(timeOfDay: number): THREE.Vector3 {
        const position = getCelestialPosition(timeOfDay, this.sunDistance);
        return new THREE.Vector3(position.x, position.y, position.z);
    }

    public update(dt: number, timeOfDay: number, weather: WeatherState, cameraFocus: THREE.Vector3) {
        this.timeOfDay = timeOfDay;
        this.cameraFocus.copy(cameraFocus);
        const normalizedWeather = normalizeWeatherState(weather);

        // 1. Calculate Targets based on Simulation State
        this.calculateTargets(timeOfDay, normalizedWeather);

        // 2. Handle lightning before interpolation so flashes actually affect light.
        this.updateStormFlash(dt, normalizedWeather);

        // 3. Interpolate visuals
        this.interpolate(dt, normalizedWeather);

        // 4. Update Particles
        this.updateRain(dt, normalizedWeather);
    }

    public setViewMode(mode: 'SURFACE' | 'FIRST_PERSON') {
        this.viewMode = mode;
    }

    private calculateTargets(timeOfDay: number, weather: WeatherState) {
        // Normalize time (0-24000)
        const daylightFactor = getDaylightFactor(timeOfDay);
        const isNight = daylightFactor <= 0;
        const severity = weather.intensity;

        // Base Intensity
        let intensity = isNight ? 0.28 : 0.4 + daylightFactor * 1.0;

        // Weather Modifiers
        this.isRaining = false;

        switch (weather.current) {
            case 'OVERCAST':
                this.targetBgColor.setHex(0x6f7785);
                this.targetFogColor.setHex(0x76808f);
                this.targetFogNear = 160;
                this.targetFogFar = 480;
                this.targetLightColor.setHex(0xe4e9f2);
                this.targetLightIntensity = intensity * (0.78 - severity * 0.12);
                break;
            case 'RAIN':
                this.targetBgColor.setHex(0x4b5568);
                this.targetFogColor.setHex(0x536276);
                this.targetFogNear = 120;
                this.targetFogFar = 320;
                this.targetLightColor.setHex(0xc6d7f0);
                this.targetLightIntensity = intensity * (0.68 - severity * 0.1);
                this.isRaining = true;
                break;
            case 'STORM':
                this.targetBgColor.setHex(0x1b2431);
                this.targetFogColor.setHex(0x263241);
                this.targetFogNear = 70;
                this.targetFogFar = 180;
                this.targetLightColor.setHex(0xc7d7ff);
                this.targetLightIntensity = Math.max(0.18, intensity * (0.45 - severity * 0.08));
                this.isRaining = true;
                break;
            case 'HEATWAVE':
                this.targetBgColor.setHex(0xb06f2f);
                this.targetFogColor.setHex(0xd39a54);
                this.targetFogNear = 110;
                this.targetFogFar = 300;
                this.targetLightColor.setHex(0xffc27d);
                this.targetLightIntensity = intensity * (1.15 + severity * 0.25);
                break;
            case 'DUST_STORM':
                this.targetBgColor.setHex(0x8f6035);
                this.targetFogColor.setHex(0xb37c44);
                this.targetFogNear = 50;
                this.targetFogFar = 140;
                this.targetLightColor.setHex(0xe3b377);
                this.targetLightIntensity = Math.max(0.22, intensity * (0.56 - severity * 0.12));
                break;
            case 'CLEAR':
            default:
                if (isNight) {
                    this.targetBgColor.setHex(0x050510);
                    this.targetLightColor.setHex(0x6688ff);
                    this.targetFogColor.setHex(0x050510);
                    this.targetFogNear = 200;
                    this.targetFogFar = 600;
                } else {
                    this.targetBgColor.setHex(COLORS.BG);
                    this.targetLightColor.setHex(0xffcd75);
                    this.targetFogColor.setHex(COLORS.BG);
                    this.targetFogNear = 300;
                    this.targetFogFar = 1000;
                }
                this.targetLightIntensity = intensity;
                break;
        }
    }

    private updateStormFlash(dt: number, weather: WeatherState) {
        this.stormFlash = Math.max(0, this.stormFlash - dt * 3.2);

        if (!isStormWeather(weather.current) || weather.lightning <= 0.1) {
            return;
        }

        const strikeChance = dt * (0.2 + weather.lightning * 1.4);
        if (Math.random() < strikeChance) {
            this.stormFlash = 0.72 + Math.random() * 0.28;
        }
    }

    private interpolate(dt: number, weather: WeatherState) {
        const lerpSpeed = dt * 1.5;
        const fogLerpSpeed = dt * 2.5; // Snapshot fog even faster

        this.currentFogColor.lerp(this.targetFogColor, fogLerpSpeed);
        this.currentLightColor.lerp(this.targetLightColor, lerpSpeed);
        this.currentBgColor.lerp(this.targetBgColor, lerpSpeed);

        this.currentFogNear = THREE.MathUtils.lerp(this.currentFogNear, this.targetFogNear, fogLerpSpeed);
        this.currentFogFar = THREE.MathUtils.lerp(this.currentFogFar, this.targetFogFar, fogLerpSpeed);
        this.currentLightIntensity = THREE.MathUtils.lerp(this.currentLightIntensity, this.targetLightIntensity, lerpSpeed);

        // Apply
        this.appliedBgColor.copy(this.currentBgColor).lerp(this.lightningBgColor, this.stormFlash * 0.3);
        this.appliedFogColor.copy(this.currentFogColor).lerp(this.lightningFogColor, this.stormFlash * 0.15);
        this.scene.background = this.appliedBgColor;
        if (this.scene.fog instanceof THREE.Fog) {
            this.scene.fog.color = this.appliedFogColor;
            this.scene.fog.near = this.currentFogNear;
            this.scene.fog.far = this.currentFogFar;
        } else {
            this.scene.fog = new THREE.Fog(this.appliedFogColor, this.currentFogNear, this.currentFogFar);
        }

        const daylightFactor = getDaylightFactor(this.timeOfDay);
        const isNight = daylightFactor <= 0;
        const celestialFactor = isNight ? 0 : daylightFactor;
        this.updateWaterLighting(celestialFactor, weather);

        if (this.adapter.directionalLight) {
            this.adapter.directionalLight.color = this.currentLightColor;
            this.adapter.directionalLight.intensity = this.currentLightIntensity + this.stormFlash * 1.2;
        }

        if (this.adapter.ambientLight) {
            this.adapter.ambientLight.color.copy(this.currentLightColor).lerp(this.appliedFogColor, 0.42);
            this.adapter.ambientLight.intensity = Math.max(isNight ? 0.12 : 0.22, this.currentLightIntensity * (isNight ? 0.30 : 0.42) + this.stormFlash * 0.22);
        }

        if (this.adapter.hemisphereLight) {
            this.adapter.hemisphereLight.color.copy(this.appliedFogColor).lerp(this.currentLightColor, isNight ? 0.18 : 0.35);
            this.adapter.hemisphereLight.groundColor.copy(this.warmGroundColor).lerp(this.appliedFogColor, isRainWeather(weather.current) ? 0.55 : 0.18);
            this.adapter.hemisphereLight.intensity = Math.max(isNight ? 0.14 : 0.24, this.currentLightIntensity * (isNight ? 0.32 : 0.46) + this.stormFlash * 0.16);
        }

        if (this.adapter.fillLight) {
            this.adapter.fillLight.color.copy(this.coolFillColor).lerp(this.currentLightColor, isDaytime(this.timeOfDay) ? 0.18 : 0.02);
            this.adapter.fillLight.intensity = Math.max(isNight ? 0.04 : 0.12, this.currentLightIntensity * (isRainWeather(weather.current) ? 0.24 : isNight ? 0.12 : 0.24));
            this.adapter.fillLight.position.set(this.cameraFocus.x - 42, 36, this.cameraFocus.z - 48);
        }

        // Update Sun/Moon Position
        const sunPos = this.calculateSunPosition(this.timeOfDay);

        // Position sun relative to camera focus
        this.sunMesh.position.set(
            this.cameraFocus.x + sunPos.x,
            sunPos.y,
            this.cameraFocus.z + sunPos.z
        );

        // Update sun appearance
        const sunMat = this.sunMesh.material as THREE.MeshBasicMaterial;
        if (isNight) {
            sunMat.color.setHex(0xccccff); // Moon: blueish white
            sunMat.opacity = 0.64;
            this.sunMesh.scale.setScalar(0.6); // Moon is smaller
        } else {
            sunMat.color.setHex(0xffdd44); // Sun: warm yellow
            sunMat.opacity = 0.95;
            this.sunMesh.scale.setScalar(1.0);
        }

        // Move directional light to match sun position, relative to focus
        if (this.adapter.directionalLight) {
            this.adapter.directionalLight.position.set(
                this.cameraFocus.x + sunPos.x,
                sunPos.y,
                this.cameraFocus.z + sunPos.z
            );
            // Favor stable contact shadows without letting the terrain shadow itself
            // into large moving bands as the light/camera shifts.
            this.adapter.directionalLight.shadow.bias = -0.00002;
            this.adapter.directionalLight.shadow.normalBias = 0.018;
            // Light target follows camera
            this.adapter.directionalLight.target.position.set(
                this.cameraFocus.x,
                0,
                this.cameraFocus.z
            );
            this.adapter.directionalLight.target.updateMatrixWorld();

            // Disable shadows at night for softer moonlit look, AND at low zoom for performance
            const zoom = this.adapter.getCamera().zoom;
            const isZoomedOut = zoom < 0.6;
            this.adapter.directionalLight.castShadow = this.adapter.getRuntimeQuality().shadowMap && !isNight && !isZoomedOut;
        }
    }

    private updateWaterLighting(daylightFactor: number, weather: WeatherState): void {
        const stormLift = this.stormFlash * 0.22;
        const rainDull = isRainWeather(weather.current) ? 0.14 : 0;
        const phase = THREE.MathUtils.clamp(daylightFactor + stormLift - rainDull, 0, 1);

        WATER_LIGHTING_PRESETS.forEach((preset) => {
            const material = preset.material as unknown as THREE.MeshStandardMaterial & { uniforms?: Record<string, { value: any }> };
            this.waterColor.setHex(preset.night).lerp(new THREE.Color(preset.day), phase);
            this.waterFoamColor.setHex(preset.foamNight).lerp(new THREE.Color(preset.foamDay), phase);

            material.color.copy(this.waterColor);
            material.roughness = THREE.MathUtils.lerp(0.76, 0.22, phase);
            material.metalness = THREE.MathUtils.lerp(0.02, 0.08, phase);
            material.opacity = THREE.MathUtils.lerp(preset.nightOpacity, preset.dayOpacity, phase);

            if (material.uniforms?.waterColor?.value) {
                material.uniforms.waterColor.value.copy(this.waterColor);
            }
            if (material.uniforms?.foamColor?.value) {
                material.uniforms.foamColor.value.copy(this.waterFoamColor);
            }
        });
    }

    private updateRain(dt: number, weather: WeatherState) {
        this.rainSystem.visible = isRainWeather(weather.current) || (this.rainSystem.visible && weather.precipitation > 0.1);

        if (this.rainSystem.visible) {
            const dummy = new THREE.Object3D();
            const fallSpeed = 14 + weather.precipitation * 18;
            const lateralDrift = (weather.windStrength - 0.25) * 10;
            for (let i = 0; i < this.rainSystem.count; i++) {
                this.rainSystem.getMatrixAt(i, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

                dummy.position.y -= fallSpeed * dt;
                dummy.position.x += lateralDrift * dt;

                // Respawn logic
                if (dummy.position.y < 0) {
                    dummy.position.y = 60;
                    dummy.position.x = this.cameraFocus.x + (Math.random() - 0.5) * 60;
                    dummy.position.z = this.cameraFocus.z + (Math.random() - 0.5) * 60;
                }

                dummy.updateMatrix();
                this.rainSystem.setMatrixAt(i, dummy.matrix);
            }
            this.rainSystem.instanceMatrix.needsUpdate = true;
        }
    }
}
