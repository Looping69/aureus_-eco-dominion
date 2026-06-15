
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { NatureFactory } from '../../data/voxels/Nature';
import { BuildingsFactory } from '../../data/voxels/buildings';
import { GrassTrees, SnowTrees, SandTrees, DirtTrees, StoneTrees } from '../../data/voxels/BiomeTrees';
import { applyBuildingStyleToGroup, readSavedBuildingStyle } from '../../../game/design/buildingStyleRuntime';
import { FactoryOptions } from './VoxelBuilder';

// Re-export shared assets for VoxelEngine compatibility
export { waterFlowMaterial, terrainMats } from '../materials/VoxelMaterials';
export { sharedBoxGeo } from './VoxelBuilder';

function withDesignStudioStyle(factory: Record<string, (opts?: FactoryOptions) => THREE.Group>): Record<string, (opts?: FactoryOptions) => THREE.Group> {
    return Object.fromEntries(
        Object.entries(factory).map(([type, create]) => [
            type,
            (opts?: FactoryOptions) => applyBuildingStyleToGroup(type, create(opts), readSavedBuildingStyle()),
        ]),
    );
}

export const BuildingFactory: Record<string, (opts?: FactoryOptions) => THREE.Group> = {
    ...NatureFactory,
    ...withDesignStudioStyle(BuildingsFactory),
    ...GrassTrees,
    ...SnowTrees,
    ...SandTrees,
    ...DirtTrees,
    ...StoneTrees
};
