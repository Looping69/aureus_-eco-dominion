
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

const ROLE_COLOR = '#be123c';
const ARMOR_COLOR = '#1e293b';
const VISOR = '#38bdf8';
const BADGE = '#fbbf24';

function addArmor(torso: VoxelDef[]): VoxelDef[] {
    addVoxelBox(torso, -4, 4, 17, 27, 3, 4, ARMOR_COLOR);
    addVoxelBox(torso, -5, -4, 24, 29, 0, 3, ARMOR_COLOR);
    addVoxelBox(torso, 4, 5, 24, 29, 0, 3, ARMOR_COLOR);
    addVoxelBox(torso, -2, -1, 23, 25, 5, 5, BADGE);
    addVoxelBox(torso, 2, 4, 13, 23, 4, 4, '#0f172a');
    addVoxelBox(torso, 4, 5, 16, 22, 2, 4, '#64748b');
    return torso;
}

function addHelmet(head: VoxelDef[]): VoxelDef[] {
    addVoxelBox(head, -4, 4, 37, 40, -2, 3, ARMOR_COLOR);
    addVoxelBox(head, -5, 5, 36, 36, 2, 4, ARMOR_COLOR);
    addVoxelBox(head, -3, 3, 33, 34, 4, 4, VISOR);
    addVoxelBox(head, -4, -4, 31, 36, 0, 3, ARMOR_COLOR);
    addVoxelBox(head, 4, 4, 31, 36, 0, 3, ARMOR_COLOR);
    return head;
}

function armorArms(arm: VoxelDef[], side: 'left' | 'right'): VoxelDef[] {
    const shieldX = side === 'left' ? -7 : 7;
    const armored = arm.map(v => v.y >= 17 ? { ...v, c: ARMOR_COLOR } : v);
    addVoxelBox(armored, shieldX, shieldX, 15, 25, 0, 4, '#334155');
    addVoxelBox(armored, shieldX, shieldX, 21, 22, 5, 5, BADGE);
    return armored;
}

export function SecurityFactory(): THREE.Group {
    const { legL, legR } = createLegs('#111827');
    const arms = createArms(SKIN_COLOR);
    let torso = createTorso(ROLE_COLOR, BADGE);
    torso = addArmor(torso);
    const head = addHelmet(createHead(SKIN_COLOR, '#111827'));

    return assembleAgent({ head, torso, armL: armorArms(arms.armL, 'left'), armR: armorArms(arms.armR, 'right'), legL, legR });
}
