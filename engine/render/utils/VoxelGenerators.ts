/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { NatureFactory } from '../../data/voxels/Nature';
import { BuildingsFactory } from '../../data/voxels/buildings';
import { GrassTrees, SnowTrees, SandTrees, DirtTrees, StoneTrees } from '../../data/voxels/BiomeTrees';
import { bakedBuildingMaterial, waterFlowMaterial, terrainMats } from '../materials/VoxelMaterials';
import { FactoryOptions, sharedBoxGeo } from './VoxelBuilder';
import { mergeGroupGeometry } from './VoxelUtils';

// Re-export shared assets for VoxelEngine compatibility
export { waterFlowMaterial, terrainMats, sharedBoxGeo };

type FactorySource = Record<string, (opts?: FactoryOptions) => THREE.Group>;

const STATIC_BAKE_EXCLUDED_KEYS = new Set([
    'ILLEGAL_CAMP',
    'WASH_PLANT',
    'RECYCLING_PLANT',
]);

const rawBuildingFactory: FactorySource = {
    ...NatureFactory,
    ...BuildingsFactory,
    ...GrassTrees,
    ...SnowTrees,
    ...SandTrees,
    ...DirtTrees,
    ...StoneTrees
};

function hasDynamicOrRichMaterial(group: THREE.Group): boolean {
    let blocked = false;

    group.traverse((child: any) => {
        if (blocked) return;

        const userData = child.userData || {};
        if (userData.isRotor || userData.isSolarPanel || userData.isNugget || userData.isConveyorPulse) {
            blocked = true;
            return;
        }

        if (!child.isMesh) return;

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        blocked = materials.some((material: any) => {
            return Boolean(
                material?.transparent ||
                material?.isShaderMaterial ||
                material?.map ||
                material?.normalMap ||
                material?.roughnessMap ||
                material?.metalnessMap
            );
        });
    });

    return blocked;
}

function shouldBakeStaticFactoryGroup(key: string, opts: FactoryOptions | undefined, group: THREE.Group): boolean {
    if (opts?.detailLevel === undefined || opts.detailLevel === 'HIGH') return false;
    if (opts?.isUnderConstruction) return false;
    if (STATIC_BAKE_EXCLUDED_KEYS.has(key)) return false;
    return !hasDynamicOrRichMaterial(group);
}

function bakeStaticFactoryGroup(group: THREE.Group): THREE.Group {
    const baked = new THREE.Group();
    const geometry = mergeGroupGeometry(group);
    const mesh = new THREE.Mesh(geometry, bakedBuildingMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.userData.isBakedStaticBuilding = true;
    baked.userData.isBakedStaticBuilding = true;
    baked.add(mesh);
    return baked;
}

function wrapFactory(key: string, factory: (opts?: FactoryOptions) => THREE.Group) {
    return (opts?: FactoryOptions) => {
        const group = factory(opts);
        if (!shouldBakeStaticFactoryGroup(key, opts, group)) {
            return group;
        }
        return bakeStaticFactoryGroup(group);
    };
}

export const BuildingFactory: Record<string, (opts?: FactoryOptions) => THREE.Group> = Object.fromEntries(
    Object.entries(rawBuildingFactory).map(([key, factory]) => [key, wrapFactory(key, factory)])
);
