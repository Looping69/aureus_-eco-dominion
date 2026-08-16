/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shield, Target, Users } from 'lucide-react';
import type { Agent } from '../types';

interface AgentCommandHUDProps {
    agents: Agent[];
    selectedAgentId: string | null;
    selectedAgentIds?: string[];
}

const getCombatHealthLabel = (agent: Agent): string => {
    if (!agent.combat) return 'n/a';
    return `${Math.ceil(agent.combat.currentHealth)}/${Math.ceil(agent.combat.maxHealth)}`;
};

const getCombatStanceLabel = (agent: Agent): string => agent.combat?.stance ?? 'AUTO';
const getWeaponLabel = (agent: Agent): string => agent.combat?.weaponName ?? 'Unarmed';

export const AgentCommandHUD: React.FC<AgentCommandHUDProps> = ({ agents, selectedAgentId, selectedAgentIds = [] }) => {
    const selectedIds = selectedAgentIds.length > 0 ? selectedAgentIds : selectedAgentId ? [selectedAgentId] : [];
    if (selectedIds.length === 0) return null;

    const selectedAgents = selectedIds
        .map((id) => agents.find((agent) => agent.id === id))
        .filter((agent): agent is Agent => Boolean(agent));

    if (selectedAgents.length === 0) return null;

    const leadAgent = selectedAgents[0];
    const groupLabel = selectedAgents.length > 1 ? `${selectedAgents.length} selected` : leadAgent.name;
    const stanceLabel = selectedAgents.length > 1
        ? `${new Set(selectedAgents.map(getCombatStanceLabel)).size} stances`
        : getCombatStanceLabel(leadAgent);
    const weaponLabel = selectedAgents.length > 1
        ? `${selectedAgents.filter((agent) => getWeaponLabel(agent) !== 'Unarmed').length}/${selectedAgents.length} armed`
        : getWeaponLabel(leadAgent);
    const healthLabel = selectedAgents.length > 1
        ? `${selectedAgents.filter((agent) => agent.combat && agent.combat.currentHealth > 0).length}/${selectedAgents.length} ready`
        : getCombatHealthLabel(leadAgent);

    return (
        <div className="absolute bottom-36 left-1/2 z-[70] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 pointer-events-none sm:bottom-28">
            <div className="pointer-events-auto rounded-[6px] border-2 border-b-[6px] border-slate-950 bg-slate-950/90 px-3 py-2.5 text-white shadow-[4px_4px_0_rgba(0,0,0,0.35)] backdrop-blur-sm animate-in slide-in-from-bottom-3 duration-200">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-indigo-400/40 bg-indigo-500/15 text-indigo-100">
                            {selectedAgents.length > 1 ? <Users size={16} /> : <Target size={16} />}
                        </span>
                        <div className="min-w-0">
                            <div className="font-['Rajdhani'] text-[10px] font-black uppercase tracking-widest text-indigo-300">Command Link</div>
                            <div className="truncate font-['Rajdhani'] text-sm font-black uppercase tracking-wide text-white">{groupLabel}</div>
                        </div>
                    </div>
                    <span className="shrink-0 rounded-[3px] border border-slate-500/50 bg-slate-800/80 px-2 py-1 font-mono text-[9px] font-bold uppercase text-slate-200">
                        {leadAgent.state}
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[9px] font-mono uppercase">
                    <div className="rounded-[3px] border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-rose-100">
                        <div className="text-[7px] text-rose-300/70">Weapon</div>
                        <div className="truncate font-bold">{weaponLabel}</div>
                    </div>
                    <div className="rounded-[3px] border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-amber-100">
                        <div className="text-[7px] text-amber-300/70">Stance</div>
                        <div className="truncate font-bold">{stanceLabel}</div>
                    </div>
                    <div className="rounded-[3px] border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-emerald-100">
                        <div className="flex items-center gap-1 text-[7px] text-emerald-300/70"><Shield size={8} /> HP</div>
                        <div className="truncate font-bold">{healthLabel}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
