import * as THREE from 'three';
import {
    GROUND_ANIMAL_COLORS,
    createGroundAnimalBodyGeometry,
    createGroundAnimalBodyMaterial,
    createGroundAnimalHeadGeometry,
    createGroundAnimalHeadMaterial,
} from '../wildlife/GroundAnimal';
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

type BirdSeed = {
    anchorX: number;
    anchorZ: number;
    radius: number;
    speed: number;
    phase: number;
    height: number;
    scale: number;
    color: number;
};

const ANIMAL_COUNT = 10;
const BIRD_COUNT = 14;
const DEFAULT_SETTLEMENT_ANCHOR = { x: 8, z: 8 };

export class AmbientWildlifeRenderSystem {
    private readonly root = new THREE.Group();
    private readonly animalBodyMesh: THREE.InstancedMesh;
    private readonly animalHeadMesh: THREE.InstancedMesh;
    private readonly birdMesh: THREE.InstancedMesh;
    private readonly animalSeeds: AnimalSeed[];
    private readonly birdSeeds: BirdSeed[];
    private readonly matrix = new THREE.Matrix4();
    private readonly position = new THREE.Vector3();
    private readonly scale = new THREE.Vector3();
    private readonly quaternion = new THREE.Quaternion();
    private readonly euler = new THREE.Euler();
    private visible = true;

    constructor(scene: THREE.Scene, anchor: WildlifeFocus = DEFAULT_SETTLEMENT_ANCHOR) {
        this.root.name = 'ambient-wildlife';
        scene.add(this.root);

        const bodyMaterial = createGroundAnimalBodyMaterial();
        const headMaterial = createGroundAnimalHeadMaterial();
        const birdMaterial = createSkyBirdMaterial();

        this.animalBodyMesh = new THREE.InstancedMesh(createGroundAnimalBodyGeometry(), bodyMaterial, ANIMAL_COUNT);
        this.animalHeadMesh = new THREE.InstancedMesh(createGroundAnimalHeadGeometry(), headMaterial, ANIMAL_COUNT);
        this.birdMesh = new THREE.InstancedMesh(createSkyBirdGeometry(), birdMaterial, BIRD_COUNT);

        for (const mesh of [this.animalBodyMesh, this.animalHeadMesh, this.birdMesh]) {
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = true;
            mesh.userData.foliageType = 'AMBIENT_WILDLIFE';
            this.root.add(mesh);
        }

        this.animalSeeds = this.createAnimalSeeds(anchor);
        this.birdSeeds = this.createBirdSeeds(anchor);
        this.applyInstanceColors();
    }

    update(
        time: number,
        focus: WildlifeFocus,
        getHeightAt: (x: number, z: number) => number,
        zoomLevel: number = 18,
        firstPerson: boolean = false
    ): void {
        if (!this.visible) return;

        const showAnimals = firstPerson || zoomLevel <= 22;
        this.animalBodyMesh.visible = showAnimals;
        this.animalHeadMesh.visible = showAnimals;
        this.birdMesh.visible = true;

        if (showAnimals) {
            this.updateAnimals(time, focus, getHeightAt, firstPerson);
        }
        this.updateBirds(time, focus, firstPerson);
    }

    setVisible(visible: boolean): void {
        this.visible = visible;
        this.root.visible = visible;
    }

    dispose(): void {
        this.root.parent?.remove(this.root);
        for (const mesh of [this.animalBodyMesh, this.animalHeadMesh, this.birdMesh]) {
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
            const t = time * seed.speed + seed.phase;
            const wanderX = Math.cos(t) * seed.radius + Math.sin(t * 0.37 + seed.phase) * 2.4;
            const wanderZ = Math.sin(t * 0.82) * seed.radius + Math.cos(t * 0.29 + seed.phase) * 2.2;
            const x = seed.anchorX + wanderX;
            const z = seed.anchorZ + wanderZ;
            const nextX = seed.anchorX + Math.cos(t + 0.05) * seed.radius;
            const nextZ = seed.anchorZ + Math.sin((t + 0.05) * 0.82) * seed.radius;
            const yaw = Math.atan2(nextX - x, nextZ - z);
            const y = getHeightAt(x, z) + 0.16 + Math.sin(time * 7 + seed.phase) * 0.018;
            const nearFocus = this.isNearFocus(x, z, focus, firstPerson ? 42 : 70);

            this.euler.set(0, yaw, 0);
            this.quaternion.setFromEuler(this.euler);
            this.position.set(x, nearFocus ? y : -1000, z);
            this.scale.setScalar(seed.scale);
            this.matrix.compose(this.position, this.quaternion, this.scale);
            this.animalBodyMesh.setMatrixAt(i, this.matrix);

            this.position.set(
                x + Math.sin(yaw) * 0.36 * seed.scale,
                nearFocus ? y + 0.1 * seed.scale : -1000,
                z + Math.cos(yaw) * 0.36 * seed.scale
            );
            this.scale.setScalar(seed.scale);
            this.matrix.compose(this.position, this.quaternion, this.scale);
            this.animalHeadMesh.setMatrixAt(i, this.matrix);
        }
        this.animalBodyMesh.instanceMatrix.needsUpdate = true;
        this.animalHeadMesh.instanceMatrix.needsUpdate = true;
    }

    private updateBirds(time: number, focus: WildlifeFocus, firstPerson: boolean): void {
        for (let i = 0; i < this.birdSeeds.length; i += 1) {
            const seed = this.birdSeeds[i];
            const t = time * seed.speed + seed.phase;
            const x = seed.anchorX + Math.cos(t) * seed.radius;
            const z = seed.anchorZ + Math.sin(t * 0.93) * seed.radius;
            const nearFocus = this.isNearFocus(x, z, focus, firstPerson ? 80 : 120);
            const y = nearFocus ? seed.height + Math.sin(time * 1.9 + seed.phase) * 0.85 : -1000;
            const yaw = Math.atan2(-Math.sin(t), Math.cos(t * 0.93));
            const flap = 1 + Math.sin(time * 9.5 + seed.phase) * 0.18;

            this.euler.set(Math.sin(time + seed.phase) * 0.08, yaw, 0);
            this.quaternion.setFromEuler(this.euler);
            this.position.set(x, y, z);
            this.scale.set(seed.scale, seed.scale * flap, seed.scale);
            this.matrix.compose(this.position, this.quaternion, this.scale);
            this.birdMesh.setMatrixAt(i, this.matrix);
        }
        this.birdMesh.instanceMatrix.needsUpdate = true;
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
        });
        this.birdSeeds.forEach((seed, i) => {
            this.birdMesh.setColorAt(i, color.set(seed.color));
        });
        if (this.animalBodyMesh.instanceColor) this.animalBodyMesh.instanceColor.needsUpdate = true;
        if (this.animalHeadMesh.instanceColor) this.animalHeadMesh.instanceColor.needsUpdate = true;
        if (this.birdMesh.instanceColor) this.birdMesh.instanceColor.needsUpdate = true;
    }

    private isNearFocus(x: number, z: number, focus: WildlifeFocus, radius: number): boolean {
        const dx = x - focus.x;
        const dz = z - focus.z;
        return dx * dx + dz * dz <= radius * radius;
    }
}
