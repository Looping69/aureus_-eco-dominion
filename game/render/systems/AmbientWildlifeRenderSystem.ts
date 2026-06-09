import * as THREE from 'three';
import {
    GROUND_ANIMAL_COLORS,
    createGroundAnimalBodyGeometry,
    createGroundAnimalBodyMaterial,
    createGroundAnimalEarGeometry,
    createGroundAnimalEarMaterial,
    createGroundAnimalHeadGeometry,
    createGroundAnimalHeadMaterial,
    createGroundAnimalLegGeometry,
    createGroundAnimalLegMaterial,
    createGroundAnimalShadowGeometry,
    createGroundAnimalShadowMaterial,
    createGroundAnimalTailGeometry,
    createGroundAnimalTailMaterial,
} from '../wildlife/GroundAnimal';
import {
    GROUND_BIRD_COLORS,
    createGroundBirdBeakGeometry,
    createGroundBirdBeakMaterial,
    createGroundBirdBodyGeometry,
    createGroundBirdFeatherMaterial,
    createGroundBirdHeadGeometry,
    createGroundBirdLegGeometry,
    createGroundBirdLegMaterial,
    createGroundBirdNeckGeometry,
    createGroundBirdShadowGeometry,
    createGroundBirdShadowMaterial,
    createGroundBirdWingGeometry,
} from '../wildlife/GroundBird';
import {
    SKY_BIRD_COLORS,
    createSkyBirdGeometry,
    createSkyBirdMaterial,
} from '../wildlife/SkyBird';

type WildlifeFocus = { x: number; z: number };

type AnimalSeed = {
    anchorX: number;
    anchorZ: number;
    radius: number;
    speed: number;
    phase: number;
    scale: number;
    color: number;
};

type GroundBirdSeed = AnimalSeed & {
    accentColor: number;
};

type BirdSeed = {
    anchorX: number;
    anchorZ: number;
    radius: number;
    speed: number;
    phase: number;
    height: number;
    scale: number;
    color: number;
    roostX?: number;
    roostZ?: number;
};

type BirdNightState = {
    isNight: boolean;
    descent: number;
    hidden: boolean;
    takeoff: number;
};

const ANIMAL_COUNT = 10;
const GROUND_BIRD_COUNT = 5;
const BIRD_COUNT = 14;
const DEFAULT_SETTLEMENT_ANCHOR = { x: 8, z: 8 };
const FACING_SAMPLE_DT = 0.12;
const MIN_FACING_DELTA = 0.0001;
const DAY_TICKS = 24000;
const SUNRISE_TICK = 5000;
const SUNSET_TICK = 21000;
const NIGHT_TICKS = (DAY_TICKS - SUNSET_TICK) + SUNRISE_TICK;
const ROOST_DESCENT_FRACTION = 0.24;
const ROOST_HIDE_FRACTION = 0.3;
const MORNING_TAKEOFF_TICKS = 2600;
const MIN_ROOST_SCALE = 0.12;
const ROOST_SCAN_INTERVAL = 2;

export class AmbientWildlifeRenderSystem {
    private readonly root = new THREE.Group();
    private readonly animalBodyMesh: THREE.InstancedMesh;
    private readonly animalHeadMesh: THREE.InstancedMesh;
    private readonly animalLegMesh: THREE.InstancedMesh;
    private readonly animalEarMesh: THREE.InstancedMesh;
    private readonly animalTailMesh: THREE.InstancedMesh;
    private readonly animalShadowMesh: THREE.InstancedMesh;
    private readonly groundBirdBodyMesh: THREE.InstancedMesh;
    private readonly groundBirdNeckMesh: THREE.InstancedMesh;
    private readonly groundBirdHeadMesh: THREE.InstancedMesh;
    private readonly groundBirdBeakMesh: THREE.InstancedMesh;
    private readonly groundBirdLegMesh: THREE.InstancedMesh;
    private readonly groundBirdWingMesh: THREE.InstancedMesh;
    private readonly groundBirdShadowMesh: THREE.InstancedMesh;
    private readonly birdMesh: THREE.InstancedMesh;
    private readonly animalSeeds: AnimalSeed[];
    private readonly groundBirdSeeds: GroundBirdSeed[];
    private readonly birdSeeds: BirdSeed[];
    private readonly matrix = new THREE.Matrix4();
    private readonly roostMatrix = new THREE.Matrix4();
    private readonly position = new THREE.Vector3();
    private readonly roostPosition = new THREE.Vector3();
    private readonly scale = new THREE.Vector3();
    private readonly quaternion = new THREE.Quaternion();
    private readonly euler = new THREE.Euler();
    private treeRoosts: WildlifeFocus[] = [];
    private lastRoostScanAt = -Infinity;
    private birdsHaveNightRoosts = false;
    private visible = true;

