import * as THREE from 'three';

let wingTexture: THREE.CanvasTexture | null = null;

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
        map: getSkyBirdWingTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
}

function getSkyBirdWingTexture(): THREE.CanvasTexture {
    if (wingTexture) return wingTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        wingTexture = new THREE.CanvasTexture(canvas);
        return wingTexture;
    }

    ctx.fillStyle = '#d9e2ef';
    ctx.fillRect(0, 0, 64, 64);

    for (let i = 0; i < 9; i += 1) {
        const x = i * 8;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(80, 96, 120, 0.16)' : 'rgba(255, 255, 255, 0.18)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 10, 0);
        ctx.lineTo(x + 2, 64);
        ctx.lineTo(x - 6, 64);
        ctx.fill();
    }

    ctx.strokeStyle = 'rgba(55, 65, 81, 0.18)';
    for (let y = 10; y < 64; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(32, y + 6, 64, y);
        ctx.stroke();
    }

    wingTexture = new THREE.CanvasTexture(canvas);
    wingTexture.wrapS = THREE.RepeatWrapping;
    wingTexture.wrapT = THREE.RepeatWrapping;
    wingTexture.repeat.set(1.2, 1);
    wingTexture.colorSpace = THREE.SRGBColorSpace;
    wingTexture.needsUpdate = true;
    return wingTexture;
}

export const SKY_BIRD_COLORS = [0xe5e7eb, 0xcbd5e1, 0x94a3b8, 0xf8fafc];
