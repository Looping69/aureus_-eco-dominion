import { BuildingType } from '../../types';
import type { Agent, CombatFaction, GameState, GridTile } from '../../types';

export interface CombatPerimeterDef {
    buildingType: BuildingType;
    controlRadius: number;
    colonyScanRangeBonus: number;
    colonyAttackBonus: number;
    colonyDefenseBonus: number;
    colonyRangeBonus: number;
    hostileAttackPenalty: number;
}

export interface PerimeterCombatModifier {
    scanRangeBonus: number;
    attackBonus: number;
    defenseBonus: number;
    rangeBonus: number;
    attackPenalty: number;
}

type RawCombatPerimeterDef = Omit<CombatPerimeterDef, 'buildingType'> & {
    buildingType: string;
};

export const RAW_COMBAT_PERIMETER_SCHEMA: RawCombatPerimeterDef[] = [
    {
        buildingType: 'FENCE',
        controlRadius: 2,
        colonyScanRangeBonus: 1,
        colonyAttackBonus: 1,
        colonyDefenseBonus: 2,
        colonyRangeBonus: 0.4,
        hostileAttackPenalty: 2,
    },
    {
        buildingType: 'SECURITY_POST',
        controlRadius: 6,
        colonyScanRangeBonus: 4,
        colonyAttackBonus: 4,
        colonyDefenseBonus: 3,
        colonyRangeBonus: 5.5,
        hostileAttackPenalty: 3,
    },
];

function buildCombatPerimeterDefs(): CombatPerimeterDef[] {
    return RAW_COMBAT_PERIMETER_SCHEMA.map((def) => {
        if (!(def.buildingType in BuildingType)) {
            throw new Error(`Unknown combat perimeter building type '${def.buildingType}'`);
        }

        return {
            ...def,
            buildingType: BuildingType[def.buildingType as keyof typeof BuildingType],
        };
    });
}

export const COMBAT_PERIMETER_DEFS = buildCombatPerimeterDefs();

export function getCombatPerimeterDef(buildingType: BuildingType): CombatPerimeterDef | null {
    return COMBAT_PERIMETER_DEFS.find((def) => def.buildingType === buildingType) ?? null;
}

export function getPerimeterCombatModifier(state: GameState, agent: Agent, faction: CombatFaction): PerimeterCombatModifier {
    const modifier: PerimeterCombatModifier = {
        scanRangeBonus: 0,
        attackBonus: 0,
        defenseBonus: 0,
        rangeBonus: 0,
        attackPenalty: 0,
    };

    for (const chunk of Object.values(state.chunks ?? {})) {
        for (const tile of chunk.tiles ?? []) {
            const def = getActivePerimeterDef(tile);
            if (!def) continue;
            const distance = chebyshevDistance(agent, tile);
            if (distance > def.controlRadius) continue;

            if (faction === 'COLONY') {
                modifier.scanRangeBonus = Math.max(modifier.scanRangeBonus, def.colonyScanRangeBonus);
                modifier.attackBonus = Math.max(modifier.attackBonus, def.colonyAttackBonus);
                modifier.defenseBonus = Math.max(modifier.defenseBonus, def.colonyDefenseBonus);
                modifier.rangeBonus = Math.max(modifier.rangeBonus, def.colonyRangeBonus);
            } else if (faction === 'HOSTILE') {
                modifier.attackPenalty = Math.max(modifier.attackPenalty, def.hostileAttackPenalty);
            }
        }
    }

    return modifier;
}

function getActivePerimeterDef(tile: GridTile): CombatPerimeterDef | null {
    if (!tile || tile.isUnderConstruction || tile.buildingType === BuildingType.EMPTY) return null;
    if (tile.structureHeadX !== undefined && (tile.x !== tile.structureHeadX || tile.z !== tile.structureHeadZ)) return null;
    return getCombatPerimeterDef(tile.buildingType);
}

function chebyshevDistance(a: Pick<Agent, 'x' | 'z'>, b: Pick<GridTile, 'x' | 'z'>): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}
