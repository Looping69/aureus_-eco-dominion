
import * as THREE from 'three';
import {
    SKIN_COLOR,
    CLOTH_COLOR,
    VoxelDef,
    addVoxelBox,
    createLegs,
    createArms,
    createTorso,
    createHead,
    assembleAgent
} from '../common';

const ROLE_COLOR = '#b91c1c';
const BACKPACK_COLOR = '#451a03';
const HELMET_COLOR = '#facc15';
const LAMP_COLOR = '#fef3c7';
const DUST_COLOR = '#a8a29e';
const METAL_COLOR = '#cbd5e1';

function addBackpack(torso: VoxelDef[]): VoxelDef[] {
    addVoxelBox(torso, -4, 4, 16, 24, -3, -1, BACKPACK_COLOR);
    addVoxelBox(torso, -2, 2, 24, 26, -4, -2, '#78350f');
    addVoxelBox(torso, -1, 1, 17, 26, -5, -5, '#111827');
    return torso;
}

function addHarness(torso: VoxelDef[]): VoxelDef[] {
    for (let i = 0; i <= 8; i++) {
        torso.push({ x: -4 + i, y: 26 - i, z: 4, c: '#111827' });
        torso.push({ x: 4 - i, y: 26 - i, z: 4, c: '#111827' });
    }
    addVoxelBox(torso, -4, 4, 14, 15, 4, 4, '#0b1116');
    addVoxelBox(torso, -5, -5, 15, 21, 2, 4, METAL_COLOR);
    addVoxelBox(torso, 5, 5, 15, 21, 2, 4, METAL_COLOR);
    return torso;
}

function addHelmet(head: VoxelDef[]): VoxelDef[] {
    addVoxelBox(head, -4, 4, 38, 40, -2, 3, HELMET_COLOR);
    addVoxelBox(head, -5, 5, 37, 37, 2, 4, HELMET_COLOR);
    addVoxelBox(head, -1, 1, 36, 37, 4, 4, LAMP_COLOR);
    addVoxelBox(head, -2, 2, 32, 32, 4, 4, '#0f172a');
    return head;
}

function dustBoots(legs: { legL: VoxelDef[]; legR: VoxelDef[] }): { legL: VoxelDef[]; legR: VoxelDef[] } {
    const dust = (leg: VoxelDef[]) => leg.map(v => v.y <= 5 && v.z >= 1 ? { ...v, c: DUST_COLOR } : v);
    return { legL: dust(legs.legL), legR: dust(legs.legR) };
}

export function MinerFactory(): THREE.Group {
    const { legL, legR } = dustBoots(createLegs(CLOTH_COLOR));
    const { armL, armR } = createArms(SKIN_COLOR);
    let torso = createTorso(ROLE_COLOR, '#fef3c7');
    torso = addHarness(addBackpack(torso));
    const head = addHelmet(createHead(SKIN_COLOR, '#3f2a14'));

    return assembleAgent({ head, torso, armL, armR, legL, legR });
}
