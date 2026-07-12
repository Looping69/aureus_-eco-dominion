import React, { useMemo } from 'react';
import { BuildingType, GameState, GridTile, Agent } from '../types';
import { BUILDINGS } from '../engine/data/VoxelConstants';

type HoverTile = { x: number; z: number } | null;
type CursorPoint = { x: number; y: number } | null;

type HoverDetail = {
    title: string;
    kind: string;
    tone?: 'neutral' | 'good' | 'warning' | 'danger';
    rows: Array<[string, string]>;
};

interface WorldHoverTooltipProps {
    state: GameState;
    tilePos: HoverTile;
    cursor: CursorPoint;
    hidden?: boolean;
}

const TITLE_CASE_OVERRIDES: Record<string, string> = {
    AGT: 'AGT',
    ECO: 'ECO',
    NPC: 'NPC',
    HP: 'HP',
};

function label(value: unknown): string {
    const raw = String(value ?? '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!raw) return 'Unknown';
    return raw
        .toLowerCase()
        .split(' ')
        .map((part) => TITLE_CASE_OVERRIDES[part.toUpperCase()] || `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ');
}

function percent(value: unknown): string {
    const num = Number(value ?? 0);
    return `${Math.round(num)}%`;
}

function resourceAmount(agent: Agent): string | null {
    const inventory = agent.inventory;
    if (!inventory?.type || !inventory.amount) return null;
    return `${label(inventory.type)} ${Math.round(inventory.amount)}/${inventory.capacity}`;
}

function findTile(state: GameState, pos: HoverTile): GridTile | null {
    if (!pos) return null;
    for (const chunk of Object.values(state.chunks || {})) {
        const tile = chunk.tiles.find((candidate) => candidate.x === pos.x && candidate.z === pos.z);
        if (tile) return tile;
    }
    return null;
}

function findAgentsAt(state: GameState, pos: HoverTile): Agent[] {
    if (!pos) return [];
    const allAgents = [...(state.agents || []), ...(state.ambientNpcs || [])];
    return allAgents.filter((agent) => {
        if (agent.layer !== 0) return false;
        const x = Math.round(agent.visualX ?? agent.x);
        const z = Math.round(agent.visualZ ?? agent.z);
        return x === pos.x && z === pos.z;
    });
}

function getAgentDetail(agent: Agent, isAmbientNpc: boolean): HoverDetail {
    const combat = agent.combat;
    const rows: Array<[string, string]> = [
        ['Role', label(agent.type)],
        ['State', label(agent.state)],
        ['Position', `${agent.x.toFixed(1)}, ${agent.z.toFixed(1)}`],
    ];

    if (agent.statusReason) rows.push(['Status', agent.statusReason]);
    if (agent.profession) rows.push(['Profession', label(agent.profession)]);
    if (resourceAmount(agent)) rows.push(['Carrying', resourceAmount(agent)!]);
    rows.push(['Needs', `Energy ${percent(agent.energy)} / Hunger ${percent(agent.hunger)} / Mood ${percent(agent.mood)}`]);

    if (combat) {
        rows.push(['Weapon', combat.weaponName || 'Unarmed']);
        rows.push(['Combat', `${label(combat.stance || 'AUTO')} / ${Math.ceil(combat.currentHealth)}/${combat.maxHealth} HP`]);
        if (combat.faction) rows.push(['Faction', label(combat.faction)]);
    }

    return {
        title: agent.name || label(agent.type),
        kind: isAmbientNpc ? 'Ambient NPC' : 'Agent',
        tone: combat?.defeated ? 'danger' : combat?.faction === 'HOSTILE' ? 'warning' : 'good',
        rows,
    };
}

function getTileDetail(tile: GridTile): HoverDetail | null {
    const hasBuilding = tile.buildingType && tile.buildingType !== BuildingType.EMPTY && tile.buildingType !== BuildingType.POND;
    const hasFoliage = tile.foliage && tile.foliage !== 'NONE';

    if (!hasBuilding && !hasFoliage) {
        // Bare grass is intentionally quiet; the user asked for no grass tooltip noise.
        if (tile.biome === 'GRASS') return null;
        return {
            title: `${label(tile.biome)} Ground`,
            kind: 'Terrain',
            rows: [
                ['Position', `${tile.x}, ${tile.z}`],
                ['Height', `${tile.terrainHeight}`],
                ['Status', tile.explored === false ? 'Unexplored' : 'Open surface'],
            ],
        };
    }

    if (hasBuilding) {
        const def = BUILDINGS[tile.buildingType];
        const rows: Array<[string, string]> = [
            ['Position', `${tile.x}, ${tile.z}`],
            ['Level', `${tile.level || 1}`],
            ['Integrity', percent(tile.integrity ?? 100)],
        ];
        if (tile.isUnderConstruction) rows.push(['Construction', `${Math.max(0, Math.round(tile.constructionTimeLeft || 0))} ticks left`]);
        if (tile.powerStatus) rows.push(['Power', label(tile.powerStatus)]);
        if (tile.waterStatus) rows.push(['Water', label(tile.waterStatus)]);
        if (tile.undergroundPipe) rows.push(['Underground Pipe', tile.undergroundPipeUnderConstruction ? label(tile.undergroundPipePhase || 'BUILDING') : 'Installed']);
        if (tile.markedForHarvest) rows.push(['Order', 'Marked for harvest']);
        if (hasFoliage) rows.push(['Surface Item', label(tile.foliage)]);

        return {
            title: def?.name || label(tile.buildingType),
            kind: tile.isUnderConstruction ? 'Construction' : 'Building',
            tone: tile.isUnderConstruction ? 'warning' : 'neutral',
            rows,
        };
    }

    return {
        title: label(tile.foliage),
        kind: tile.foliage?.startsWith('TREE') ? 'Tree' : tile.foliage?.startsWith('ROCK') ? 'Rock' : tile.foliage?.includes('CACTUS') ? 'Cactus' : 'Surface Object',
        tone: tile.markedForHarvest ? 'warning' : 'neutral',
        rows: [
            ['Position', `${tile.x}, ${tile.z}`],
            ['Biome', label(tile.biome)],
            ['Height', `${tile.terrainHeight}`],
            ['Order', tile.markedForHarvest ? 'Marked for harvest' : 'None'],
        ],
    };
}

function getHoverDetail(state: GameState, tilePos: HoverTile): HoverDetail | null {
    const hoveredAgents = findAgentsAt(state, tilePos);
    if (hoveredAgents.length > 0) {
        const agent = hoveredAgents[0];
        return getAgentDetail(agent, Boolean((state.ambientNpcs || []).some((npc) => npc.id === agent.id)));
    }

    const tile = findTile(state, tilePos);
    if (!tile) return null;
    return getTileDetail(tile);
}

const toneClass: Record<NonNullable<HoverDetail['tone']>, string> = {
    neutral: 'border-sky-400/40 text-sky-200',
    good: 'border-emerald-400/45 text-emerald-200',
    warning: 'border-amber-400/50 text-amber-200',
    danger: 'border-rose-400/50 text-rose-200',
};

export const WorldHoverTooltip: React.FC<WorldHoverTooltipProps> = ({ state, tilePos, cursor, hidden }) => {
    const detail = useMemo(() => getHoverDetail(state, tilePos), [state, tilePos?.x, tilePos?.z]);

    if (hidden || !cursor || !detail) return null;

    const left = Math.min(cursor.x + 16, window.innerWidth - 304);
    const top = Math.min(cursor.y + 18, window.innerHeight - 220);
    const tone = toneClass[detail.tone || 'neutral'];

    return (
        <div
            className="fixed z-[95] pointer-events-none w-[18rem] max-w-[calc(100vw-1.5rem)] rounded-[6px] border bg-slate-950/90 backdrop-blur-md shadow-[0_18px_42px_rgba(0,0,0,0.45)] px-3 py-2 font-['Inter']"
            style={{ left: Math.max(12, left), top: Math.max(12, top) }}
        >
            <div className={`text-[9px] font-black uppercase tracking-wider ${tone}`}>{detail.kind}</div>
            <div className="text-sm font-black text-slate-50 leading-tight mt-0.5">{detail.title}</div>
            <div className="mt-2 space-y-1">
                {detail.rows.slice(0, 7).map(([key, value]) => (
                    <div key={`${key}:${value}`} className="grid grid-cols-[5.8rem_1fr] gap-2 text-[11px] leading-snug">
                        <span className="text-slate-400 font-bold uppercase tracking-wide">{key}</span>
                        <span className="text-slate-100 font-semibold truncate">{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WorldHoverTooltip;
