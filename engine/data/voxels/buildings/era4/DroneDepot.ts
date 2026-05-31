import * as THREE from 'three';
import { mats } from '../../../../render/materials/VoxelMaterials';
import { FactoryOptions, voxel, cylinder } from '../../../../render/utils/VoxelBuilder';

export const DroneDepotFactory = (opts?: FactoryOptions) => {
    const g = new THREE.Group();
    const isPowered = opts?.powerStatus === 'CONNECTED';

    g.add(voxel(3.0, 0.24, 2.0, mats.concrete, 0, 0, 0));
    g.add(voxel(2.72, 0.08, 1.72, mats.concreteLight, 0, 0.24, 0));

    g.add(voxel(1.9, 0.18, 1.15, mats.darkMetal, 0, 0.32, 0));
    g.add(voxel(1.45, 0.52, 0.82, mats.blueMetal, 0, 0.5, -0.18));
    g.add(voxel(1.05, 0.34, 0.08, mats.glass, 0, 0.72, 0.27));

    g.add(voxel(0.22, 1.0, 0.22, mats.metal, 0, 0.32, -0.48));
    g.add(voxel(0.42, 0.16, 0.42, mats.emissiveCyan, 0, 1.32, -0.48));

    const padOffsets: Array<[number, number]> = [
        [-0.95, -0.48],
        [-0.95, 0.48],
        [0.95, -0.48],
        [0.95, 0.48],
        [-0.3, 0.72],
        [0.3, 0.72],
    ];
    padOffsets.forEach(([x, z], index) => {
        g.add(voxel(0.42, 0.06, 0.42, mats.darkMetal, x, 0.28, z));
        if (!opts?.isUnderConstruction) {
            g.add(voxel(0.28, 0.03, 0.28, index % 2 === 0 ? mats.emissiveCyan : mats.emissiveGreen, x, 0.34, z));
        }
    });

    g.add(voxel(2.28, 0.06, 0.12, mats.hazard, 0, 0.34, -0.92));
    g.add(voxel(2.28, 0.06, 0.12, mats.hazard, 0, 0.34, 0.92));

    g.add(cylinder(0.1, 0.85, mats.darkPipe, -1.22, 0.32, 0));
    g.add(cylinder(0.1, 0.85, mats.darkPipe, 1.22, 0.32, 0));
    if (!opts?.isUnderConstruction) {
        g.add(voxel(0.16, 0.16, 0.16, isPowered ? mats.emissiveGreen : mats.emissiveRed, -1.22, 1.18, 0));
        g.add(voxel(0.16, 0.16, 0.16, isPowered ? mats.emissiveCyan : mats.emissiveRed, 1.22, 1.18, 0));
    }

    g.add(voxel(0.72, 0.18, 0.18, mats.metal, 0, 0.94, -0.48));
    g.add(voxel(0.18, 0.18, 0.72, mats.metal, 0, 0.94, -0.48));

    return g;
};