    constructor(scene: THREE.Scene, anchor: WildlifeFocus = DEFAULT_SETTLEMENT_ANCHOR) {
        this.root.name = 'ambient-wildlife';
        scene.add(this.root);

        this.animalBodyMesh = new THREE.InstancedMesh(createGroundAnimalBodyGeometry(), createGroundAnimalBodyMaterial(), ANIMAL_COUNT);
        this.animalHeadMesh = new THREE.InstancedMesh(createGroundAnimalHeadGeometry(), createGroundAnimalHeadMaterial(), ANIMAL_COUNT);
        this.animalLegMesh = new THREE.InstancedMesh(createGroundAnimalLegGeometry(), createGroundAnimalLegMaterial(), ANIMAL_COUNT * 4);
        this.animalEarMesh = new THREE.InstancedMesh(createGroundAnimalEarGeometry(), createGroundAnimalEarMaterial(), ANIMAL_COUNT * 2);
        this.animalTailMesh = new THREE.InstancedMesh(createGroundAnimalTailGeometry(), createGroundAnimalTailMaterial(), ANIMAL_COUNT);
        this.animalShadowMesh = new THREE.InstancedMesh(createGroundAnimalShadowGeometry(), createGroundAnimalShadowMaterial(), ANIMAL_COUNT);

        const groundBirdFeatherMaterial = createGroundBirdFeatherMaterial();
        this.groundBirdBodyMesh = new THREE.InstancedMesh(createGroundBirdBodyGeometry(), groundBirdFeatherMaterial, GROUND_BIRD_COUNT);
        this.groundBirdNeckMesh = new THREE.InstancedMesh(createGroundBirdNeckGeometry(), groundBirdFeatherMaterial.clone(), GROUND_BIRD_COUNT);
        this.groundBirdHeadMesh = new THREE.InstancedMesh(createGroundBirdHeadGeometry(), groundBirdFeatherMaterial.clone(), GROUND_BIRD_COUNT);
        this.groundBirdBeakMesh = new THREE.InstancedMesh(createGroundBirdBeakGeometry(), createGroundBirdBeakMaterial(), GROUND_BIRD_COUNT);
        this.groundBirdLegMesh = new THREE.InstancedMesh(createGroundBirdLegGeometry(), createGroundBirdLegMaterial(), GROUND_BIRD_COUNT * 2);
        this.groundBirdWingMesh = new THREE.InstancedMesh(createGroundBirdWingGeometry(), groundBirdFeatherMaterial.clone(), GROUND_BIRD_COUNT * 2);
        this.groundBirdShadowMesh = new THREE.InstancedMesh(createGroundBirdShadowGeometry(), createGroundBirdShadowMaterial(), GROUND_BIRD_COUNT);

        this.birdMesh = new THREE.InstancedMesh(createSkyBirdGeometry(), createSkyBirdMaterial(), BIRD_COUNT);

        for (const mesh of [...this.getAnimalPartMeshes(), ...this.getGroundBirdPartMeshes()]) {
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = true;
            mesh.castShadow = true;
            mesh.receiveShadow = false;
            mesh.userData.foliageType = 'AMBIENT_WILDLIFE';
            this.root.add(mesh);
        }

        for (const mesh of [this.animalShadowMesh, this.groundBirdShadowMesh]) {
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = true;
            mesh.renderOrder = 2;
            mesh.userData.foliageType = 'AMBIENT_WILDLIFE';
            this.root.add(mesh);
        }

        this.birdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.birdMesh.frustumCulled = true;
        this.birdMesh.userData.foliageType = 'AMBIENT_WILDLIFE';
        this.root.add(this.birdMesh);

        this.animalSeeds = this.createAnimalSeeds(anchor);
        this.groundBirdSeeds = this.createGroundBirdSeeds(anchor);
        this.birdSeeds = this.createBirdSeeds(anchor);
        this.applyInstanceColors();
    }

