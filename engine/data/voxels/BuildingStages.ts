import * as THREE from 'three';
import { BuildingType } from '../../../types';
import { mats } from '../../render/materials/VoxelMaterials';
import { voxel, FactoryOptions } from '../../render/utils/VoxelBuilder';

function primitiveResidential(level: number) {
    const g = new THREE.Group();
    g.add(voxel(2.0, 0.12, 2.0, mats.concrete, 0, 0, 0));

    if (level === 1) {
        g.add(voxel(0.8, 0.5, 0.8, mats.sand, -0.45, 0.12, 0));
        g.add(voxel(0.7, 0.45, 0.7, mats.leafDark, 0.45, 0.12, 0));
        g.add(voxel(0.25, 0.15, 0.6, mats.wood, 0, 0.12, 0.75));
        return g;
    }

    if (level === 2) {
        g.add(voxel(0.9, 0.7, 1.3, mats.blueMetal, -0.45, 0.12, 0));
        g.add(voxel(0.9, 0.7, 1.1, mats.hazard, 0.45, 0.12, 0.1));
        g.add(voxel(0.2, 0.12, 0.2, mats.emissiveCyan, 0.7, 0.85, -0.2));
        return g;
    }

    g.add(voxel(1.6, 1.8, 1.4, mats.brick, 0, 0.12, 0));
    g.add(voxel(1.7, 0.08, 1.5, mats.concrete, 0, 1.0, 0));
    g.add(voxel(0.5, 0.4, 0.08, mats.glass, 0, 0.6, 0.71));
    return g;
}

function primitiveCanteen(level: number) {
    const g = new THREE.Group();
    g.add(voxel(1.9, 0.1, 1.9, mats.concrete, 0, 0, 0));

    if (level === 1) {
        g.add(voxel(0.45, 0.12, 0.45, mats.concrete, -0.4, 0.1, -0.3));
        g.add(voxel(0.2, 0.15, 0.2, mats.emissiveOrange, -0.4, 0.25, -0.3));
        g.add(voxel(0.8, 0.04, 1.2, mats.sand, 0.35, 1.0, 0));
        g.add(voxel(0.6, 0.15, 0.2, mats.wood, 0.35, 0.1, 0.35));
        return g;
    }

    if (level === 2) {
        g.add(voxel(1.8, 0.06, 1.8, mats.sand, 0, 1.35, 0));
        g.add(voxel(0.1, 1.5, 0.1, mats.metal, -0.8, 0.1, -0.8));
        g.add(voxel(0.1, 1.5, 0.1, mats.metal, 0.8, 0.1, -0.8));
        g.add(voxel(0.1, 1.5, 0.1, mats.metal, -0.8, 0.1, 0.8));
        g.add(voxel(0.1, 1.5, 0.1, mats.metal, 0.8, 0.1, 0.8));
        g.add(voxel(1.2, 0.5, 0.35, mats.metal, 0, 0.1, -0.6));
        return g;
    }

    g.add(voxel(1.6, 1.4, 1.4, mats.brick, 0, 0.1, 0));
    g.add(voxel(1.7, 0.08, 1.5, mats.metal, 0, 1.55, 0));
    g.add(voxel(0.7, 0.5, 0.08, mats.glass, 0, 0.65, 0.71));
    return g;
}

