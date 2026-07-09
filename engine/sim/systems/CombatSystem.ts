import { BaseSimSystem } from '../Simulation';
import type { CommandResult, FixedContext } from '../../kernel';
import { CommandErrorCode } from '../../kernel';
import { SfxType } from '../../../types';
import type { Agent, AgentCombatState, AgentRole, CombatFaction, GameCommand, GameState } from '../../../types';
import { getAgentRoleDef } from '../../data/agentRoles';
import { getPerimeterCombatModifier } from '../../data/combatPerimeters';

export const COMBAT_SCAN_RANGE = 7;
export const DEFAULT_COMBAT_RANGE = 1.6;

type CombatProfile = Omit<AgentCombatState, 'cooldownRemaining' | 'targetAgentId' | 'defeated' | 'defeatReported'>;

export interface EffectiveCombatStats {
    faction: CombatFaction;
    attack: number;
    defense: number;
    range: number;
    scanRange: number;
}

export function getDefaultCombatProfile(role: AgentRole): CombatProfile {
    const combat = getAgentRoleDef(role)?.combat ?? getAgentRoleDef('CITIZEN').combat;
    return {
        faction: combat.faction,
        currentHealth: combat.maxHealth,
        maxHealth: combat.maxHealth,
        attack: combat.attack,
        defense: combat.defense,
        range: combat.range,
        cooldownSeconds: combat.cooldownSeconds,
    };
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
        commandTargetAgentId: existing?.commandTargetAgentId ?? null,
        stance: existing?.stance ?? 'AUTO',
        defeated: existing?.defeated ?? currentHealth <= 0,
        defeatReported: existing?.defeatReported ?? false,
    };

    return agent.combat;
}

export function getEffectiveCombatStats(state: GameState, agent: Agent): EffectiveCombatStats {
    const combat = ensureAgentCombatState(agent);
    const perimeter = getPerimeterCombatModifier(state, agent, combat.faction);

    return {
        faction: combat.faction,
        attack: Math.max(1, combat.attack + perimeter.attackBonus - perimeter.attackPenalty),
        defense: Math.max(0, combat.defense + perimeter.defenseBonus),
        range: Math.max(0.5, combat.range + perimeter.rangeBonus),
        scanRange: Math.max(1, COMBAT_SCAN_RANGE + perimeter.scanRangeBonus),
    };
}

export class CombatSystem extends BaseSimSystem {
    readonly id = 'combat';
    readonly priority = 96;

    handleCommand(cmd: GameCommand, _ctx: FixedContext, state: GameState): CommandResult | null {
        if (cmd.type === 'COMBAT_ATTACK_TARGET') {
            return this.handleAttackTarget(cmd, state);
        }
        if (cmd.type === 'COMBAT_HOLD_POSITION') {
            return this.handleHoldPosition(cmd, state);
        }
        if (cmd.type === 'COMBAT_CLEAR_ORDERS') {
            return this.handleClearOrders(cmd, state);
        }
        return null;
    }

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

            const effectiveStats = getEffectiveCombatStats(state, agent);
            const target = combat.stance === 'HOLD'
                ? null
                : this.findCommandTarget(state, agent, combatants, effectiveStats) || this.findNearestHostile(state, agent, combatants, effectiveStats);
            combat.targetAgentId = target?.id ?? null;
            if (!target) continue;

            const targetCombat = ensureAgentCombatState(target);
            const distance = chebyshevDistance(agent, target);
            if (distance > effectiveStats.range || combat.cooldownRemaining > 0) continue;