    update(
        time: number,
        focus: WildlifeFocus,
        getHeightAt: (x: number, z: number) => number,
        zoomLevel: number = 18,
        firstPerson: boolean = false,
        timeOfDay: number = 12000
    ): void {
        if (!this.visible) return;

        const showGroundWildlife = firstPerson || zoomLevel <= 22;
        for (const mesh of [...this.getAnimalPartMeshes(), this.animalShadowMesh, ...this.getGroundBirdPartMeshes(), this.groundBirdShadowMesh]) {
            mesh.visible = showGroundWildlife;
        }
        this.birdMesh.visible = true;

        if (showGroundWildlife) {
            this.updateAnimals(time, focus, getHeightAt, firstPerson);
            this.updateGroundBirds(time, focus, getHeightAt, firstPerson);
        }
        this.updateBirds(time, focus, getHeightAt, firstPerson, timeOfDay);
    }

    setVisible(visible: boolean): void {
        this.visible = visible;
        this.root.visible = visible;
    }

    dispose(): void {
        this.root.parent?.remove(this.root);
        for (const mesh of [
            ...this.getAnimalPartMeshes(),
            this.animalShadowMesh,
            ...this.getGroundBirdPartMeshes(),
            this.groundBirdShadowMesh,
            this.birdMesh,
        ]) {
            mesh.geometry.dispose();
            const material = mesh.material;
            if (Array.isArray(material)) {
                material.forEach((entry) => entry.dispose());
            } else {
                material.dispose();
            }
        }
    }

