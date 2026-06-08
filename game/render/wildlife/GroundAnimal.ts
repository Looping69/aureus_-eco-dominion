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
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        furTexture = new THREE.CanvasTexture(canvas);
        return furTexture;
    }

    ctx.fillStyle = '#9a7a53';
    ctx.fillRect(0, 0, 64, 64);

    for (let y = 0; y < 64; y += 4) {
        ctx.fillStyle = y % 8 === 0 ? 'rgba(54, 38, 24, 0.18)' : 'rgba(255, 245, 220, 0.1)';
        ctx.fillRect(0, y, 64, 1);
    }

    for (let i = 0; i < 34; i += 1) {
        const x = (i * 17) % 64;
        const y = (i * 29) % 64;
        const r = 1.5 + (i % 3);
        ctx.beginPath();
        ctx.fillStyle = i % 2 === 0 ? 'rgba(60, 42, 26, 0.34)' : 'rgba(230, 205, 160, 0.18)';
        ctx.ellipse(x, y, r * 1.4, r, (i % 6) * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    furTexture = new THREE.CanvasTexture(canvas);
    furTexture.wrapS = THREE.RepeatWrapping;
    furTexture.wrapT = THREE.RepeatWrapping;
    furTexture.repeat.set(2, 1);
    furTexture.colorSpace = THREE.SRGBColorSpace;
    furTexture.needsUpdate = true;
    return furTexture;
}

export const GROUND_ANIMAL_COLORS = [0x7c5a3f, 0x9a7a53, 0x5f6f4a, 0x84613d, 0x6b7280];
