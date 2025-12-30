
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { NatureFactory } from '../voxels/Nature';
import { InfrastructureFactory } from '../voxels/Infrastructure';
import { BuildingsFactory } from '../voxels/Buildings';
import { GrassTrees, SnowTrees, SandTrees, DirtTrees, StoneTrees } from '../voxels/BiomeTrees';
import { FactoryOptions } from './voxelBuilder';

// Re-export shared assets for VoxelEngine compatibility
export { waterFlowMaterial, terrainMats } from './voxelMaterials';
export { sharedBoxGeo } from './voxelBuilder';

export const BuildingFactory: Record<string, (opts?: FactoryOptions) => THREE.Group> = {
    ...NatureFactory,
    ...InfrastructureFactory,
    ...BuildingsFactory,
    ...GrassTrees,
    ...SnowTrees,
    ...SandTrees,
    ...DirtTrees,
    ...StoneTrees
};
