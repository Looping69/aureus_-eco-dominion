
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { mats } from '../../render/materials/VoxelMaterials';
import { buildVoxelGroup, FactoryOptions } from '../../render/utils/VoxelBuilder';

// Helper to add voxels to a list
type VoxelData = { x: number, y: number, z: number, c: string };

function addVoxel(list: VoxelData[], x: number, y: number, z: number, c: string) {
    // Simple dedupe could go here, but usually procedural logic handles it
    list.push({ x: Math.round(x), y: Math.round(y), z: Math.round(z), c });
}

// Material Keys for the Builder
const MAT_MAP: Record<string, THREE.Material> = {
    'wood': mats.wood,
    'leaf': mats.leaf,
    'birch': mats.birchWood,
    'birchLeaf': mats.birchLeaf,
    'willow': mats.willowLeaf,
    'apple': mats.appleFruit,
    'pine': mats.pine,
    'snow': mats.snowLeaf, // used for frosted tips
    'cactus': mats.cactus,
    'palmTrunk': mats.palmTrunk,
    'palmLeaf': mats.palmLeaf,
    'dead': mats.deadWood,
    'stem': mats.mushroomStem,
    'cap': mats.mushroomCap,
    'bone': mats.bone,
    'rock': mats.rock,
    'moss': mats.leaf, // re-use leaf for moss
    'sandstone': mats.sandStone,
    'crystal': mats.crystalCyan,
    'flower': mats.flowerPurple,
    'flowerYellow': mats.flowerYellow,
    'white': mats.white,
    'glass': mats.glass
};

// --- PROCEDURAL GENERATORS ---

const Generators = {
    // Blobby Tree (Oak)
    basicTree: (height: number, leafRad: number, trunkMat: string, leafMat: string, fruitMat?: string) => {
        const voxels: VoxelData[] = [];
        // Trunk
        for (let y = 0; y < height; y++) {
            addVoxel(voxels, 0, y, 0, trunkMat);
            if (y > 2 && y < height - 1) { // Thicken base
                if (y === 0) {
                    addVoxel(voxels, 1, 0, 0, trunkMat);
                    addVoxel(voxels, -1, 0, 0, trunkMat);
                    addVoxel(voxels, 0, 0, 1, trunkMat);
                    addVoxel(voxels, 0, 0, -1, trunkMat);
                }
            }
        }

        // Leaves (Sphere-ish)
        const center = { x: 0, y: height - 1, z: 0 };
        for (let x = -leafRad; x <= leafRad; x++) {
            for (let y = -leafRad; y <= leafRad; y++) {
                for (let z = -leafRad; z <= leafRad; z++) {
                    const d = Math.sqrt(x * x + y * y + z * z);
                    if (d <= leafRad) {
                        // Noise to break up sphere
                        if (Math.random() > 0.2) {
                            addVoxel(voxels, center.x + x, center.y + y + 1, center.z + z, leafMat);
                            // Fruit
                            if (fruitMat && d >= leafRad - 1 && Math.random() > 0.95) {
                                addVoxel(voxels, center.x + x, center.y + y + 1, center.z + z, fruitMat);
                            }
                        }
                    }
                }
            }
        }
        return voxels;
    },

    // Pine Tree (Conical layers)
    pineTree: (height: number, width: number, trunkMat: string, leafMat: string, frostMat?: string) => {
        const voxels: VoxelData[] = [];
        // Trunk
        for (let y = 0; y < height; y++) addVoxel(voxels, 0, y, 0, trunkMat);

        // Layers
        let currentW = width;
        let startY = 2;
        while (startY < height + 1) {
            for (let x = -currentW; x <= currentW; x++) {
                for (let z = -currentW; z <= currentW; z++) {
                    if (Math.abs(x) + Math.abs(z) <= currentW + 0.5) {
                        const mat = (frostMat && startY > height * 0.6 && Math.random() > 0.6) ? frostMat : leafMat;
                        addVoxel(voxels, x, startY, z, mat);
                    }
                }
            }
            startY += 2;
            currentW = Math.max(0, currentW - 1);
        }
        // Top tip
        addVoxel(voxels, 0, height + 1, 0, leafMat);
        return voxels;
    },

    // Palm Tree (Curved trunk + Star leaves)
    palmTree: (height: number, trunkMat: string, leafMat: string) => {
        const voxels: VoxelData[] = [];
        let curX = 0;
        // Trunk with curve
        for (let y = 0; y < height; y++) {
            addVoxel(voxels, Math.round(curX), y, 0, trunkMat);
            if (y > height * 0.3 && y % 2 === 0) curX += 0.5;
        }

        const topX = Math.round(curX);
        const topY = height - 1;

        // Fronds (Cross pattern droop)
        const frondLen = 4;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

        dirs.forEach(([dx, dz]) => {
            for (let i = 1; i <= frondLen; i++) {
                let drop = 0;
                if (i > 2) drop = 1;
                if (i > 3) drop = 2;
                addVoxel(voxels, topX + (dx * i), topY - drop, (dz * i), leafMat);
            }
        });
        addVoxel(voxels, topX, topY, 0, leafMat); // Center
        return voxels;
    },

    // Cactus (Column + Arms)
    cactus: (height: number, arms: boolean, mat: string) => {
        const voxels: VoxelData[] = [];
        // Main
        for (let y = 0; y < height; y++) {
            addVoxel(voxels, 0, y, 0, mat);
            // Thick trunk
            if (y < height - 1) {
                addVoxel(voxels, 1, y, 0, mat);
                addVoxel(voxels, 0, y, 1, mat);
                addVoxel(voxels, 1, y, 1, mat);
            }
        }

        if (arms) {
            // Arm 1
            const armY = Math.floor(height * 0.4);
            addVoxel(voxels, 2, armY, 0, mat);
            addVoxel(voxels, 3, armY, 0, mat);
            addVoxel(voxels, 3, armY + 1, 0, mat);
            addVoxel(voxels, 3, armY + 2, 0, mat);

            // Arm 2
            const armY2 = Math.floor(height * 0.6);
            addVoxel(voxels, -1, armY2, 1, mat);
            addVoxel(voxels, -2, armY2, 1, mat);
            addVoxel(voxels, -2, armY2 + 1, 1, mat);
        }
        return voxels;
    },

    // Rock/Boulder (Noise Blob)
    rock: (radius: number, mat: string, accentMat?: string) => {
        const voxels: VoxelData[] = [];
        for (let x = -radius; x <= radius; x++) {
            for (let y = 0; y <= radius * 1.5; y++) {
                for (let z = -radius; z <= radius; z++) {
                    const d = x * x + (y * 0.8) * (y * 0.8) + z * z;
                    if (d <= radius * radius) {
                        if (Math.random() > 0.1) {
                            const m = (accentMat && y === Math.floor(radius * 1.5) && Math.random() > 0.5) ? accentMat : mat;
                            addVoxel(voxels, x, y, z, m);
                        }
                    }
                }
            }
        }
        return voxels;
    },

    crystal: (height: number, mat: string) => {
        const voxels: VoxelData[] = [];
        // Main spike
        for (let y = 0; y < height; y++) {
            addVoxel(voxels, 0, y, 0, mat);
            if (y < height / 2) {
                addVoxel(voxels, 1, y, 0, mat);
                addVoxel(voxels, 0, y, 1, mat);
                addVoxel(voxels, 1, y, 1, mat);
            }
        }
        // Side spike
        addVoxel(voxels, -1, 0, 0, mat);
        addVoxel(voxels, -2, 1, 0, mat);
        return voxels;
    }
};