    private updateAnimals(
        time: number,
        focus: WildlifeFocus,
        getHeightAt: (x: number, z: number) => number,
        firstPerson: boolean
    ): void {
        for (let i = 0; i < this.animalSeeds.length; i += 1) {
            const seed = this.animalSeeds[i];
            const current = this.getAnimalPosition(seed, time);
            const next = this.getAnimalPosition(seed, time + FACING_SAMPLE_DT);
            const x = current.x;
            const z = current.z;
            const yaw = this.getFacingYaw(current, next, seed.phase);
            const groundY = getHeightAt(x, z);
            const bob = Math.sin(time * 7 + seed.phase) * 0.018;
            const y = groundY + 0.32 * seed.scale + bob;
            const nearFocus = this.isNearFocus(x, z, focus, firstPerson ? 42 : 70);
            const hiddenY = -1000;
            const visibleY = nearFocus ? y : hiddenY;

            this.composeAnimalPart(x, visibleY, z, yaw, 0, 0, 0, seed.scale, seed.scale, seed.scale);
            this.animalBodyMesh.setMatrixAt(i, this.matrix);

            this.composeAnimalPart(x, nearFocus ? y + 0.12 * seed.scale : hiddenY, z, yaw, 0, 0.06 * seed.scale, 0.48 * seed.scale, seed.scale, seed.scale, seed.scale);
            this.animalHeadMesh.setMatrixAt(i, this.matrix);

            const legStride = Math.sin(time * 6.2 + seed.phase) * 0.05 * seed.scale;
            const legOffsets = [
                [-0.2, -0.2, legStride],
                [0.2, -0.2, -legStride],
                [-0.2, 0.22, -legStride],
                [0.2, 0.22, legStride],
            ];
            for (let leg = 0; leg < 4; leg += 1) {
                const [right, forward, swing] = legOffsets[leg];
                this.composeAnimalPart(
                    x,
                    nearFocus ? groundY + 0.14 * seed.scale : hiddenY,
                    z,
                    yaw,
                    right * seed.scale,
                    swing,
                    forward * seed.scale,
                    seed.scale,
                    seed.scale,
                    seed.scale
                );
                this.animalLegMesh.setMatrixAt(i * 4 + leg, this.matrix);
            }

            const earOffsets = [-0.11, 0.11];
            for (let ear = 0; ear < 2; ear += 1) {
                this.composeAnimalPart(
                    x,
                    nearFocus ? y + 0.36 * seed.scale : hiddenY,
                    z,
                    yaw,
                    earOffsets[ear] * seed.scale,
                    0,
                    0.54 * seed.scale,
                    seed.scale,
                    seed.scale,
                    seed.scale
                );
                this.animalEarMesh.setMatrixAt(i * 2 + ear, this.matrix);
            }

            this.composeAnimalPart(
                x,
                nearFocus ? y + 0.08 * seed.scale : hiddenY,
                z,
                yaw,
                0,
                Math.sin(time * 5 + seed.phase) * 0.035 * seed.scale,
                -0.52 * seed.scale,
                seed.scale,
                seed.scale,
                seed.scale
            );
            this.animalTailMesh.setMatrixAt(i, this.matrix);

            this.position.set(x, nearFocus ? groundY + 0.018 : hiddenY, z);
            this.euler.set(0, yaw, 0);
            this.quaternion.setFromEuler(this.euler);
            this.scale.set(seed.scale * 1.08, seed.scale * 0.8, seed.scale * 0.82);
            this.matrix.compose(this.position, this.quaternion, this.scale);
            this.animalShadowMesh.setMatrixAt(i, this.matrix);
        }

        for (const mesh of [...this.getAnimalPartMeshes(), this.animalShadowMesh]) {
            mesh.instanceMatrix.needsUpdate = true;
        }
    }

