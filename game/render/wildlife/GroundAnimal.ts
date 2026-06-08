import * as THREE from 'three';

let furTexture: THREE.CanvasTexture | null = null;

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
    return createTexturedFurMaterial(0.84);
}

export function createGroundAnimalHeadMaterial(): THREE.MeshStandardMaterial {
    return createTexturedFurMaterial(0.82);
}

export function createGroundAnimalLegMaterial(): THREE.MeshStandardMaterial {
    return createTexturedFurMaterial(0.88);
}

export function createGroundAnimalEarMaterial(): THREE.MeshStandardMaterial {
    return createTexturedFurMaterial(0.8);
}

export function createGroundAnimalTailMaterial(): THREE.MeshStandardMaterial {
    return createTexturedFurMaterial(0.86);
}

export function createGroundAnimalShadowMaterial(): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
        color: 0x101410,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
    });
}

function createTexturedFurMaterial(roughness: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: getGroundAnimalFurTexture(),
        roughness,
        metalness: 0,
        vertexColors: true,
    });
}

function getGroundAnimalFurTexture(): THREE.CanvasTexture {
    if (furTexture) return furTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        furTexture = new THREE.CanvasTexture(canvas);
        return furTexture;
    }

    const baseGradient = ctx.createLinearGradient(0, 0, 96, 96);
    baseGradient.addColorStop(0, '#b08a5d');
    baseGradient.addColorStop(0.45, '#8a6845');
    baseGradient.addColorStop(1, '#c39b68');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, 96, 96);

    for (let y = 0; y < 96; y += 5) {
        ctx.fillStyle = y % 15 === 0 ? 'rgba(48, 32, 19, 0.32)' : 'rgba(255, 233, 190, 0.12)';
        ctx.fillRect(0, y, 96, y % 15 === 0 ? 2 : 1);
    }

    for (let i = 0; i < 46; i += 1) {
        const x = (i * 23) % 96;
        const y = (i * 37) % 96;
        const r = 2.4 + (i % 4);
        ctx.beginPath();
        ctx.fillStyle = i % 3 === 0 ? 'rgba(42, 30, 20, 0.46)' : 'rgba(225, 195, 140, 0.24)';
        ctx.ellipse(x, y, r * 1.8, r, (i % 8) * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = 'rgba(35, 24, 17, 0.22)';
    ctx.lineWidth = 1.4;
    for (let x = -24; x < 120; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.quadraticCurveTo(x + 18, 42, x + 6, 96);
        ctx.stroke();
    }

    furTexture = new THREE.CanvasTexture(canvas);
    furTexture.wrapS = THREE.RepeatWrapping;
    furTexture.wrapT = THREE.RepeatWrapping;
    furTexture.repeat.set(1.65, 1.15);
    furTexture.colorSpace = THREE.SRGBColorSpace;
    furTexture.needsUpdate = true;
    return furTexture;
}

export const GROUND_ANIMAL_COLORS = [0x7c5a3f, 0x9a7a53, 0x5f6f4a, 0x84613d, 0x6b7280];
