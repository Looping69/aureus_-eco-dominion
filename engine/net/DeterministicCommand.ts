import type { GameCommand } from '../../types';

export interface DeterministicCommandEnvelope {
    id: string;
    playerId: string;
    targetTick: number;
    sequence: number;
    payloadHash: string;
    command: GameCommand;
}

export interface DeterministicCommandInput {
    playerId: string;
    targetTick: number;
    sequence: number;
    command: GameCommand;
}

export function createDeterministicCommandEnvelope(input: DeterministicCommandInput): DeterministicCommandEnvelope {
    const playerId = normalizePlayerId(input.playerId);
    const targetTick = normalizeNonNegativeInteger(input.targetTick, 'targetTick');
    const sequence = normalizeNonNegativeInteger(input.sequence, 'sequence');
    const command = normalizeCommand(input.command);

    return {
        id: `${targetTick}:${playerId}:${sequence}`,
        playerId,
        targetTick,
        sequence,
        command,
        payloadHash: hashCommandPayload(command),
    };
}

export function compareDeterministicCommands(a: DeterministicCommandEnvelope, b: DeterministicCommandEnvelope): number {
    return a.targetTick - b.targetTick
        || a.playerId.localeCompare(b.playerId)
        || a.sequence - b.sequence
        || a.payloadHash.localeCompare(b.payloadHash)
        || a.command.id.localeCompare(b.command.id);
}

export function getDeterministicCommandKey(command: Pick<DeterministicCommandEnvelope, 'playerId' | 'sequence'>): string {
    return `${command.playerId}:${command.sequence}`;
}

export function hashCommandPayload(command: GameCommand): string {
    return fnv1a(stableStringify({ type: command.type, payload: command.payload }));
}

export function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
}

function normalizePlayerId(playerId: string): string {
    const normalized = playerId.trim();
    if (!normalized) throw new Error('playerId is required for deterministic commands');
    return normalized;
}

function normalizeNonNegativeInteger(value: number, field: string): number {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${field} must be a non-negative integer`);
    }
    return value;
}

function normalizeCommand(command: GameCommand): GameCommand {
    if (!command || typeof command.id !== 'string' || !command.id.trim()) {
        throw new Error('command.id is required for deterministic commands');
    }
    if (!command.type) {
        throw new Error('command.type is required for deterministic commands');
    }
    return command;
}

function fnv1a(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
