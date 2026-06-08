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
        color: 0xfff3de,
        map: getGroundAnimalFurTexture(),
        roughness,
        metalness: 0,
        emissive: 0x3a2412,
        emissiveIntensity: 0.18,
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
    baseGradient.addColorStop(0, '#d1a06a');
    baseGradient.addColorStop(0.45, '#a6784d');
    baseGradient.addColorStop(1, '#e2b877');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, 96, 96);

    for (let y = 0; y < 96; y += 5) {
        ctx.fillStyle = y % 15 === 0 ? 'rgba(70, 43, 22, 0.28)' : 'rgba(255, 241, 205, 0.16)';
        ctx.fillRect(0, y, 96, y % 15 === 0 ? 2 : 1);
    }

    for (let i = 0; i < 46; i += 1) {
        const x = (i * 23) % 96;
        const y = (i * 37) % 96;
        const r = 2.4 + (i % 4);
        ctx.beginPath();
        ctx.fillStyle = i % 3 === 0 ? 'rgba(58, 36, 20, 0.38)' : 'rgba(255, 224, 165, 0.3)';
        ctx.ellipse(x, y, r * 1.8, r, (i % 8) * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = 'rgba(50, 30, 16, 0.2)';
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

export const GROUND_ANIMAL_COLORS = [0xb98255, 0xd0a36c, 0x8fa665, 0xaa764b, 0xb3bac4];