            this.resolveAttack(ctx, state, agent, combat, effectiveStats, target, targetCombat);
        }
    }

    private handleAttackTarget(cmd: GameCommand, state: GameState): CommandResult {
        const targetId = cmd.payload?.targetAgentId;
        const agentIds = this.normalizeAgentIds(cmd.payload?.agentIds);
        if (agentIds.length === 0) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Attack command needs selected agents.' };
        }
        if (!targetId) {
            return this.handleAttackNearestAgentIds(agentIds, state);
        }

        const target = this.findAgentById(state, targetId);
        if (!target) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Combat target not found.' };
        }
        const targetCombat = ensureAgentCombatState(target);
        if (targetCombat.defeated || targetCombat.faction === 'NEUTRAL') {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Target cannot be attacked.' };
        }

        let ordered = 0;
        for (const agentId of agentIds) {
            const agent = state.agents.find(candidate => candidate.id === agentId);
            if (!agent) continue;
            const combat = this.prepareAgentForCombatOrder(agent);
            if (combat.defeated || !areHostile(combat.faction, targetCombat.faction)) continue;
            this.assignAttackTarget(agent, combat, target);
            ordered += 1;
        }

        if (ordered === 0) {
            return { ok: false, code: CommandErrorCode.FORBIDDEN, reason: 'No selected agents can attack that target.' };
        }
        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.ALARM });
        return { ok: true };
    }

    private handleAttackNearestAgentIds(agentIds: string[], state: GameState): CommandResult {
        const possibleTargets = this.getCombatants(state).filter(agent => ensureAgentCombatState(agent).faction === 'HOSTILE');
        if (possibleTargets.length === 0) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'No hostile target is available.' };
        }

        let ordered = 0;
        for (const agentId of agentIds) {
            const agent = state.agents.find(candidate => candidate.id === agentId);
            if (!agent) continue;
            const combat = this.prepareAgentForCombatOrder(agent);
            if (combat.defeated) continue;
            const effectiveStats = getEffectiveCombatStats(state, agent);
            const target = this.findNearestHostile(state, agent, possibleTargets, effectiveStats);
            if (!target) continue;
            this.assignAttackTarget(agent, combat, target);
            ordered += 1;
        }

        if (ordered === 0) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'No selected agents have a hostile in combat scan range.' };
        }
        state.pendingEffects.push({ type: 'AUDIO', sfx: SfxType.ALARM });
        return { ok: true };
    }

    private handleHoldPosition(cmd: GameCommand, state: GameState): CommandResult {
        const agentIds = this.normalizeAgentIds(cmd.payload?.agentIds);
        if (agentIds.length === 0) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Hold command needs selected agents.' };
        }

        let ordered = 0;
        for (const agentId of agentIds) {
            const agent = state.agents.find(candidate => candidate.id === agentId);
            if (!agent) continue;
            const combat = this.prepareAgentForCombatOrder(agent);
            if (combat.defeated) continue;
            combat.stance = 'HOLD';
            combat.commandTargetAgentId = null;
            combat.targetAgentId = null;
            agent.targetX = null;
            agent.targetZ = null;
            agent.path = null;
            agent.currentJobId = null;
            agent.state = 'PATROLLING';
            agent.statusReason = 'Holding position by combat order.';
            agent.statusTone = 'warning';
            ordered += 1;
        }

        if (ordered === 0) {
            return { ok: false, code: CommandErrorCode.FORBIDDEN, reason: 'No selected agents can hold position.' };
        }
        return { ok: true };
    }

    private handleClearOrders(cmd: GameCommand, state: GameState): CommandResult {
        const agentIds = this.normalizeAgentIds(cmd.payload?.agentIds);
        if (agentIds.length === 0) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'Clear command needs selected agents.' };
        }

        let ordered = 0;
        for (const agentId of agentIds) {
            const agent = state.agents.find(candidate => candidate.id === agentId);
            if (!agent) continue;
            const combat = ensureAgentCombatState(agent);
            combat.stance = 'AUTO';
            combat.commandTargetAgentId = null;
            combat.targetAgentId = null;
            if (agent.state === 'PATROLLING') agent.state = 'IDLE';
            agent.statusReason = 'Combat orders cleared.';
            agent.statusTone = 'normal';
            ordered += 1;
        }

        if (ordered === 0) {
            return { ok: false, code: CommandErrorCode.INVALID_TARGET, reason: 'No selected agents found.' };
        }
        return { ok: true };
    }

    private getCombatants(state: GameState): Agent[] {
        const agents = Array.isArray(state.agents) ? state.agents : [];
        const ambientNpcs = Array.isArray(state.ambientNpcs) ? state.ambientNpcs : [];

        return [...agents, ...ambientNpcs]
            .filter((agent) => agent.layer === 0)
            .filter((agent) => ensureAgentCombatState(agent).faction !== 'NEUTRAL');
    }

    private findCommandTarget(
        state: GameState,
        agent: Agent,
        combatants: Agent[],
        effectiveStats: EffectiveCombatStats,
    ): Agent | null {
        const combat = ensureAgentCombatState(agent);
        if (!combat.commandTargetAgentId) return null;
        const target = combatants.find(candidate => candidate.id === combat.commandTargetAgentId) || this.findAgentById(state, combat.commandTargetAgentId);
        if (!target) {
            combat.commandTargetAgentId = null;
            return null;
        }
        const targetStats = getEffectiveCombatStats(state, target);
        if (ensureAgentCombatState(target).defeated || !areHostile(effectiveStats.faction, targetStats.faction)) {
            combat.commandTargetAgentId = null;
            return null;
        }
        return target;
    }

    private findNearestHostile(
        state: GameState,
        agent: Agent,
        combatants: Agent[],
        effectiveStats: EffectiveCombatStats,
    ): Agent | null {
        let best: Agent | null = null;
        let bestDistance = Infinity;

        for (const candidate of combatants) {
            if (candidate.id === agent.id) continue;
            const candidateStats = getEffectiveCombatStats(state, candidate);
            if (ensureAgentCombatState(candidate).defeated || !areHostile(effectiveStats.faction, candidateStats.faction)) continue;
            const distance = chebyshevDistance(agent, candidate);
            if (distance > effectiveStats.scanRange || distance >= bestDistance) continue;
            best = candidate;
            bestDistance = distance;
        }

        return best;
    }

    private assignAttackTarget(agent: Agent, combat: AgentCombatState, target: Agent): void {
        combat.stance = 'ATTACK';
        combat.commandTargetAgentId = target.id;
        combat.targetAgentId = target.id;
        agent.currentJobId = null;
        agent.statusReason = `Attack order: ${target.name}.`;
        agent.statusTone = 'warning';
    }

    private prepareAgentForCombatOrder(agent: Agent): AgentCombatState {
        const combat = ensureAgentCombatState(agent);
        if (combat.faction === 'NEUTRAL') combat.faction = 'COLONY';
        return combat;
    }

    private resolveAttack(
        ctx: FixedContext,
        state: GameState,
        attacker: Agent,
        attackerCombat: AgentCombatState,
        attackerStats: EffectiveCombatStats,
        target: Agent,
        targetCombat: AgentCombatState,
    ): void {
        const targetStats = getEffectiveCombatStats(state, target);
        const damage = Math.max(1, attackerStats.attack - targetStats.defense);
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

    private findAgentById(state: GameState, agentId: string): Agent | null {
        return state.agents.find(agent => agent.id === agentId)
            || state.ambientNpcs.find(agent => agent.id === agentId)
            || null;
    }

    private normalizeAgentIds(value: unknown): string[] {
        if (Array.isArray(value)) {
            return Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0)));
        }
        return typeof value === 'string' && value.length > 0 ? [value] : [];
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