    private updateGroundBirds(
        time: number,
        focus: WildlifeFocus,
        getHeightAt: (x: number, z: number) => number,
        firstPerson: boolean
    ): void {
        for (let i = 0; i < this.groundBirdSeeds.length; i += 1) {
            const seed = this.groundBirdSeeds[i];
            const current = this.getGroundBirdPosition(seed, time);
            const next = this.getGroundBirdPosition(seed, time + FACING_SAMPLE_DT);
            const x = current.x;
            const z = current.z;
            const yaw = this.getFacingYaw(current, next, seed.phase);
            const groundY = getHeightAt(x, z);
            const stride = Math.sin(time * 7.4 + seed.phase) * 0.06 * seed.scale;
            const peck = Math.max(0, Math.sin(time * 2.2 + seed.phase)) * 0.12 * seed.scale;
            const bodyY = groundY + 0.36 * seed.scale;
            const nearFocus = this.isNearFocus(x, z, focus, firstPerson ? 42 : 70);
            const hiddenY = -1000;
            const y = nearFocus ? bodyY : hiddenY;

            this.composeAnimalPart(x, y, z, yaw, 0, 0, 0, seed.scale, seed.scale, seed.scale);
            this.groundBirdBodyMesh.setMatrixAt(i, this.matrix);

            this.composeAnimalPart(x, nearFocus ? bodyY + 0.28 * seed.scale - peck : hiddenY, z, yaw, 0, 0, 0.24 * seed.scale, seed.scale, seed.scale, seed.scale);
            this.groundBirdNeckMesh.setMatrixAt(i, this.matrix);

            this.composeAnimalPart(x, nearFocus ? bodyY + 0.52 * seed.scale - peck : hiddenY, z, yaw, 0, 0, 0.32 * seed.scale, seed.scale, seed.scale, seed.scale);
            this.groundBirdHeadMesh.setMatrixAt(i, this.matrix);

            this.composeAnimalPart(x, nearFocus ? bodyY + 0.5 * seed.scale - peck : hiddenY, z, yaw, 0, 0, 0.5 * seed.scale, seed.scale, seed.scale, seed.scale);
            this.groundBirdBeakMesh.setMatrixAt(i, this.matrix);

            const legOffsets = [-0.11, 0.11];
            for (let leg = 0; leg < 2; leg += 1) {
                this.composeAnimalPart(
                    x,
                    nearFocus ? groundY + 0.18 * seed.scale : hiddenY,
                    z,
                    yaw,
                    legOffsets[leg] * seed.scale,
                    leg === 0 ? stride : -stride,
                    -0.04 * seed.scale,
                    seed.scale,
                    seed.scale,
                    seed.scale
                );
                this.groundBirdLegMesh.setMatrixAt(i * 2 + leg, this.matrix);
            }

            const wingOffsets = [-0.25, 0.25];
            for (let wing = 0; wing < 2; wing += 1) {
                this.composeAnimalPart(
                    x,
                    nearFocus ? bodyY + 0.03 * seed.scale : hiddenY,
                    z,
                    yaw,
                    wingOffsets[wing] * seed.scale,
                    Math.sin(time * 4.6 + seed.phase) * 0.035 * seed.scale,
                    -0.02 * seed.scale,
                    seed.scale,
                    seed.scale,
                    seed.scale
                );
                this.groundBirdWingMesh.setMatrixAt(i * 2 + wing, this.matrix);
            }

            this.position.set(x, nearFocus ? groundY + 0.018 : hiddenY, z);
            this.euler.set(0, yaw, 0);
            this.quaternion.setFromEuler(this.euler);
            this.scale.set(seed.scale * 0.9, seed.scale * 0.72, seed.scale * 0.76);
            this.matrix.compose(this.position, this.quaternion, this.scale);
            this.groundBirdShadowMesh.setMatrixAt(i, this.matrix);
        }

        for (const mesh of [...this.getGroundBirdPartMeshes(), this.groundBirdShadowMesh]) {
            mesh.instanceMatrix.needsUpdate = true;
        }
    }

    private updateBirds(
        time: number,
        focus: WildlifeFocus,
        getHeightAt: (x: number, z: number) => number,
        firstPerson: boolean,
        timeOfDay: number
    ): void {
        this.refreshTreeRoosts(time);
        const nightState = this.getBirdNightState(timeOfDay);
        if (nightState.isNight && !this.birdsHaveNightRoosts) {
            this.assignBirdRoosts();
            this.birdsHaveNightRoosts = true;
        } else if (!nightState.isNight && nightState.takeoff >= 1) {
            this.birdsHaveNightRoosts = false;
        }

        for (let i = 0; i < this.birdSeeds.length; i += 1) {
            const seed = this.birdSeeds[i];
            const flight = this.getSkyBirdPosition(seed, time);
            const nextFlight = this.getSkyBirdPosition(seed, time + FACING_SAMPLE_DT);
            const flightY = seed.height + Math.sin(time * 1.9 + seed.phase) * 0.85;
            let x = flight.x;
            let z = flight.z;
            let y = flightY;
            let yaw = this.getFacingYaw(flight, nextFlight, seed.phase);
            let scaleFactor = 1;
            let hiddenForNight = false;

            if (nightState.isNight) {
                const roost = this.ensureBirdRoost(seed, i);
                const p = this.smoothstep(nightState.descent);
                const roostY = getHeightAt(roost.x, roost.z) + 1.45 + ((i % 3) * 0.18);
                x = this.lerp(flight.x, roost.x, p);
                z = this.lerp(flight.z, roost.z, p);
                y = this.lerp(flightY, roostY, p);
                yaw = this.getFacingYaw({ x, z }, roost, seed.phase);
                scaleFactor = this.lerp(1, MIN_ROOST_SCALE, p);
                hiddenForNight = nightState.hidden;
            } else if (nightState.takeoff < 1 && seed.roostX !== undefined && seed.roostZ !== undefined) {
                const p = this.smoothstep(nightState.takeoff);
                const roost = { x: seed.roostX, z: seed.roostZ };
                const roostY = getHeightAt(roost.x, roost.z) + 1.45 + ((i % 3) * 0.18);
                x = this.lerp(roost.x, flight.x, p);
                z = this.lerp(roost.z, flight.z, p);
                y = this.lerp(roostY, flightY, p);
                yaw = this.getFacingYaw(roost, flight, seed.phase);
                scaleFactor = this.lerp(MIN_ROOST_SCALE, 1, p);
            }

            const nearFocus = this.isNearFocus(x, z, focus, firstPerson ? 80 : 120);
            const visibleY = nearFocus && !hiddenForNight ? y : -1000;
            const flap = 1 + Math.sin(time * 9.5 + seed.phase) * 0.18 * Math.max(0.1, scaleFactor);

            this.euler.set(Math.sin(time + seed.phase) * 0.08, yaw, 0);
            this.quaternion.setFromEuler(this.euler);
            this.position.set(x, visibleY, z);
            this.scale.set(seed.scale * scaleFactor, seed.scale * scaleFactor * flap, seed.scale * scaleFactor);
            this.matrix.compose(this.position, this.quaternion, this.scale);
            this.birdMesh.setMatrixAt(i, this.matrix);
        }
        this.birdMesh.instanceMatrix.needsUpdate = true;
    }