function finalize(voxels: VoxelData[], scale: number = 0.1) {
    const g = buildVoxelGroup(voxels, MAT_MAP);
    g.scale.set(scale, scale, scale);
    return g;
}

// --- EXPORTS ---

export const GrassTrees = {
    'TREE_OAK': () => finalize(Generators.basicTree(14, 5, 'wood', 'leaf')),
    'TREE_BIRCH': () => {
        const v: VoxelData[] = [];
        // Tall trunk
        for (let y = 0; y < 18; y++) addVoxel(v, 0, y, 0, 'birch');
        // Sparse leaves
        for (let y = 8; y < 19; y += 2) {
            for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
                if (Math.abs(x) + Math.abs(z) <= 2 && Math.random() > 0.4) {
                    addVoxel(v, x, y, z, 'birchLeaf');
                }
            }
        }
        return finalize(v, 0.08);
    },
    'TREE_WILLOW': () => {
        const v: VoxelData[] = [];
        // Wide Trunk
        for (let y = 0; y < 8; y++) {
            addVoxel(v, 0, y, 0, 'wood');
            if (y < 4) { addVoxel(v, 1, y, 0, 'wood'); addVoxel(v, 0, y, 1, 'wood'); }
        }
        // Drooping
        const crownY = 8;
        for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
            const d = Math.sqrt(x * x + z * z);
            if (d < 4) {
                addVoxel(v, x, crownY, z, 'willow');
                if (d > 2 && Math.random() > 0.3) {
                    const droop = Math.floor(Math.random() * 5) + 2;
                    for (let i = 1; i <= droop; i++) addVoxel(v, x, crownY - i, z, 'willow');
                }
            }
        }
        return finalize(v, 0.08);
    },
    'TREE_APPLE': () => finalize(Generators.basicTree(12, 4, 'wood', 'leaf', 'apple')),
    'BUSH_OAK': () => finalize(Generators.rock(3, 'leaf'), 0.08),
    'FLOWER_YELLOW': () => {
        const v: VoxelData[] = [];
        addVoxel(v, 0, 0, 0, 'leaf'); addVoxel(v, 0, 1, 0, 'leaf');
        addVoxel(v, 0, 2, 0, 'flowerYellow');
        addVoxel(v, 1, 2, 0, 'flowerYellow'); addVoxel(v, -1, 2, 0, 'flowerYellow');
        addVoxel(v, 0, 2, 1, 'flowerYellow'); addVoxel(v, 0, 2, -1, 'flowerYellow');
        return finalize(v, 0.1);
    }
};

