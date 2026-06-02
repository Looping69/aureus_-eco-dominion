import * as THREE from 'three';

export function createOverlayLabelMaterial(text: string, color: number): THREE.SpriteMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, depthTest: false });
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(8, 15, 25, 0.82)';
    ctx.fillRect(0, 10, canvas.width, 44);
    ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 12, canvas.width - 4, 40);
    ctx.font = '700 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
}