    private getAnimalPosition(seed: AnimalSeed, time: number): WildlifeFocus {
        const t = time * seed.speed + seed.phase;
        return {
            x: seed.anchorX + Math.cos(t) * seed.radius + Math.sin(t * 0.37 + seed.phase) * 2.4,
            z: seed.anchorZ + Math.sin(t * 0.82) * seed.radius + Math.cos(t * 0.29 + seed.phase) * 2.2,
        };
    }

    private getGroundBirdPosition(seed: GroundBirdSeed, time: number): WildlifeFocus {
        const t = time * seed.speed + seed.phase;
        return {
            x: seed.anchorX + Math.cos(t * 0.9) * seed.radius + Math.sin(t * 0.43 + seed.phase) * 1.2,
            z: seed.anchorZ + Math.sin(t) * seed.radius + Math.cos(t * 0.31 + seed.phase) * 1.1,
        };
    }

    private getSkyBirdPosition(seed: BirdSeed, time: number): WildlifeFocus {
        const t = time * seed.speed + seed.phase;
        return {
            x: seed.anchorX + Math.cos(t) * seed.radius,
            z: seed.anchorZ + Math.sin(t * 0.93) * seed.radius,
        };
    }

    private getFacingYaw(current: WildlifeFocus, next: WildlifeFocus, fallbackPhase: number): number {
        const dx = next.x - current.x;
        const dz = next.z - current.z;
        if (dx * dx + dz * dz < MIN_FACING_DELTA) {
            return fallbackPhase;
        }
        return Math.atan2(dx, dz);
    }

    private getBirdNightState(timeOfDay: number): BirdNightState {
        const normalized = this.normalizeTimeOfDay(timeOfDay);
        if (normalized >= SUNSET_TICK || normalized < SUNRISE_TICK) {
            const nightElapsed = normalized >= SUNSET_TICK
                ? normalized - SUNSET_TICK
                : (DAY_TICKS - SUNSET_TICK) + normalized;
            return {
                isNight: true,
                descent: this.clamp01(nightElapsed / (NIGHT_TICKS * ROOST_DESCENT_FRACTION)),
                hidden: nightElapsed >= NIGHT_TICKS * ROOST_HIDE_FRACTION,
                takeoff: 0,
            };
        }

        return {
            isNight: false,
            descent: 0,
            hidden: false,
            takeoff: this.clamp01((normalized - SUNRISE_TICK) / MORNING_TAKEOFF_TICKS),
        };
    }