function primitiveSocial(level: number) {
    const g = new THREE.Group();
    g.add(voxel(2.0, 0.12, 2.0, mats.concrete, 0, 0, 0));

    if (level === 1) {
        g.add(voxel(0.4, 0.12, 0.4, mats.concrete, 0, 0.1, 0));
        g.add(voxel(0.2, 0.18, 0.2, mats.emissiveOrange, 0, 0.25, 0));
        g.add(voxel(0.5, 0.12, 0.18, mats.wood, 0.65, 0.1, 0));
        g.add(voxel(0.5, 0.12, 0.18, mats.wood, -0.65, 0.1, 0));
        return g;
    }

    if (level === 2) {
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(1.0, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
            mats.glass
        );
        dome.position.y = 0.15;
        g.add(dome);
        g.add(voxel(0.3, 1.2, 0.3, mats.metal, 0, 0.15, 0));
        return g;
    }

    const domeA = new THREE.Mesh(
        new THREE.SphereGeometry(0.75, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        mats.glass
    );
    domeA.position.set(-0.45, 0.15, -0.2);
    const domeB = domeA.clone();
    domeB.position.set(0.45, 0.15, 0.2);
    g.add(domeA, domeB);
    g.add(voxel(1.1, 0.4, 0.5, mats.metal, 0, 0.15, 0));
    return g;
}

function primitiveSecurity(level: number) {
    const g = new THREE.Group();
    g.add(voxel(1.0, 0.15, 1.0, mats.concrete, 0, 0, 0));

    if (level === 1) {
        g.add(voxel(0.7, 0.8, 0.7, mats.wood, 0, 0.15, 0));
        g.add(voxel(0.2, 0.2, 0.2, mats.emissiveOrange, 0, 1.0, 0));
        return g;
    }

    if (level === 2) {
        g.add(voxel(0.35, 3.0, 0.35, mats.metal, 0, 0.15, 0));
        g.add(voxel(1.0, 0.12, 1.0, mats.concrete, 0, 3.1, 0));
        g.add(voxel(0.8, 0.7, 0.8, mats.glass, 0, 3.22, 0));
        return g;
    }

    g.add(voxel(0.5, 3.8, 0.5, mats.concrete, 0, 0.15, 0));
    g.add(voxel(1.1, 0.18, 1.1, mats.metal, 0, 4.0, 0));
    g.add(voxel(0.8, 0.8, 0.8, mats.glass, 0, 4.15, 0));
    g.add(voxel(0.12, 0.12, 0.12, mats.emissiveCyan, 0.35, 5.0, 0.35));
    return g;
}

function primitiveIndustrial(level: number) {
    const g = new THREE.Group();
    g.add(voxel(2.0, 0.2, 2.0, mats.concrete, 0, 0, 0));

    if (level === 1) {
        g.add(voxel(0.8, 0.8, 0.8, mats.metal, -0.3, 0.2, 0));
        g.add(voxel(0.3, 0.4, 1.2, mats.darkPipe, 0.5, 0.2, 0));
        g.add(voxel(0.15, 1.2, 0.15, mats.metal, -0.7, 0.2, 0.7));
        return g;
    }

    if (level === 2) {
        g.add(voxel(1.1, 1.4, 1.1, mats.blueMetal, -0.25, 0.2, -0.25));
        g.add(voxel(0.7, 1.2, 0.7, mats.metal, 0.55, 0.2, 0.55));
        g.add(voxel(0.2, 2.2, 0.2, mats.metal, -0.75, 0.2, 0.75));
        return g;
    }

    g.add(voxel(1.4, 2.0, 1.2, mats.metal, -0.2, 0.2, -0.2));
    g.add(voxel(0.8, 1.6, 0.8, mats.blueMetal, 0.55, 0.2, 0.55));
    g.add(voxel(0.3, 3.0, 0.3, mats.metal, -0.75, 0.2, 0.75));
    g.add(voxel(0.4, 0.15, 0.1, mats.emissiveCyan, 0.55, 1.0, -0.1));
    return g;
}

function primitiveSolar(level: number) {
    const g = new THREE.Group();

    if (level === 1) {
        g.add(voxel(1.1, 0.1, 0.9, mats.solar, 0, 0.55, 0));
        g.add(voxel(0.1, 0.5, 0.1, mats.metal, -0.35, 0.05, 0));
        g.add(voxel(0.1, 0.5, 0.1, mats.metal, 0.35, 0.05, 0));
        return g;
    }

    if (level === 2) {
        g.add(voxel(1.8, 0.12, 1.2, mats.solar, 0, 0.8, 0));
        g.add(voxel(0.1, 0.8, 0.1, mats.metal, -0.6, 0.1, 0));
        g.add(voxel(0.1, 0.8, 0.1, mats.metal, 0, 0.1, 0));
        g.add(voxel(0.1, 0.8, 0.1, mats.metal, 0.6, 0.1, 0));
        return g;
    }

    g.add(voxel(0.5, 1.8, 0.5, mats.metal, 0, 0.1, 0));
    g.add(voxel(1.8, 0.12, 1.2, mats.solar, 0, 2.0, 0));
    g.add(voxel(0.2, 0.2, 0.2, mats.emissiveGreen, 0.8, 0.3, 0));
    return g;
}

function primitiveGarden(level: number) {
    const g = new THREE.Group();
    g.add(voxel(2.0, 0.1, 2.0, mats.dirt, 0, 0, 0));

    if (level === 1) {
        g.add(voxel(0.55, 0.18, 0.55, mats.wood, -0.5, 0.1, -0.5));
        g.add(voxel(0.5, 0.3, 0.5, mats.leaf, -0.5, 0.28, -0.5));
        g.add(voxel(0.55, 0.18, 0.55, mats.wood, 0.5, 0.1, 0.5));
        g.add(voxel(0.5, 0.3, 0.5, mats.progressGreen, 0.5, 0.28, 0.5));
        return g;
    }

    if (level === 2) {
        g.add(voxel(0.7, 0.2, 0.7, mats.wood, -0.55, 0.1, -0.55));
        g.add(voxel(0.7, 0.2, 0.7, mats.wood, 0.55, 0.1, -0.55));
        g.add(voxel(0.7, 0.2, 0.7, mats.wood, -0.55, 0.1, 0.55));
        g.add(voxel(0.7, 0.2, 0.7, mats.wood, 0.55, 0.1, 0.55));
        g.add(voxel(0.5, 0.45, 0.5, mats.leaf, -0.55, 0.3, -0.55));
        g.add(voxel(0.5, 0.45, 0.5, mats.progressGreen, 0.55, 0.3, 0.55));
        return g;
    }

    g.add(voxel(1.9, 0.08, 0.25, mats.concrete, 0, 0.12, 0));
    g.add(voxel(0.25, 0.08, 1.9, mats.concrete, 0, 0.12, 0));
    g.add(voxel(0.8, 0.2, 0.8, mats.concrete, -0.55, 0.1, -0.55));
    g.add(voxel(0.7, 0.55, 0.7, mats.leaf, -0.55, 0.3, -0.55));
    g.add(voxel(0.15, 0.8, 0.15, mats.wood, 0.55, 0.3, 0.55));
    g.add(voxel(0.45, 0.4, 0.45, mats.leaf, 0.55, 0.95, 0.55));
    return g;
}

function primitiveWater(level: number) {
    const g = new THREE.Group();
    g.add(voxel(1.0, 0.15, 1.0, mats.concrete, 0, 0, 0));

    if (level === 1) {
        g.add(voxel(0.2, 1.0, 0.2, mats.wood, 0, 0.15, 0));
        g.add(voxel(0.5, 0.08, 0.1, mats.wood, 0, 1.0, 0));
        g.add(voxel(0.18, 0.18, 0.18, mats.blueMetal, 0.2, 0.6, 0));
        return g;
    }

    if (level === 2) {
        g.add(voxel(0.25, 1.5, 0.25, mats.metal, 0, 0.15, 0));
        g.add(voxel(0.8, 0.08, 0.1, mats.metal, 0, 1.55, 0));
        g.add(voxel(0.1, 0.5, 0.1, mats.blueMetal, 0.35, 1.0, 0));
        return g;
    }

    g.add(voxel(0.8, 1.4, 0.8, mats.concrete, 0, 0.15, 0));
    g.add(voxel(0.5, 0.5, 0.5, mats.blueMetal, 0, 1.55, 0));
    g.add(voxel(0.18, 0.18, 0.18, mats.emissiveCyan, 0.45, 0.55, 0));
    return g;
}

function primitiveWind(level: number) {
    const g = new THREE.Group();
    g.add(voxel(1.0, 0.2, 1.0, mats.concrete, 0, 0, 0));

    if (level === 1) {
        g.add(voxel(0.25, 2.0, 0.25, mats.wood, 0, 0.2, 0));
        g.add(voxel(1.2, 0.08, 0.08, mats.wood, 0, 1.7, 0));
        g.add(voxel(0.08, 1.2, 0.08, mats.wood, 0, 1.7, 0));
        return g;
    }

    if (level === 2) {
        g.add(voxel(0.35, 3.4, 0.35, mats.white, 0, 0.2, 0));
        g.add(voxel(0.25, 0.25, 0.25, mats.metal, 0, 3.7, 0.45));
        g.add(voxel(0.18, 1.2, 0.05, mats.white, 0, 4.6, 0.45));
        g.add(voxel(0.18, 1.2, 0.05, mats.white, 0, 2.8, 0.45));
        return g;
    }

    g.add(voxel(0.4, 5.0, 0.4, mats.white, 0, 0.2, 0));
    g.add(voxel(0.3, 0.3, 0.3, mats.metal, 0, 5.35, 0.55));
    g.add(voxel(0.2, 1.6, 0.05, mats.white, 0, 6.6, 0.55));
    g.add(voxel(0.2, 1.6, 0.05, mats.white, 0, 4.0, 0.55));
    return g;
}

export function createStagedBuilding(type: BuildingType | 'ILLEGAL_CAMP', opts?: FactoryOptions): THREE.Group | null {
    if (type === 'ILLEGAL_CAMP') {
        return null;
    }

    const level = opts?.level || 1;
    if (level >= 4) {
        return null;
    }

    switch (type) {
        case BuildingType.STAFF_QUARTERS:
            return primitiveResidential(level);
        case BuildingType.CANTEEN:
            return primitiveCanteen(level);
        case BuildingType.SOCIAL_HUB:
            return primitiveSocial(level);
        case BuildingType.SECURITY_POST:
            return primitiveSecurity(level);
        case BuildingType.WASH_PLANT:
            return primitiveIndustrial(level);
        case BuildingType.SOLAR_ARRAY:
            return primitiveSolar(level);
        case BuildingType.COMMUNITY_GARDEN:
            return primitiveGarden(level);
        case BuildingType.WATER_WELL:
            return primitiveWater(level);
        case BuildingType.WIND_TURBINE:
            return primitiveWind(level);
        default:
            return null;
    }
}
