
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

const ROLE_COLOR = '#16a34a';
const SATCHEL_COLOR = '#65a30d';
const CANVAS = '#a3e635';
const SOIL = '#3f2a14';
const FLOWER = '#fbbf24';

function addSatchel(torso: VoxelDef[]): VoxelDef[] {
    for (let i = 0; i <= 8; i++) {
        torso.push({ x: -4 + i, y: 26 - i, z: 4, c: SATCHEL_COLOR });
    }
    addVoxelBox(torso, 3, 5, 15, 23, 1, 3, SATCHEL_COLOR);
    addVoxelBox(torso, 3, 5, 21, 22, 4, 4, '#fef9c3');
    addVoxelBox(torso, -4, -3, 16, 24, -3, -1, '#166534');
    return torso;
}

function addPlantTools(torso: VoxelDef[]): VoxelDef[] {
    addVoxelBox(torso, -5, -5, 15, 24, 2, 4, '#94a3b8');
    addVoxelBox(torso, -5, -4, 22, 24, 4, 4, '#22c55e');
    addVoxelBox(torso, -1, 1, 24, 25, 4, 4, FLOWER);
    addVoxelBox(torso, 0, 0, 22, 23, 4, 4, '#22c55e');
    return torso;
}

function addFieldHat(head: VoxelDef[]): VoxelDef[] {
    addVoxelBox(head, -4, 4, 38, 39, -2, 3, CANVAS);
    addVoxelBox(head, -6, 6, 37, 37, -3, 4, CANVAS);
    addVoxelBox(head, -2, 2, 40, 41, -1, 2, CANVAS);
    addVoxelBox(head, -1, 1, 36, 36, 4, 4, '#fef9c3');
    return head;
}

function tintSleeves(arm: VoxelDef[]): VoxelDef[] {
    return arm.map(v => v.y >= 17 ? { ...v, c: '#15803d' } : v);
}

function mudLegs(legs: { legL: VoxelDef[]; legR: VoxelDef[] }): { legL: VoxelDef[]; legR: VoxelDef[] } {
    const mud = (leg: VoxelDef[]) => leg.map(v => v.y <= 4 && v.z >= 1 ? { ...v, c: SOIL } : v);
    return { legL: mud(legs.legL), legR: mud(legs.legR) };
}

export function BotanistFactory(): THREE.Group {
    const { legL, legR } = mudLegs(createLegs(CLOTH_COLOR));
    const arms = createArms(SKIN_COLOR);
    let torso = createTorso(ROLE_COLOR, '#dcfce7');
    torso = addPlantTools(addSatchel(torso));
    const head = addFieldHat(createHead(SKIN_COLOR, '#854d0e'));

    return assembleAgent({ head, torso, armL: tintSleeves(arms.armL), armR: tintSleeves(arms.armR), legL, legR });
}