    private normalizeTimeOfDay(timeOfDay: number): number {
        return ((timeOfDay % DAY_TICKS) + DAY_TICKS) % DAY_TICKS;
    }

    private refreshTreeRoosts(time: number): void {
        if (time - this.lastRoostScanAt < ROOST_SCAN_INTERVAL) return;
        this.lastRoostScanAt = time;
        const scene = this.root.parent;
        if (!scene) return;

        const roosts: WildlifeFocus[] = [];
        scene.traverse((object) => {
            const mesh = object as THREE.InstancedMesh;
            const foliageType = String(mesh.userData?.foliageType || '');
            if (!mesh.isInstancedMesh || !foliageType.startsWith('TREE_')) return;
            const count = Math.min(mesh.count || 0, mesh.instanceMatrix.count || mesh.count || 0);
            for (let i = 0; i < count; i += 1) {
                mesh.getMatrixAt(i, this.roostMatrix);
                this.roostPosition.setFromMatrixPosition(this.roostMatrix);
                roosts.push({ x: this.roostPosition.x, z: this.roostPosition.z });
            }
        });

        if (roosts.length > 0) {
            this.treeRoosts = roosts;
        }
    }

    private assignBirdRoosts(): void {
        for (let i = 0; i < this.birdSeeds.length; i += 1) {
            const seed = this.birdSeeds[i];
            const roost = this.pickRoostForBird(seed, i);
            seed.roostX = roost.x;
            seed.roostZ = roost.z;
        }
    }

    private ensureBirdRoost(seed: BirdSeed, index: number): WildlifeFocus {
        if (seed.roostX !== undefined && seed.roostZ !== undefined) {
            return { x: seed.roostX, z: seed.roostZ };
        }
        const roost = this.pickRoostForBird(seed, index);
        seed.roostX = roost.x;
        seed.roostZ = roost.z;
        return roost;
    }

    private pickRoostForBird(seed: BirdSeed, index: number): WildlifeFocus {
        if (this.treeRoosts.length === 0) {
            return {
                x: seed.anchorX + Math.cos(seed.phase) * 4,
                z: seed.anchorZ + Math.sin(seed.phase) * 4,
            };
        }

        const roostIndex = Math.abs(Math.floor(seed.phase * 1000) + index * 7) % this.treeRoosts.length;
        const base = this.treeRoosts[roostIndex];
        const offset = (index % 5) * 0.08;
        return {
            x: base.x + Math.sin(seed.phase) * (0.18 + offset),
            z: base.z + Math.cos(seed.phase) * (0.18 + offset),
        };
    }

    private createAnimalSeeds(anchor: WildlifeFocus): AnimalSeed[] {
        return Array.from({ length: ANIMAL_COUNT }, (_, i) => ({
            anchorX: anchor.x + ((i * 17) % 29) - 14,
            anchorZ: anchor.z + ((i * 23) % 31) - 15,
            radius: 1.8 + (i % 4) * 0.55,
            speed: 0.1 + (i % 5) * 0.018,
            phase: i * 1.73,
            scale: 0.72 + (i % 3) * 0.08,
            color: GROUND_ANIMAL_COLORS[i % GROUND_ANIMAL_COLORS.length],
        }));
    }

    private createGroundBirdSeeds(anchor: WildlifeFocus): GroundBirdSeed[] {
        return Array.from({ length: GROUND_BIRD_COUNT }, (_, i) => ({
            anchorX: anchor.x + ((i * 31) % 33) - 16,
            anchorZ: anchor.z + ((i * 11) % 27) - 13,
            radius: 1.4 + (i % 3) * 0.5,
            speed: 0.12 + (i % 4) * 0.02,
            phase: i * 2.17,
            scale: 0.72 + (i % 2) * 0.08,
            color: GROUND_BIRD_COLORS[i % GROUND_BIRD_COLORS.length],
            accentColor: GROUND_BIRD_COLORS[(i + 2) % GROUND_BIRD_COLORS.length],
        }));
    }

