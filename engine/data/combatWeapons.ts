import type { AgentRole } from '../../types';

export interface CombatWeaponDef {
    id: string;
    label: string;
    description: string;
    attackBonus: number;
    rangeBonus: number;
    scanRangeBonus: number;
    cooldownMultiplier: number;
}

export const COMBAT_WEAPONS: Record<string, CombatWeaponDef> = {
    FIELD_TOOLS: {
        id: 'FIELD_TOOLS',
        label: 'Field Tools',
        description: 'Improvised picks, shovels, and utility tools used for desperate close combat.',
        attackBonus: 1,
        rangeBonus: 0,
        scanRangeBonus: 0,
        cooldownMultiplier: 1,
    },
    MINING_PICK: {
        id: 'MINING_PICK',
        label: 'Mining Pick',
        description: 'Heavy extraction tool with enough reach and force to discourage intruders.',
        attackBonus: 3,
        rangeBonus: 0.1,
        scanRangeBonus: 0,
        cooldownMultiplier: 0.95,
    },
    MACHETE: {
        id: 'MACHETE',
        label: 'Machete',
        description: 'Brush-clearing blade carried by ecology and lumber teams.',
        attackBonus: 2,
        rangeBonus: 0.1,
        scanRangeBonus: 0,
        cooldownMultiplier: 0.95,
    },
    SHOCK_BATON: {
        id: 'SHOCK_BATON',
        label: 'Shock Baton',
        description: 'Security-issued close-range deterrent tuned for fast takedowns.',
        attackBonus: 8,
        rangeBonus: 0.25,
        scanRangeBonus: 2,
        cooldownMultiplier: 0.8,
    },
    BOLT_PISTOL: {
        id: 'BOLT_PISTOL',
        label: 'Bolt Pistol',
        description: 'Illegal miner sidearm with short range and dangerous burst damage.',
        attackBonus: 4,
        rangeBonus: 1.25,
        scanRangeBonus: 1,
        cooldownMultiplier: 1.05,
    },
    UNARMED: {
        id: 'UNARMED',
        label: 'Unarmed',
        description: 'No dedicated weaponry beyond fists and panic.',
        attackBonus: 0,
        rangeBonus: 0,
        scanRangeBonus: 0,
        cooldownMultiplier: 1,
    },
};

export const ROLE_WEAPON_LOADOUTS: Record<AgentRole, string> = {
    WORKER: 'FIELD_TOOLS',
    MINER: 'MINING_PICK',
    BOTANIST: 'MACHETE',
    ENGINEER: 'FIELD_TOOLS',
    SECURITY: 'SHOCK_BATON',
    ILLEGAL_MINER: 'BOLT_PISTOL',
    LUMBERJACK: 'MACHETE',
    QUARRYMAN: 'MINING_PICK',
    UNEMPLOYED: 'UNARMED',
    CITIZEN: 'UNARMED',
};

export function getCombatWeaponForRole(role: AgentRole): CombatWeaponDef {
    return COMBAT_WEAPONS[ROLE_WEAPON_LOADOUTS[role]] ?? COMBAT_WEAPONS.UNARMED;
}
