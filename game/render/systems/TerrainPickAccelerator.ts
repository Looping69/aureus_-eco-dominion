import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

type BvhGeometry = THREE.BufferGeometry & {
    computeBoundsTree?: () => void;
    disposeBoundsTree?: () => void;
    boundsTree?: unknown;
};

export type TerrainPickHandler = (raycaster: THREE.Raycaster) => THREE.Intersection | null;

let bvhInstalled = false;

export function installTerrainBvhRaycast(): void {
    if (bvhInstalled) return;

    const geometryPrototype = THREE.BufferGeometry.prototype as BvhGeometry;
    geometryPrototype.computeBoundsTree = computeBoundsTree as unknown as () => void;
    geometryPrototype.disposeBoundsTree = disposeBoundsTree as unknown as () => void;
    (THREE.Mesh.prototype as unknown as { raycast: THREE.Mesh['raycast'] }).raycast = acceleratedRaycast as THREE.Mesh['raycast'];

    bvhInstalled = true;
}

export function buildTerrainBoundsTree(geometry: THREE.BufferGeometry): void {
    installTerrainBvhRaycast();
    (geometry as BvhGeometry).computeBoundsTree?.();
}

export function disposeTerrainBoundsTree(geometry: THREE.BufferGeometry | null | undefined): void {
    (geometry as BvhGeometry | null | undefined)?.disposeBoundsTree?.();
}

export function pickClosestTerrainHit(
    raycaster: THREE.Raycaster,
    meshes: Iterable<THREE.Mesh>
): THREE.Intersection | null {
    installTerrainBvhRaycast();

    let closest: THREE.Intersection | null = null;
    for (const mesh of meshes) {
        if (!mesh.visible || !mesh.geometry) continue;
        const hits = raycaster.intersectObject(mesh, false);
        const hit = hits[0];
        if (hit && (!closest || hit.distance < closest.distance)) {
            closest = hit;
        }
    }

    return closest;
}
