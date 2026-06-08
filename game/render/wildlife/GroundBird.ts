import * as THREE from 'three';

export function createGroundBirdBodyGeometry(): THREE.BoxGeometry {
    return new THREE.BoxGeometry(0.42, 0.28, 0.58);
}

export function createGroundBirdNeckGeometry(): THREE.BoxGeometry {
    return new THREE.BoxGeometry(0.12, 0.42, 0.12);
}

export function createGroundBirdHeadGeometry(): THREE.BoxGeometry {
    return new THREE.BoxGeometry(0.22, 0.2, 0.22);
}

export function createGroundBirdBeakGeometry(): THREE.ConeGeometry {
    return new THREE.ConeGeometry(0.055, 0.26, 4).rotateX(Math.PI / 2);
}

export function createGroundBirdLegGeometry(): THREE.BoxGeometry {
    return new THREE.BoxGeometry(0.07, 0.42, 0.07);
}

export function createGroundBirdWingGeometry(): THREE.BoxGeometry {
    return new THREE.BoxGeometry(0.08, 0.16, 0.46);
}

export function createGroundBirdShadowGeometry(): THREE.CircleGeometry {
    return new THREE.CircleGeometry(0.38, 18).rotateX(-Math.PI / 2);
}

export function createGroundBirdFeatherMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.78,
        metalness: 0,
        vertexColors: true,
    });
}

export function createGroundBirdBeakMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: 0xf2b84b,
        roughness: 0.7,
        metalness: 0,
    });
}

export function createGroundBirdLegMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: 0x8b5a2b,
        roughness: 0.76,
        metalness: 0,
    });
}

export function createGroundBirdShadowMaterial(): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
        color: 0x101410,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
    });
}

export const GROUND_BIRD_COLORS = [0x3f4f3a, 0x5f6b46, 0x7a6a4a, 0x40556a];
