
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

const WORKER_ORANGE = '#f59e0b';
const LUMBER_GREEN = '#166534';
const QUARRY_GREY = '#64748b';
const CITIZEN_BLUE = '#0ea5e9';
const UNEMPLOYED_MUTED = '#7c3aed';
const LEATHER = '#78350f';
const STEEL = '#cbd5e1';
const SAFETY_YELLOW = '#facc15';

function addHardHat(head: VoxelDef[], color: string, lamp = false): VoxelDef[] {
    addVoxelBox(head, -4, 4, 38, 40, -2, 3, color);
    addVoxelBox(head, -5, 5, 37, 37, 2, 4, color);
    if (lamp) {
        addVoxelBox(head, -1, 1, 36, 37, 4, 4, '#fef3c7');
    }
    return head;
}

function addCap(head: VoxelDef[], color: string): VoxelDef[] {
    addVoxelBox(head, -4, 4, 37, 39, -2, 3, color);
    addVoxelBox(head, -2, 2, 36, 36, 3, 5, color);
    return head;
}

function addBeanie(head: VoxelDef[], color: string): VoxelDef[] {
    addVoxelBox(head, -4, 4, 37, 40, -2, 3, color);
    addVoxelBox(head, -2, 2, 40, 41, -1, 2, '#c4b5fd');
    return head;
}

function addReflectiveVest(torso: VoxelDef[]): VoxelDef[] {
    addVoxelBox(torso, -3, -2, 16, 26, 4, 4, SAFETY_YELLOW);
    addVoxelBox(torso, 2, 3, 16, 26, 4, 4, SAFETY_YELLOW);
    addVoxelBox(torso, -3, 3, 22, 23, 4, 4, '#fef08a');
    addVoxelBox(torso, -4, 4, 14, 15, 3, 4, '#111827');
    return torso;
}

function addToolRoll(torso: VoxelDef[], side: 'left' | 'right'): VoxelDef[] {
    const x = side === 'left' ? -5 : 5;
    addVoxelBox(torso, x, x, 14, 20, 1, 3, LEATHER);
    addVoxelBox(torso, x, x, 18, 22, 4, 4, STEEL);
    addVoxelBox(torso, x, x, 14, 15, 4, 4, '#fbbf24');
    return torso;
}

function addAxeBack(torso: VoxelDef[]): VoxelDef[] {
    addVoxelBox(torso, -1, 1, 15, 27, -3, -3, LEATHER);
    addVoxelBox(torso, -3, 3, 25, 27, -4, -3, STEEL);
    return torso;
}

function addSledgeBack(torso: VoxelDef[]): VoxelDef[] {
    addVoxelBox(torso, 2, 3, 15, 28, -3, -3, '#3f2a14');
    addVoxelBox(torso, -2, 4, 27, 29, -4, -3, '#94a3b8');
    return torso;
}

function addMessengerBag(torso: VoxelDef[], bagColor: string): VoxelDef[] {
    for (let i = 0; i <= 7; i++) {
        torso.push({ x: -4 + i, y: 25 - i, z: 4, c: bagColor });
    }
    addVoxelBox(torso, 3, 5, 15, 21, 1, 3, bagColor);
    addVoxelBox(torso, 3, 5, 19, 20, 4, 4, '#f8fafc');
    return torso;
}

function tintArms(arms: { armL: VoxelDef[]; armR: VoxelDef[] }, sleeveColor: string): { armL: VoxelDef[]; armR: VoxelDef[] } {
    const tint = (arm: VoxelDef[]) => arm.map(v => v.y >= 17 ? { ...v, c: sleeveColor } : v);
    return { armL: tint(arms.armL), armR: tint(arms.armR) };
}

export function WorkerFactory(): THREE.Group {
    const { legL, legR } = createLegs('#334155');
    const arms = tintArms(createArms(SKIN_COLOR), WORKER_ORANGE);
    let torso = createTorso(WORKER_ORANGE, '#fef3c7');
    torso = addReflectiveVest(torso);
    torso = addToolRoll(torso, 'right');
    const head = addHardHat(createHead(SKIN_COLOR, '#3f2a14'), SAFETY_YELLOW);

    return assembleAgent({ head, torso, armL: arms.armL, armR: arms.armR, legL, legR });
}

export function LumberjackFactory(): THREE.Group {
    const { legL, legR } = createLegs('#4b2e16');
    const arms = tintArms(createArms(SKIN_COLOR), LUMBER_GREEN);
    let torso = createTorso(LUMBER_GREEN, '#dc2626');
    torso = addAxeBack(addMessengerBag(torso, LEATHER));
    const head = addCap(createHead(SKIN_COLOR, '#5b3417'), '#991b1b');

    return assembleAgent({ head, torso, armL: arms.armL, armR: arms.armR, legL, legR });
}

export function QuarrymanFactory(): THREE.Group {
    const { legL, legR } = createLegs('#475569');
    const arms = tintArms(createArms(SKIN_COLOR), QUARRY_GREY);
    let torso = createTorso(QUARRY_GREY, '#e2e8f0');
    torso = addSledgeBack(addToolRoll(torso, 'left'));
    addVoxelBox(torso, -3, 3, 18, 20, 4, 4, '#94a3b8');
    const head = addHardHat(createHead(SKIN_COLOR, '#111827'), '#e5e7eb');

    return assembleAgent({ head, torso, armL: arms.armL, armR: arms.armR, legL, legR });
}

export function CitizenFactory(): THREE.Group {
    const { legL, legR } = createLegs('#1d4ed8');
    const arms = tintArms(createArms(SKIN_COLOR), CITIZEN_BLUE);
    let torso = createTorso(CITIZEN_BLUE, '#f8fafc');
    torso = addMessengerBag(torso, '#0f766e');
    const head = createHead(SKIN_COLOR, '#854d0e');

    return assembleAgent({ head, torso, armL: arms.armL, armR: arms.armR, legL, legR });
}

export function UnemployedFactory(): THREE.Group {
    const { legL, legR } = createLegs('#111827');
    const arms = tintArms(createArms(SKIN_COLOR), UNEMPLOYED_MUTED);
    let torso = createTorso(UNEMPLOYED_MUTED, '#ddd6fe');
    torso = addMessengerBag(torso, '#312e81');
    const head = addBeanie(createHead(SKIN_COLOR, '#1f2937'), '#6d28d9');

    return assembleAgent({ head, torso, armL: arms.armL, armR: arms.armR, legL, legR });
}
