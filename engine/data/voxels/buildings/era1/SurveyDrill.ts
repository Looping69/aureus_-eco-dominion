import * as THREE from 'three';
import { mats } from '../../../../render/materials/VoxelMaterials';
import { voxel, FactoryOptions } from '../../../../render/utils/VoxelBuilder';

export const SurveyDrillFactory = (opts?: FactoryOptions) => {
    const g = new THREE.Group();
    const isPowered = opts?.powerStatus === 'CONNECTED';

    // Concrete pad
    g.add(voxel(0.95, 0.15, 0.95, mats.concrete, 0, 0, 0));

    // Drill base
    g.add(voxel(0.6, 0.25, 0.6, mats.metal, 0, 0.15, 0));

    // Drill column
    g.add(voxel(0.16, 1.6, 0.16, mats.darkPipe, 0, 0.55, 0));

    // Sensor head
    g.add(voxel(0.35, 0.2, 0.35, mats.metal, 0, 1.45, 0));

    // Status light (only when completed)
    if (!opts?.isUnderConstruction) {
        g.add(voxel(0.12, 0.12, 0.12, isPowered ? mats.emissiveGreen : mats.emissiveOrange, 0.25, 0.28, 0.25));
    }

    return g;
};