    private createBirdSeeds(anchor: WildlifeFocus): BirdSeed[] {
        return Array.from({ length: BIRD_COUNT }, (_, i) => ({
            anchorX: anchor.x + ((i * 19) % 43) - 21,
            anchorZ: anchor.z + ((i * 13) % 47) - 23,
            radius: 8 + (i % 5) * 2.1,
            speed: 0.11 + (i % 4) * 0.025,
            phase: i * 0.91,
            height: 9.5 + (i % 4) * 1.4,
            scale: 0.58 + (i % 3) * 0.08,
            color: SKY_BIRD_COLORS[i % SKY_BIRD_COLORS.length],
        }));
    }

    private applyInstanceColors(): void {
        const color = new THREE.Color();
        this.animalSeeds.forEach((seed, i) => {
            color.set(seed.color);
            this.animalBodyMesh.setColorAt(i, color);
            this.animalHeadMesh.setColorAt(i, color.offsetHSL(0, 0, 0.08));
            this.animalTailMesh.setColorAt(i, color.offsetHSL(0, 0, -0.06));
            for (let leg = 0; leg < 4; leg += 1) {
                this.animalLegMesh.setColorAt(i * 4 + leg, color.offsetHSL(0, 0, -0.1));
            }
            for (let ear = 0; ear < 2; ear += 1) {
                this.animalEarMesh.setColorAt(i * 2 + ear, color.offsetHSL(0, 0, 0.1));
            }
        });
        this.groundBirdSeeds.forEach((seed, i) => {
            color.set(seed.color);
            this.groundBirdBodyMesh.setColorAt(i, color);
            this.groundBirdNeckMesh.setColorAt(i, color.offsetHSL(0, 0, 0.08));
            this.groundBirdHeadMesh.setColorAt(i, color.offsetHSL(0, 0, 0.12));
            for (let wing = 0; wing < 2; wing += 1) {
                this.groundBirdWingMesh.setColorAt(i * 2 + wing, color.set(seed.accentColor));
            }
        });
        this.birdSeeds.forEach((seed, i) => {
            this.birdMesh.setColorAt(i, color.set(seed.color));
        });
        for (const mesh of [...this.getAnimalPartMeshes(), ...this.getGroundBirdPartMeshes(), this.birdMesh]) {
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    }

    private composeAnimalPart(
        x: number,
        y: number,
        z: number,
        yaw: number,
        localRight: number,
        localUp: number,
        localForward: number,
        scaleX: number,
        scaleY: number,
        scaleZ: number
    ): void {
        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);
        this.position.set(
            x + sin * localForward + cos * localRight,
            y + localUp,
            z + cos * localForward - sin * localRight
        );
        this.euler.set(0, yaw, 0);
        this.quaternion.setFromEuler(this.euler);
        this.scale.set(scaleX, scaleY, scaleZ);
        this.matrix.compose(this.position, this.quaternion, this.scale);
    }

    private getAnimalPartMeshes(): THREE.InstancedMesh[] {
        return [
            this.animalBodyMesh,
            this.animalHeadMesh,
            this.animalLegMesh,
            this.animalEarMesh,
            this.animalTailMesh,
        ];
    }

    private getGroundBirdPartMeshes(): THREE.InstancedMesh[] {
        return [
            this.groundBirdBodyMesh,
            this.groundBirdNeckMesh,
            this.groundBirdHeadMesh,
            this.groundBirdBeakMesh,
            this.groundBirdLegMesh,
            this.groundBirdWingMesh,
        ];
    }

    private isNearFocus(x: number, z: number, focus: WildlifeFocus, radius: number): boolean {
        const dx = x - focus.x;
        const dz = z - focus.z;
        return dx * dx + dz * dz <= radius * radius;
    }

    private clamp01(value: number): number {
        return Math.max(0, Math.min(1, value));
    }

    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * this.clamp01(t);
    }

    private smoothstep(value: number): number {
        const t = this.clamp01(value);
        return t * t * (3 - 2 * t);
    }
}
