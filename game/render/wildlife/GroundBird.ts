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
        color: 0xf2edcf,
        map: getGroundBirdFeatherTexture(),
        roughness: 0.78,
        metalness: 0,
        emissive: 0x27321f,
        emissiveIntensity: 0.16,
        vertexColors: true,
    });
}

export function createGroundBirdBeakMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: 0xf2b84b,
        roughness: 0.7,
        metalness: 0,
        emissive: 0x4a2b08,
        emissiveIntensity: 0.08,
    });
}

export function createGroundBirdLegMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: 0xa97039,
        roughness: 0.76,
        metalness: 0,
        emissive: 0x2c1708,
        emissiveIntensity: 0.08,
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
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        featherTexture = new THREE.CanvasTexture(canvas);
        return featherTexture;
    }

    const baseGradient = ctx.createLinearGradient(0, 0, 96, 96);
    baseGradient.addColorStop(0, '#8a965f');
    baseGradient.addColorStop(0.5, '#5f6f45');
    baseGradient.addColorStop(1, '#9a7a4e');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, 96, 96);

    for (let y = 0; y < 96; y += 10) {
        ctx.fillStyle = 'rgba(31, 43, 30, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, y + 6);
        for (let x = 0; x <= 96; x += 10) {
            ctx.quadraticCurveTo(x + 5, y, x + 10, y + 6);
        }
        ctx.lineTo(96, y + 10);
        ctx.lineTo(0, y + 10);
        ctx.fill();

        ctx.strokeStyle = 'rgba(250, 232, 170, 0.26)';
        ctx.beginPath();
        ctx.moveTo(0, y + 3);
        for (let x = 0; x <= 96; x += 10) {
            ctx.quadraticCurveTo(x + 5, y - 1, x + 10, y + 3);
        }
        ctx.stroke();
    }

    for (let x = 6; x < 104; x += 11) {
        ctx.strokeStyle = x % 22 === 0 ? 'rgba(44, 56, 34, 0.28)' : 'rgba(255, 238, 180, 0.22)';
        ctx.lineWidth = x % 22 === 0 ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 16, 96);
        ctx.stroke();
    }

    for (let i = 0; i < 28; i += 1) {
        const x = (i * 31) % 96;
        const y = (i * 19) % 96;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(31, 42, 28, 0.24)' : 'rgba(255, 230, 160, 0.24)';
        ctx.beginPath();
        ctx.ellipse(x, y, 2.5, 1.3, i * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }

    featherTexture = new THREE.CanvasTexture(canvas);
    featherTexture.wrapS = THREE.RepeatWrapping;
    featherTexture.wrapT = THREE.RepeatWrapping;
    featherTexture.repeat.set(1.35, 1.15);
    featherTexture.colorSpace = THREE.SRGBColorSpace;
    featherTexture.needsUpdate = true;
    return featherTexture;
}

export const GROUND_BIRD_COLORS = [0x6f844d, 0x9a9f62, 0xaa8552, 0x6884a0];
