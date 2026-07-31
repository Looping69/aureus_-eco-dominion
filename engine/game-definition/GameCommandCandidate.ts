import type { GameCommandValidationContext, GameCommandValidationResult } from './GameCommandValidator';
import { validateGameCommandType } from './GameCommandValidator';
import type { GameDefinition } from './types';

export const GAME_COMMAND_CANDIDATE_SOURCES = {
  UI: 'ui',
  LOCAL_QWEN: 'local-qwen',
  HEURISTIC_OVERSEER: 'heuristic-overseer',
  NETWORK: 'network',
  REPLAY: 'replay',
} as const;

export type GameCommandCandidateSource = typeof GAME_COMMAND_CANDIDATE_SOURCES[keyof typeof GAME_COMMAND_CANDIDATE_SOURCES] | (string & {});

export interface GameCommandCandidate {
  commandType: string;
  payload?: unknown;
  source?: GameCommandCandidateSource;
  reason?: string;
}

export interface GameCommandCandidateEnvelope {
  id: string;
  type: string;
  payload: unknown;
  issuedAtTick?: number;
  source?: GameCommandCandidateSource;
  reason?: string;
}

export interface GameCommandCandidateValidationResult extends GameCommandValidationResult {
  candidate: GameCommandCandidate;
}

function normalizeCandidateIdPart(value: unknown): string {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

function normalizeCandidateLabelPart(value: unknown): string {
  return String(value || 'unknown')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'unknown';
}

export function describeGameCommandCandidate(candidate: GameCommandCandidate): string {
  return `${normalizeCandidateLabelPart(candidate.source)}: ${normalizeCandidateLabelPart(candidate.commandType)}`;
}

export function createGameCommandCandidateId(
  source: GameCommandCandidateSource | undefined,
  commandType: string,
  issuedAtTick: number,
  sequence = 0,
): string {
  return `${normalizeCandidateIdPart(source)}_${normalizeCandidateIdPart(commandType)}_${issuedAtTick}_${sequence}`;
}

export function createGameCommandCandidate(
  commandType: string,
  payload?: unknown,
  source?: GameCommandCandidateSource,
  reason?: string,
): GameCommandCandidate {
  return { commandType, payload, source, reason };
}

export function createGameCommandCandidateEnvelope(
  candidate: GameCommandCandidate,
  id: string,
  issuedAtTick?: number,
): GameCommandCandidateEnvelope {
  return {
    id,
    type: candidate.commandType,
    payload: candidate.payload || {},
    issuedAtTick,
    source: candidate.source,
    reason: candidate.reason,
  };
}

export function createQueuedGameCommandCandidateEnvelope(
  commandType: string,
  payload: unknown,
  source: GameCommandCandidateSource | undefined,
  reason: string | undefined,
  issuedAtTick: number,
  sequence = 0,
): GameCommandCandidateEnvelope {
  const candidate = createGameCommandCandidate(commandType, payload, source, reason);
  return createGameCommandCandidateEnvelope(
    candidate,
    createGameCommandCandidateId(source, commandType, issuedAtTick, sequence),
    issuedAtTick,
  );
}

export function validateGameCommandCandidate(
  definition: GameDefinition | null | undefined,
  candidate: GameCommandCandidate,
  context?: GameCommandValidationContext,
): GameCommandCandidateValidationResult {
  const result = validateGameCommandType(definition, candidate.commandType, candidate.payload, context);
  return { ...result, candidate };
}

export function isValidGameCommandCandidate(
  definition: GameDefinition | null | undefined,
  candidate: GameCommandCandidate,
  context?: GameCommandValidationContext,
): boolean {
  return validateGameCommandCandidate(definition, candidate, context).ok;
}
