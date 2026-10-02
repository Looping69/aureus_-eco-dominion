
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

const ROLE_COLOR = '#2563eb';
const TOOL_BELT_COLOR = '#78350f';
const METAL_COLOR = '#cbd5e1';
const CABLE_COLOR = '#f97316';
const TECH_WHITE = '#e0f2fe';

function addToolBelt(torso: VoxelDef[]): VoxelDef[] {
    addVoxelBox(torso, -4, 4, 14, 15, 3, 4, TOOL_BELT_COLOR);
    addVoxelBox(torso, -5, -4, 13, 21, 2, 4, METAL_COLOR);
    addVoxelBox(torso, 4, 5, 13, 20, 2, 4, '#facc15');
    addVoxelBox(torso, -2, 2, 25, 26, 4, 4, TECH_WHITE);
    return torso;
}

function addBatteryPack(torso: VoxelDef[]): VoxelDef[] {
    addVoxelBox(torso, -3, 3, 17, 26, -4, -2, '#0f172a');
    addVoxelBox(torso, -2, 2, 19, 20, -5, -5, '#38bdf8');
    for (let i = 0; i <= 8; i++) {
        torso.push({ x: -4 + i, y: 25 - i, z: -5, c: CABLE_COLOR });
    }
    return torso;
}

function addEngineerHelmet(head: VoxelDef[]): VoxelDef[] {
    addVoxelBox(head, -4, 4, 38, 40, -2, 3, '#f8fafc');
    addVoxelBox(head, -5, 5, 37, 37, 2, 4, '#f8fafc');
    addVoxelBox(head, -2, 2, 34, 34, 4, 4, '#38bdf8');
    addVoxelBox(head, -3, -2, 33, 33, 4, 4, '#0f172a');
    addVoxelBox(head, 2, 3, 33, 33, 4, 4, '#0f172a');
    return head;
}

function tintSleeves(arm: VoxelDef[]): VoxelDef[] {
    return arm.map(v => v.y >= 17 ? { ...v, c: '#1d4ed8' } : v);
}

export function EngineerFactory(): THREE.Group {
    const { legL, legR } = createLegs(CLOTH_COLOR);
    const arms = createArms(SKIN_COLOR);
    let torso = createTorso(ROLE_COLOR, TECH_WHITE);
    torso = addBatteryPack(addToolBelt(torso));
    const head = addEngineerHelmet(createHead(SKIN_COLOR, '#111827'));

    return assembleAgent({ head, torso, armL: tintSleeves(arms.armL), armR: tintSleeves(arms.armR), legL, legR });
}
