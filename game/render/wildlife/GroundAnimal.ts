import * as THREE from 'three';

export function createGroundAnimalBodyGeometry(): THREE.BoxGeometry {
    return new THREE.BoxGeometry(0.5, 0.24, 0.72);
}

export function createGroundAnimalHeadGeometry(): THREE.BoxGeometry {
    return new THREE.BoxGeometry(0.28, 0.22, 0.28);
}

export function createGroundAnimalBodyMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.82,
        metalness: 0,
        vertexColors: true,
    });
}

export function createGroundAnimalHeadMaterial(): THREE.MeshStandardMaterial {
    return createGroundAnimalBodyMaterial();
}

export const GROUND_ANIMAL_COLORS = [0x7c5a3f, 0x9a7a53, 0x5f6f4a, 0x84613d, 0x6b7280];
