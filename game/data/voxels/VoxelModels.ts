
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Voxel model data for complex imported buildings
 */

import * as THREE from 'three';

// Voxel data interface
interface VoxelData {
    id: number;
    x: number;
    y: number;
    z: number;
    c: string;
}

// Color to material mapping cache
const colorMaterialCache: Map<string, THREE.MeshStandardMaterial> = new Map();

function getColorMaterial(hexColor: string): THREE.MeshStandardMaterial {
    if (colorMaterialCache.has(hexColor)) {
        return colorMaterialCache.get(hexColor)!;
    }
    const mat = new THREE.MeshStandardMaterial({
        color: hexColor,
        roughness: 0.7,
        metalness: hexColor.includes('424242') || hexColor.includes('9e9e9e') ? 0.5 : 0.2
    });
    colorMaterialCache.set(hexColor, mat);
    return mat;
}

// Shared box geometry for voxels
const sharedVoxelGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);

/**
 * Creates a THREE.Group from voxel data array
 * Scales and centers the model appropriately
 */
export function createGroupFromVoxelData(data: VoxelData[], scale: number = 0.1): THREE.Group {
    const g = new THREE.Group();

    // Find bounds to center the model
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const v of data) {
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
        minZ = Math.min(minZ, v.z);
        maxZ = Math.max(maxZ, v.z);
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const baseY = minY; // Use minimum Y as base

    for (const v of data) {
        const mesh = new THREE.Mesh(sharedVoxelGeo, getColorMaterial(v.c));
        // Center X and Z, put Y at ground level
        mesh.position.set(
            (v.x - centerX) * scale,
            (v.y - baseY) * scale,
            (v.z - centerZ) * scale
        );
        g.add(mesh);
    }

    return g;
}

// MINING HEADFRAME - Large industrial mining tower data (simplified version)
// Original has ~1500 voxels, we'll use a representative simplified version
export const MINING_HEADFRAME_DATA: VoxelData[] = [
    // Main tower frame - 4 corner pillars
    ...Array.from({ length: 20 }, (_, i) => ({ id: i, x: -3, y: i - 2, z: -3, c: '#424242' })),
    ...Array.from({ length: 20 }, (_, i) => ({ id: i + 20, x: 3, y: i - 2, z: -3, c: '#424242' })),
    ...Array.from({ length: 20 }, (_, i) => ({ id: i + 40, x: -3, y: i - 2, z: 3, c: '#424242' })),
    ...Array.from({ length: 20 }, (_, i) => ({ id: i + 60, x: 3, y: i - 2, z: 3, c: '#424242' })),

    // Cross braces at various levels
    ...Array.from({ length: 7 }, (_, i) => ({ id: 80 + i, x: -3 + i, y: 5, z: -3, c: '#9e9e9e' })),
    ...Array.from({ length: 7 }, (_, i) => ({ id: 87 + i, x: -3 + i, y: 5, z: 3, c: '#9e9e9e' })),
    ...Array.from({ length: 7 }, (_, i) => ({ id: 94 + i, x: -3, y: 5, z: -3 + i, c: '#9e9e9e' })),
    ...Array.from({ length: 7 }, (_, i) => ({ id: 101 + i, x: 3, y: 5, z: -3 + i, c: '#9e9e9e' })),

    // Top platform
    ...Array.from({ length: 7 }, (_, i) =>
        Array.from({ length: 7 }, (_, j) => ({ id: 110 + i * 7 + j, x: -3 + i, y: 17, z: -3 + j, c: '#654321' }))
    ).flat(),

    // Wheel structure at top
    ...Array.from({ length: 5 }, (_, i) => ({ id: 160 + i, x: 0, y: 12 + i, z: -4, c: '#9e9e9e' })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: 165 + i, x: 0, y: 12 + i, z: 4, c: '#9e9e9e' })),
    { id: 170, x: 0, y: 14, z: -5, c: '#111111' },
    { id: 171, x: 0, y: 14, z: 5, c: '#111111' },

    // Mining wheel (circular elements)
    ...Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return { id: 172 + i, x: 0, y: 14 + Math.round(Math.sin(angle) * 3), z: Math.round(Math.cos(angle) * 3), c: '#f44336' };
    }),

    // Base platform
    ...Array.from({ length: 9 }, (_, i) =>
        Array.from({ length: 9 }, (_, j) => ({ id: 200 + i * 9 + j, x: -4 + i, y: -2, z: -4 + j, c: '#9e9e9e' }))
    ).flat(),

    // Machinery at base
    ...Array.from({ length: 5 }, (_, i) =>
        Array.from({ length: 3 }, (_, j) => ({ id: 290 + i * 3 + j, x: -2 + i, y: -1, z: -1 + j, c: '#2196f3' }))
    ).flat(),

    // Control booth
    ...Array.from({ length: 3 }, (_, i) =>
        Array.from({ length: 3 }, (_, j) =>
            Array.from({ length: 2 }, (_, k) => ({ id: 310 + i * 6 + j * 2 + k, x: -5 + i, y: k, z: -1 + j, c: '#ffd700' }))
        ).flat()
    ).flat(),
];

// ORE FOUNDRY - Smelting facility data (simplified version)  
export const ORE_FOUNDRY_DATA: VoxelData[] = [
    // Main dome structure - circular base
    ...Array.from({ length: 17 }, (_, i) =>
        Array.from({ length: 11 }, (_, j) => ({ id: i * 11 + j, x: -8 + i, y: -12 + j, z: -4, c: j % 3 === 0 ? '#654321' : '#424242' }))
    ).flat(),

    // Dome rings (expanding upward)
    ...Array.from({ length: 15 }, (_, r) => {
        const y = r;
        const radius = Math.min(4 + r * 0.5, 9);
        return Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            return { id: 200 + r * 12 + i, x: Math.round(Math.cos(angle) * radius), y: y, z: Math.round(Math.sin(angle) * radius), c: '#9e9e9e' };
        });
    }).flat(),

    // Central processing area
    ...Array.from({ length: 11 }, (_, i) =>
        Array.from({ length: 6 }, (_, j) => ({ id: 400 + i * 6 + j, x: 6 + i * 0.5, y: 0, z: -5 + j, c: '#9e9e9e' }))
    ).flat(),

    // Smoke stacks
    ...Array.from({ length: 8 }, (_, i) => ({ id: 470 + i, x: -6, y: -8 + i, z: 0, c: '#9e9e9e' })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: 478 + i, x: -4, y: -8 + i, z: 2, c: '#9e9e9e' })),

    // Furnace glow
    ...Array.from({ length: 3 }, (_, i) =>
        Array.from({ length: 3 }, (_, j) => ({ id: 490 + i * 3 + j, x: -1 + i, y: -8, z: -1 + j, c: '#2196f3' }))
    ).flat(),

    // Base platform
    ...Array.from({ length: 20 }, (_, i) =>
        Array.from({ length: 20 }, (_, j) => ({ id: 500 + i * 20 + j, x: -10 + i, y: -12, z: -10 + j, c: i % 4 === 0 || j % 4 === 0 ? '#654321' : '#424242' }))
    ).flat(),
];
