import * as THREE from 'three';

export function createGroundAnimalBodyGeometry(): THREE.BoxGeometry {
    return new THREE.BoxGeometry(0.62, 0.3, 0.86);
}

export function createGroundAnimalHeadGeometry(): THREE.BoxGeometry {
    return new THREE.BoxGeometry(0.34, 0.26, 0.32);
}

export function createGroundAnimalLegGeometry(): THREE.BoxGeometry {
    return new THREE.BoxGeometry(0.1, 0.32, 0.1);
}

export function createGroundAnimalEarGeometry(): THREE.ConeGeometry {
    return new THREE.ConeGeometry(0.07, 0.18, 4);
}

export function createGroundAnimalTailGeometry(): THREE.ConeGeometry {
    return new THREE.ConeGeometry(0.055, 0.34, 5).rotateX(Math.PI / 2);
}

export function createGroundAnimalShadowGeometry(): THREE.CircleGeometry {
    return new THREE.CircleGeometry(0.44, 18).rotateX(-Math.PI / 2);
}

export function createGroundAnimalBodyMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.84,
        metalness: 0,
        vertexColors: true,
    });
}

export function createGroundAnimalHeadMaterial(): THREE.MeshStandardMaterial {
    return createGroundAnimalBodyMaterial();
}

export function createGroundAnimalLegMaterial(): THREE.MeshStandardMaterial {
    return createGroundAnimalBodyMaterial();
}

export function createGroundAnimalEarMaterial(): THREE.MeshStandardMaterial {
    return createGroundAnimalBodyMaterial();
}

export function createGroundAnimalTailMaterial(): THREE.MeshStandardMaterial {
    return createGroundAnimalBodyMaterial();
}

export function createGroundAnimalShadowMaterial(): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
        color: 0x101410,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
    });
}

export const GROUND_ANIMAL_COLORS = [0x7c5a3f, 0x9a7a53, 0x5f6f4a, 0x84613d, 0x6b7280];
