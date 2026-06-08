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
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        wingTexture = new THREE.CanvasTexture(canvas);
        return wingTexture;
    }

    const baseGradient = ctx.createLinearGradient(0, 0, 96, 96);
    baseGradient.addColorStop(0, '#f4f7fb');
    baseGradient.addColorStop(0.5, '#cbd5e1');
    baseGradient.addColorStop(1, '#8fa0b8');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, 96, 96);

    for (let i = 0; i < 12; i += 1) {
        const x = i * 8;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(55, 68, 88, 0.28)' : 'rgba(255, 255, 255, 0.26)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 14, 0);
        ctx.lineTo(x + 4, 96);
        ctx.lineTo(x - 8, 96);
        ctx.fill();
    }

    ctx.strokeStyle = 'rgba(40, 52, 70, 0.3)';
    ctx.lineWidth = 1.4;
    for (let y = 12; y < 96; y += 14) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(48, y + 9, 96, y);
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    for (let y = 6; y < 96; y += 14) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(48, y + 5, 96, y);
        ctx.stroke();
    }

    wingTexture = new THREE.CanvasTexture(canvas);
    wingTexture.wrapS = THREE.RepeatWrapping;
    wingTexture.wrapT = THREE.RepeatWrapping;
    wingTexture.repeat.set(1.15, 1);
    wingTexture.colorSpace = THREE.SRGBColorSpace;
    wingTexture.needsUpdate = true;
    return wingTexture;
}

export const SKY_BIRD_COLORS = [0xe5e7eb, 0xcbd5e1, 0x94a3b8, 0xf8fafc];
