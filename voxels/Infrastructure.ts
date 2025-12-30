
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { mats } from '../utils/voxelMaterials';
import { voxel, FactoryOptions } from '../utils/voxelBuilder';
import { BuildingType } from '../types';

export const InfrastructureFactory = {
    // ROAD - Detailed asphalt road with markings
    [BuildingType.ROAD]: () => {
        const g = new THREE.Group();
        // Asphalt base
        g.add(voxel(1.0, 0.08, 1.0, mats.asphalt, 0, 0, 0));
        // Center line marking
        g.add(voxel(0.08, 0.02, 0.3, mats.white, 0, 0.08, -0.3));
        g.add(voxel(0.08, 0.02, 0.3, mats.white, 0, 0.08, 0.3));
        return g;
    },

    // PIPE - Water pipe with junction details
    [BuildingType.PIPE]: (opts?: FactoryOptions) => {
        const g = new THREE.Group();
        const isConnected = opts?.waterStatus === 'CONNECTED';

        // Main pipe junction
        g.add(voxel(0.5, 0.5, 0.5, mats.darkPipe, 0, 0, 0));

        // Pipe extensions
        g.add(voxel(0.3, 0.3, 0.55, mats.darkPipe, 0, 0.1, 0));
        g.add(voxel(0.55, 0.3, 0.3, mats.darkPipe, 0, 0.1, 0));

        // Valve wheel
        g.add(voxel(0.2, 0.3, 0.08, mats.metal, 0, 0.4, 0));

        // Status indicator
        const statusMat = isConnected ? mats.emissiveGreen : mats.emissiveRed;
        g.add(voxel(0.18, 0.12, 0.18, statusMat, 0, 0.55, 0));

        // Pipe clamps
        g.add(voxel(0.35, 0.08, 0.35, mats.metal, 0, 0.3, 0));

        return g;
    },

    // FENCE - Reinforced security fencing
    [BuildingType.FENCE]: () => {
        const g = new THREE.Group();
        // Main post
        g.add(voxel(0.12, 1.4, 0.12, mats.metal, 0, 0, 0));

        // Cross bars
        g.add(voxel(0.6, 0.08, 0.06, mats.metal, 0, 0.4, 0));
        g.add(voxel(0.6, 0.08, 0.06, mats.metal, 0, 0.8, 0));
        g.add(voxel(0.6, 0.08, 0.06, mats.metal, 0, 1.2, 0));

        // Mesh pattern (simplified)
        g.add(voxel(0.5, 0.04, 0.04, mats.metal, 0, 0.6, 0));
        g.add(voxel(0.5, 0.04, 0.04, mats.metal, 0, 1.0, 0));

        // Post cap
        g.add(voxel(0.16, 0.1, 0.16, mats.metal, 0, 1.4, 0));

        return g;
    },

    // WATER WELL - Deep water extraction pump
    [BuildingType.WATER_WELL]: () => {
        const g = new THREE.Group();
        // Stone well base
        g.add(voxel(1.0, 0.5, 1.0, mats.concrete, 0, 0, 0));

        // Inner well hole (dark)
        g.add(voxel(0.5, 0.1, 0.5, mats.darkPipe, 0, 0.5, 0));

        // Pump housing
        g.add(voxel(0.4, 1.5, 0.4, mats.metal, 0, 0.5, 0));

        // Pump mechanism
        g.add(voxel(0.5, 0.2, 0.2, mats.metal, 0, 1.5, 0));
        g.add(voxel(0.15, 0.5, 0.15, mats.darkPipe, 0.3, 1.7, 0));

        // Handle
        g.add(voxel(0.4, 0.1, 0.1, mats.wood, 0, 1.3, 0.3));

        // Outlet pipe
        g.add(voxel(0.15, 0.15, 0.4, mats.darkPipe, 0, 0.7, 0.5));
        g.add(voxel(0.12, 0.12, 0.12, mats.emissiveCyan, 0, 0.75, 0.7));

        // Decorative stonework
        g.add(voxel(1.1, 0.15, 1.1, mats.concrete, 0, 0.5, 0));

        return g;
    },

    // POND - Natural water body (not buildable but rendered)
    [BuildingType.POND]: () => {
        const g = new THREE.Group();
        // Water surface handled by terrain shader
        return g;
    },

    // RESERVOIR - Large water storage (3x3 building)
    [BuildingType.RESERVOIR]: () => {
        const g = new THREE.Group();
        // Large concrete tank
        g.add(voxel(2.8, 0.3, 2.8, mats.concrete, 0, 0, 0));
        g.add(voxel(2.6, 1.5, 2.6, mats.concrete, 0, 0.3, 0));

        // Water inside (slightly lower)
        g.add(voxel(2.4, 0.3, 2.4, mats.glass, 0, 1.5, 0));

        // Pump house
        g.add(voxel(0.8, 1.2, 0.8, mats.metal, 1.0, 1.8, 1.0));
        g.add(voxel(0.3, 0.3, 0.05, mats.emissiveCyan, 1.0, 2.3, 1.41));

        // Pipes
        g.add(voxel(0.2, 0.2, 1.5, mats.darkPipe, 0.8, 0.5, 0));
        g.add(voxel(1.5, 0.2, 0.2, mats.darkPipe, 0, 0.5, 0.8));

        // Ladder
        g.add(voxel(0.1, 1.5, 0.1, mats.metal, -1.2, 0.3, 0));
        g.add(voxel(0.1, 1.5, 0.1, mats.metal, -1.0, 0.3, 0));

        // Warning signs
        g.add(voxel(0.3, 0.4, 0.05, mats.hazard, 0, 1.2, 1.31));

        return g;
    },

    // CONSTRUCTION - Scaffolding for buildings under construction
    'CONSTRUCTION': (opts?: FactoryOptions) => {
        const g = new THREE.Group();
        const w = opts?.width || 1;
        const d = opts?.depth || 1;
        const halfW = (w / 2) - 0.05;
        const halfD = (d / 2) - 0.05;

        // 4 Corner pillars
        g.add(voxel(0.12, 2.0, 0.12, mats.metal, -halfW, 0, -halfD));
        g.add(voxel(0.12, 2.0, 0.12, mats.metal, halfW, 0, -halfD));
        g.add(voxel(0.12, 2.0, 0.12, mats.metal, -halfW, 0, halfD));
        g.add(voxel(0.12, 2.0, 0.12, mats.metal, halfW, 0, halfD));

        // Cross bracing
        g.add(voxel(w, 0.08, 0.08, mats.metal, 0, 0.5, -halfD));
        g.add(voxel(w, 0.08, 0.08, mats.metal, 0, 0.5, halfD));
        g.add(voxel(w, 0.08, 0.08, mats.metal, 0, 1.2, -halfD));
        g.add(voxel(w, 0.08, 0.08, mats.metal, 0, 1.2, halfD));
        g.add(voxel(0.08, 0.08, d, mats.metal, -halfW, 1.2, 0));
        g.add(voxel(0.08, 0.08, d, mats.metal, halfW, 1.2, 0));

        // Top hazard rail
        g.add(voxel(w, 0.12, d, mats.hazard, 0, 2.0, 0));

        // Partial floor/progress indicator
        const progress = opts?.progress || 0.5;
        g.add(voxel(w * progress, 0.15, d * 0.8, mats.wood, -halfW * (1 - progress), 0.6, 0));

        return g;
    },
}
