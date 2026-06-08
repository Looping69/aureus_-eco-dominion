import * as THREE from 'three';

export function createSkyBirdGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
        0, 0, 0,
        -0.72, 0.06, -0.16,
        -0.18, 0.02, 0.08,
        0, 0, 0,
        0.72, 0.06, -0.16,
        0.18, 0.02, 0.08,
        -0.12, 0.02, 0.1,
        0.12, 0.02, 0.1,
        0, -0.02, 0.34,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
}

export function createSkyBirdMaterial(): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        opacity: 0.86,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
}

export const SKY_BIRD_COLORS = [0xe5e7eb, 0xcbd5e1, 0x94a3b8, 0xf8fafc];
