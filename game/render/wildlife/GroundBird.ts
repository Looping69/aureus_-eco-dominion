import * as THREE from 'three';

let featherTexture: THREE.CanvasTexture | null = null;

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
        map: getGroundBirdFeatherTexture(),
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

function getGroundBirdFeatherTexture(): THREE.CanvasTexture {
    if (featherTexture) return featherTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        featherTexture = new THREE.CanvasTexture(canvas);
        return featherTexture;
    }

    ctx.fillStyle = '#586344';
    ctx.fillRect(0, 0, 64, 64);

    for (let y = 0; y < 64; y += 8) {
        ctx.fillStyle = 'rgba(25, 35, 28, 0.28)';
        ctx.beginPath();
        ctx.moveTo(0, y + 4);
        for (let x = 0; x <= 64; x += 8) {
            ctx.quadraticCurveTo(x + 4, y, x + 8, y + 4);
        }
        ctx.lineTo(64, y + 7);
        ctx.lineTo(0, y + 7);
        ctx.fill();
    }

    for (let x = 4; x < 64; x += 9) {
        ctx.strokeStyle = 'rgba(230, 220, 170, 0.16)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 10, 64);
        ctx.stroke();
    }

    featherTexture = new THREE.CanvasTexture(canvas);
    featherTexture.wrapS = THREE.RepeatWrapping;
    featherTexture.wrapT = THREE.RepeatWrapping;
    featherTexture.repeat.set(1.4, 1.2);
    featherTexture.colorSpace = THREE.SRGBColorSpace;
    featherTexture.needsUpdate = true;
    return featherTexture;
}

export const GROUND_BIRD_COLORS = [0x3f4f3a, 0x5f6b46, 0x7a6a4a, 0x40556a];
