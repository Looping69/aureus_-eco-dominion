import { AgentRole, BuildingType, CombatFaction, ColonistStats } from '../../types';

export interface AgentRoleCombatDef {
    faction: CombatFaction;
    maxHealth: number;
    attack: number;
    defense: number;
    range: number;
    cooldownSeconds: number;
}

export interface AgentRoleDef {
    id: AgentRole;
    label: string;
    description: string;
    workplaces: BuildingType[];
    baseSkills: ColonistStats;
    combat: AgentRoleCombatDef;
}

type RawAgentRoleDef = Omit<AgentRoleDef, 'workplaces'> & {
    workplaces: string[];
};

export const RAW_AGENT_ROLE_SCHEMA: Record<AgentRole, RawAgentRoleDef> = {
    WORKER: {
        id: 'WORKER',
        label: 'Worker',
        description: 'General colony labor for building, hauling, and early settlement work.',
        workplaces: [],
        baseSkills: { mining: 1, construction: 1, plants: 1, intelligence: 1 },
        combat: { faction: 'COLONY', maxHealth: 100, attack: 4, defense: 1, range: 1.1, cooldownSeconds: 1.8 },
    },
    MINER: {
        id: 'MINER',
        label: 'Miner',
        description: 'Industrial extraction specialist for ore and wash-plant operations.',
        workplaces: ['WASH_PLANT', 'MINING_HEADFRAME', 'ORE_FOUNDRY'],
        baseSkills: { mining: 3, construction: 1, plants: 0, intelligence: 1 },
        combat: { faction: 'COLONY', maxHealth: 105, attack: 5, defense: 1, range: 1.1, cooldownSeconds: 1.7 },
    },
    BOTANIST: {
        id: 'BOTANIST',
        label: 'Botanist',
        description: 'Plant and rehabilitation specialist for ecological work.',
        workplaces: [],
        baseSkills: { mining: 0, construction: 1, plants: 3, intelligence: 2 },
        combat: { faction: 'COLONY', maxHealth: 95, attack: 3, defense: 1, range: 1.1, cooldownSeconds: 1.9 },
    },
    ENGINEER: {
        id: 'ENGINEER',
        label: 'Engineer',
        description: 'Workshop and technical systems specialist.',
        workplaces: ['WORKSHOP'],
        baseSkills: { mining: 1, construction: 3, plants: 0, intelligence: 3 },
        combat: { faction: 'COLONY', maxHealth: 100, attack: 5, defense: 2, range: 1.1, cooldownSeconds: 1.7 },
    },
    SECURITY: {
        id: 'SECURITY',
        label: 'Security',
        description: 'Colony guard trained to intercept hostile intruders.',
        workplaces: ['SECURITY_POST'],
        baseSkills: { mining: 1, construction: 1, plants: 0, intelligence: 2 },
        combat: { faction: 'COLONY', maxHealth: 125, attack: 18, defense: 5, range: 1.6, cooldownSeconds: 1 },
    },
    ILLEGAL_MINER: {
        id: 'ILLEGAL_MINER',
        label: 'Illegal Miner',
        description: 'Hostile trespasser looking for unguarded extraction opportunities.',
        workplaces: [],
        baseSkills: { mining: 2, construction: 0, plants: 0, intelligence: 1 },
        combat: { faction: 'HOSTILE', maxHealth: 75, attack: 10, defense: 2, range: 1.25, cooldownSeconds: 1.35 },
    },
    LUMBERJACK: {
        id: 'LUMBERJACK',
        label: 'Lumberjack',
        description: 'Wood production worker assigned to sawmills.',
        workplaces: ['SAWMILL'],
        baseSkills: { mining: 1, construction: 2, plants: 1, intelligence: 1 },
        combat: { faction: 'COLONY', maxHealth: 105, attack: 5, defense: 1, range: 1.1, cooldownSeconds: 1.7 },
    },
    QUARRYMAN: {
        id: 'QUARRYMAN',
        label: 'Quarryman',
        description: 'Stone extraction worker assigned to quarries.',
        workplaces: ['STONE_QUARRY'],
        baseSkills: { mining: 2, construction: 2, plants: 0, intelligence: 1 },
        combat: { faction: 'COLONY', maxHealth: 110, attack: 5, defense: 2, range: 1.1, cooldownSeconds: 1.7 },
    },
    UNEMPLOYED: {
        id: 'UNEMPLOYED',
        label: 'Unemployed',
        description: 'Civilian without a persistent workplace assignment.',
        workplaces: [],
        baseSkills: { mining: 0, construction: 0, plants: 0, intelligence: 1 },
        combat: { faction: 'NEUTRAL', maxHealth: 90, attack: 2, defense: 1, range: 1, cooldownSeconds: 2 },
    },
    CITIZEN: {
        id: 'CITIZEN',
        label: 'Citizen',
        description: 'Non-worker civilian actor used for ambient settlement life.',
        workplaces: [],
        baseSkills: { mining: 0, construction: 0, plants: 0, intelligence: 1 },
        combat: { faction: 'NEUTRAL', maxHealth: 90, attack: 2, defense: 1, range: 1, cooldownSeconds: 2 },
    },
};

function buildAgentRoleDefs(): Record<AgentRole, AgentRoleDef> {
    const entries = Object.entries(RAW_AGENT_ROLE_SCHEMA).map(([role, def]) => {
        const workplaces = def.workplaces.map((buildingType) => {
            if (!(buildingType in BuildingType)) {
                throw new Error(`Unknown workplace building type '${buildingType}' for agent role '${role}'`);
            }
            return BuildingType[buildingType as keyof typeof BuildingType];
        });

        return [role, { ...def, workplaces }] as const;
    });

    return Object.fromEntries(entries) as Record<AgentRole, AgentRoleDef>;
}

export const AGENT_ROLE_DEFS = buildAgentRoleDefs();

export function getAgentRoleDef(role: AgentRole): AgentRoleDef {
    return AGENT_ROLE_DEFS[role];
}

export function getAgentRoleForWorkplace(buildingType: BuildingType): AgentRole | null {
    for (const roleDef of Object.values(AGENT_ROLE_DEFS)) {
        if (roleDef.workplaces.includes(buildingType)) return roleDef.id;
    }
    return null;
}

export function getProfessionalWorkplaceTypes(): BuildingType[] {
    return Array.from(new Set(
        Object.values(AGENT_ROLE_DEFS).flatMap((roleDef) => roleDef.workplaces),
    ));
}
