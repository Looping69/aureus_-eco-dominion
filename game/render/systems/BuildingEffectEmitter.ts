import * as THREE from 'three';

export interface BuildingEffectParticle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    decay: number;
}

export function emitParticle(
    scene: THREE.Scene,
    buildingMeshes: Map<number, THREE.Object3D>,
    particles: BuildingEffectParticle[],
    particleGeo: THREE.BufferGeometry,
    particleMats: Record<string, THREE.MeshBasicMaterial>,
    tileId: number,
    type: string,
) {
    const mesh = buildingMeshes.get(tileId);
    const mat = particleMats[type];
    const p = new THREE.Mesh(particleGeo, mat);

    if (mesh) {
        p.position.copy(mesh.position);
    } else {
        p.position.set(0, 0, 0);
    }

    p.position.y += 0.5 + Math.random() * 0.5;
    p.position.x += (Math.random() - 0.5) * 0.5;
    p.position.z += (Math.random() - 0.5) * 0.5;

    scene.add(p);
    particles.push({
        mesh: p,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.05 + Math.random() * 0.08, (Math.random() - 0.5) * 0.1),
        life: 1.0,
        decay: 0.03,
    });
}

export function triggerEffect(
    scene: THREE.Scene,
    buildingMeshes: Map<number, THREE.Object3D>,
    particles: BuildingEffectParticle[],
    particleGeo: THREE.BufferGeometry,
    particleMats: Record<string, THREE.MeshBasicMaterial>,
    worldX: number,
    worldZ: number,
    type: string,
    offset: number,
) {
    const tileId = Math.round(worldX) * 1000000 + Math.round(worldZ);
    if (type === 'DUST') {
        for (let i = 0; i < 5; i++) emitParticle(scene, buildingMeshes, particles, particleGeo, particleMats, tileId, 'DIRT');
    } else if (type === 'MINING') {
        for (let i = 0; i < 8; i++) emitParticle(scene, buildingMeshes, particles, particleGeo, particleMats, tileId, Math.random() > 0.5 ? 'ROCK' : 'DIRT');
    } else if (type === 'SMOKE') {
        for (let i = 0; i < 3; i++) emitParticle(scene, buildingMeshes, particles, particleGeo, particleMats, tileId, 'SMOKE');
    } else if (type === 'ECO_REHAB') {
        for (let i = 0; i < 10; i++) emitParticle(scene, buildingMeshes, particles, particleGeo, particleMats, tileId, 'ECO');
    }
}
