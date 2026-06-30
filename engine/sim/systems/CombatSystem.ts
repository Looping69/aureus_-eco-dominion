import { BaseSimSystem } from '../Simulation';
import type { FixedContext } from '../../kernel';
import { SfxType } from '../../../types';
import type { Agent, AgentCombatState, AgentRole, CombatFaction, GameState } from '../../../types';

export const COMBAT_SCAN_RANGE = 7;
export const DEFAULT_COMBAT_RANGE = 1.6;

type CombatProfile = Omit<AgentCombatState, 'cooldownRemaining' | 'targetAgentId' | 'defeated' | 'defeatReported'>;

const ROLE_COMBAT_PROFILES: Partial<Record<AgentRole, CombatProfile>> = {
    SECURITY: {
        faction: 'COLONY',
        currentHealth: 125,
        maxHealth: 125,
        attack: 18,
        defense: 5,
        range: DEFAULT_COMBAT_RANGE,
        cooldownSeconds: 1,
    },
    ILLEGAL_MINER: {
        faction: 'HOSTILE',
        currentHealth: 75,
        maxHealth: 75,
        attack: 10,
        defense: 2,
        range: 1.25,
        cooldownSeconds: 1.35,
    },
};

const DEFAULT_COLONIST_PROFILE: CombatProfile = {
    faction: 'COLONY',
    currentHealth: 100,
    maxHealth: 100,
    attack: 4,
    defense: 1,
    range: 1.1,
    cooldownSeconds: 1.8,
};

const DEFAULT_NEUTRAL_PROFILE: CombatProfile = {
    faction: 'NEUTRAL',
    currentHealth: 90,
    maxHealth: 90,
    attack: 2,
    defense: 1,
    range: 1,
    cooldownSeconds: 2,
};

export function getDefaultCombatProfile(role: AgentRole): CombatProfile {
    if (ROLE_COMBAT_PROFILES[role]) return { ...ROLE_COMBAT_PROFILES[role]! };
    if (role === 'CITIZEN' || role === 'UNEMPLOYED') return { ...DEFAULT_NEUTRAL_PROFILE };
    return { ...DEFAULT_COLONIST_PROFILE };
}

export function ensureAgentCombatState(agent: Agent): AgentCombatState {
    const profile = getDefaultCombatProfile(agent.type);
    const existing = agent.combat;
    const maxHealth = sanePositive(existing?.maxHealth, profile.maxHealth);
    const currentHealth = Math.min(maxHealth, sanePositive(existing?.currentHealth, profile.currentHealth));

    agent.combat = {
        faction: existing?.faction ?? profile.faction,
        currentHealth,
        maxHealth,
        attack: sanePositive(existing?.attack, profile.attack),
        defense: Math.max(0, saneNumber(existing?.defense, profile.defense)),
        range: sanePositive(existing?.range, profile.range),
        cooldownSeconds: sanePositive(existing?.cooldownSeconds, profile.cooldownSeconds),
        cooldownRemaining: Math.max(0, saneNumber(existing?.cooldownRemaining, 0)),
        targetAgentId: existing?.targetAgentId ?? null,
        defeated: existing?.defeated ?? currentHealth <= 0,
        defeatReported: existing?.defeatReported ?? false,
    };

    return agent.combat;
}

export class CombatSystem extends BaseSimSystem {
    readonly id = 'combat';
    readonly priority = 96;

    tick(ctx: FixedContext, state: GameState): void {
        const combatants = this.getCombatants(state);
        if (combatants.length < 2) return;

        for (const agent of combatants) {
            const combat = ensureAgentCombatState(agent);
            combat.cooldownRemaining = Math.max(0, combat.cooldownRemaining - ctx.fixedDt);
            if (combat.defeated) {
                this.lockDefeatedAgent(agent, state, ctx);
                continue;
            }

            const target = this.findNearestHostile(agent, combatants);
            combat.targetAgentId = target?.id ?? null;
            if (!target) continue;

            const targetCombat = ensureAgentCombatState(target);
            const distance = chebyshevDistance(agent, target);
            if (distance > combat.range || combat.cooldownRemaining > 0) continue;

            this.resolveAttack(ctx, state, agent, combat, target, targetCombat);
        }
    }

