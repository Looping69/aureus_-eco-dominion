
import * as THREE from 'three';
import {
    SKIN_COLOR,
    CLOTH_COLOR,
    VoxelDef,
    addVoxelBox,
    createLegs,
    createArms,
    createTorso,
    assembleAgent
} from '../common';

const ROLE_COLOR = '#111827';
const HOOD_COLOR = '#020617';
const MASK_COLOR = '#334155';
const ORE_COLOR = '#f59e0b';
const DUST_COLOR = '#57534e';

function createHoodedHead(skinColor: string = SKIN_COLOR): VoxelDef[] {
    const head: VoxelDef[] = [];

    const startY = 28;
    const endY = 40;

    for (let y = startY; y < endY; y++) {
        for (let x = -3; x <= 3; x++) {
            for (let z = -2; z <= 3; z++) {
                // Rounding
                if (x === -3 && z === -2) continue;
                if (x === 3 && z === -2) continue;
                if (x === -3 && z === 3) continue;
                if (x === 3 && z === 3) continue;

                // Chin taper
                if (y === startY && (Math.abs(x) === 3 || z === 3 || z === -2)) continue;

                let c = skinColor;

                // Eyes
                if (y === 33 && (x === -1 || x === 1) && z === 3) c = '#fef3c7';

                // Hood Logic (Covers hair area + more)
                if (y >= 36) c = HOOD_COLOR;
                if (y >= 30 && (z <= -1 || Math.abs(x) === 3)) c = HOOD_COLOR;
                if (z === 3 && y >= 29 && y <= 31 && Math.abs(x) <= 2) c = MASK_COLOR;

                head.push({ x, y, z, c });
            }
        }
    }

    addVoxelBox(head, -4, 4, 37, 40, -2, 3, HOOD_COLOR);
    addVoxelBox(head, -5, 5, 36, 36, 1, 4, HOOD_COLOR);
    return head;
}

function addContrabandPack(torso: VoxelDef[]): VoxelDef[] {
    addVoxelBox(torso, -5, 3, 15, 25, -4, -2, '#3f2a14');
    addVoxelBox(torso, -4, -1, 23, 26, -5, -4, ORE_COLOR);
    addVoxelBox(torso, -3, 3, 18, 19, 4, 4, '#0f172a');
    addVoxelBox(torso, 4, 5, 14, 21, 2, 4, '#27272a');
    return torso;
}

function addDarkHarness(torso: VoxelDef[]): VoxelDef[] {
    for (let i = 0; i <= 8; i++) {
        torso.push({ x: -4 + i, y: 26 - i, z: 4, c: '#020617' });
    }
    addVoxelBox(torso, -4, 4, 13, 14, 3, 4, '#020617');
    addVoxelBox(torso, -1, 1, 22, 23, 4, 4, ORE_COLOR);
    return torso;
}

function dustyLegs(legs: { legL: VoxelDef[]; legR: VoxelDef[] }): { legL: VoxelDef[]; legR: VoxelDef[] } {
    const dust = (leg: VoxelDef[]) => leg.map(v => v.y <= 6 || v.z === 2 ? { ...v, c: DUST_COLOR } : v);
    return { legL: dust(legs.legL), legR: dust(legs.legR) };
}

function darkSleeves(arm: VoxelDef[]): VoxelDef[] {
    return arm.map(v => v.y >= 17 ? { ...v, c: HOOD_COLOR } : v);
}

export function IllegalMinerFactory(): THREE.Group {
    const { legL, legR } = dustyLegs(createLegs(CLOTH_COLOR));
    const arms = createArms(SKIN_COLOR);
    let torso = createTorso(ROLE_COLOR, '#7f1d1d');
    torso = addDarkHarness(addContrabandPack(torso));
    const head = createHoodedHead();

    return assembleAgent({ head, torso, armL: darkSleeves(arms.armL), armR: darkSleeves(arms.armR), legL, legR });
}