export const SnowTrees = {
    'TREE_PINE': () => finalize(Generators.pineTree(16, 4, 'wood', 'pine')),
    'TREE_FROSTED_PINE': () => finalize(Generators.pineTree(16, 4, 'wood', 'pine', 'snow')),
    'TREE_TALL_PINE': () => finalize(Generators.pineTree(24, 3, 'wood', 'pine')),
    'SHRUB_WINTER': () => {
        const v: VoxelData[] = [];
        // Dead sticks
        addVoxel(v, 0, 0, 0, 'dead'); addVoxel(v, 0, 1, 0, 'dead');
        addVoxel(v, 1, 1, 0, 'dead'); addVoxel(v, -1, 1, 1, 'dead');
        addVoxel(v, 0, 2, 0, 'snow'); // Snow cap
        return finalize(v, 0.1);
    },
    'ROCK_ICY': () => finalize(Generators.rock(3, 'rock', 'glass'), 0.1)
};

export const SandTrees = {
    'CACTUS_SAGUARO': () => finalize(Generators.cactus(18, true, 'cactus'), 0.08),
    'CACTUS_BARREL': () => finalize(Generators.cactus(5, false, 'cactus'), 0.1),
    'TREE_PALM': () => finalize(Generators.palmTree(18, 'palmTrunk', 'palmLeaf'), 0.09),
    'SHRUB_DRY': () => {
        const v: VoxelData[] = [];
        for (let i = 0; i < 10; i++) addVoxel(v, (Math.random() - 0.5) * 4, (Math.random()) * 3, (Math.random() - 0.5) * 4, 'dead');
        return finalize(v, 0.1);
    },
    'ROCK_SANDSTONE': () => finalize(Generators.rock(4, 'sandstone'), 0.1)
};

export const DirtTrees = {
    'TREE_DEAD': () => {
        const v: VoxelData[] = [];
        for (let y = 0; y < 12; y++) {
            addVoxel(v, 0, y, 0, 'dead');
            if (y === 6) { addVoxel(v, 1, y + 1, 0, 'dead'); addVoxel(v, 2, y + 2, 0, 'dead'); }
            if (y === 8) { addVoxel(v, -1, y + 1, 0, 'dead'); }
        }
        return finalize(v, 0.09);
    },
    'TREE_STUMP': () => {
        const v: VoxelData[] = [];
        for (let y = 0; y < 3; y++) {
            addVoxel(v, 0, y, 0, 'dead'); addVoxel(v, 1, y, 0, 'dead'); addVoxel(v, 0, y, 1, 'dead');
        }
        return finalize(v, 0.1);
    },
    'BUSH_THORN': () => finalize(Generators.rock(2, 'dead', 'white'), 0.08), // Spikes
    'MUSHROOM_GIANT': () => {
        const v: VoxelData[] = [];
        for (let y = 0; y < 8; y++) {
            addVoxel(v, 0, y, 0, 'stem'); addVoxel(v, 1, y, 0, 'stem'); addVoxel(v, 0, y, 1, 'stem');
        }
        // Cap
        for (let x = -3; x <= 4; x++) for (let z = -3; z <= 4; z++) {
            if (Math.sqrt(x * x + z * z) < 3.5) {
                addVoxel(v, x, 8, z, 'cap');
                addVoxel(v, x, 9, z, 'cap');
            }
        }
        return finalize(v, 0.08);
    },
    'BONE_RIB': () => {
        const v: VoxelData[] = [];
        // Arc
        for (let i = 0; i < 10; i++) {
            addVoxel(v, i, Math.sin(i * 0.3) * 5, 0, 'bone');
            addVoxel(v, i, Math.sin(i * 0.3) * 5 + 1, 0, 'bone');
        }
        return finalize(v, 0.1);
    }
};

export const StoneTrees = {
    'ROCK_BOULDER': () => finalize(Generators.rock(5, 'rock'), 0.1),
    'ROCK_PEBBLE': () => finalize(Generators.rock(1, 'rock'), 0.1),
    'ROCK_MOSSY': () => finalize(Generators.rock(4, 'rock', 'moss'), 0.1),
    'FLOWER_ALPINE': () => {
        const v: VoxelData[] = [];
        addVoxel(v, 0, 0, 0, 'leaf'); addVoxel(v, 0, 1, 0, 'leaf');
        addVoxel(v, 0, 2, 0, 'flower');
        addVoxel(v, 1, 2, 0, 'flower'); addVoxel(v, -1, 2, 0, 'flower');
        addVoxel(v, 0, 2, 1, 'flower'); addVoxel(v, 0, 2, -1, 'flower');
        return finalize(v, 0.1);
    },
    'CRYSTAL_SPIKE': () => finalize(Generators.crystal(8, 'crystal'), 0.1)
};