    private getCombatants(state: GameState): Agent[] {
        return [...(state.agents ?? []), ...(state.ambientNpcs ?? [])]
            .filter((agent) => agent.layer === 0)
            .filter((agent) => ensureAgentCombatState(agent).faction !== 'NEUTRAL');
    }

    private findNearestHostile(agent: Agent, combatants: Agent[]): Agent | null {
        const combat = ensureAgentCombatState(agent);
        let best: Agent | null = null;
        let bestDistance = Infinity;

        for (const candidate of combatants) {
            if (candidate.id === agent.id) continue;
            const candidateCombat = ensureAgentCombatState(candidate);
            if (candidateCombat.defeated || !areHostile(combat.faction, candidateCombat.faction)) continue;
            const distance = chebyshevDistance(agent, candidate);
            if (distance > COMBAT_SCAN_RANGE || distance >= bestDistance) continue;
            best = candidate;
            bestDistance = distance;
        }

        return best;
    }

    private resolveAttack(
        ctx: FixedContext,
        state: GameState,
        attacker: Agent,
        attackerCombat: AgentCombatState,
        target: Agent,
        targetCombat: AgentCombatState,
    ): void {
        const damage = Math.max(1, attackerCombat.attack - targetCombat.defense);
        targetCombat.currentHealth = Math.max(0, targetCombat.currentHealth - damage);
        attackerCombat.cooldownRemaining = attackerCombat.cooldownSeconds;
        attacker.statusReason = `Engaging ${target.name}.`;
        attacker.statusTone = 'warning';
        target.statusReason = `Under attack by ${attacker.name}.`;
        target.statusTone = 'warning';

        if (targetCombat.currentHealth <= 0) {
            targetCombat.defeated = true;
            targetCombat.targetAgentId = null;
            this.lockDefeatedAgent(target, state, ctx, attacker);
        }
    }

    private lockDefeatedAgent(agent: Agent, state: GameState, ctx: FixedContext, victor?: Agent): void {
        const combat = ensureAgentCombatState(agent);
        agent.state = 'OFF_DUTY';
        agent.currentJobId = null;
        agent.targetX = null;
        agent.targetZ = null;
        agent.path = null;
        agent.statusReason = combat.faction === 'HOSTILE'
            ? 'Neutralized by colony security.'
            : 'Downed and waiting for rescue.';
        agent.statusTone = 'blocked';

        if (combat.defeatReported) return;
        combat.defeatReported = true;
        state.newsFeed.unshift({
            id: ctx.getNextId?.('combat') || `combat_${agent.id}_${state.tickCount}`,
            headline: victor
                ? `RADIO: ${victor.name} neutralized ${agent.name} near X${Math.round(agent.x)}, Z${Math.round(agent.z)}.`
                : `RADIO: ${agent.name} is out of action near X${Math.round(agent.x)}, Z${Math.round(agent.z)}.`,
            type: combat.faction === 'HOSTILE' ? 'POSITIVE' : 'CRITICAL',
            timestamp: state.tickCount,
        });
        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.ALARM });
    }
}

export function areHostile(a: CombatFaction, b: CombatFaction): boolean {
    if (a === 'NEUTRAL' || b === 'NEUTRAL') return false;
    return a !== b;
}

export function chebyshevDistance(a: Pick<Agent, 'x' | 'z'>, b: Pick<Agent, 'x' | 'z'>): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

function sanePositive(value: unknown, fallback: number): number {
    const number = saneNumber(value, fallback);
    return number > 0 ? number : fallback;
}

function saneNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
