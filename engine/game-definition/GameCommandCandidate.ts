import type { GameCommandValidationContext, GameCommandValidationResult } from './GameCommandValidator';
import { validateGameCommandType } from './GameCommandValidator';
import type { GameDefinition } from './types';

export const GAME_COMMAND_CANDIDATE_SOURCES = {
  UI: 'ui',
  LOCAL_QWEN: 'local-qwen',
  HEURISTIC_OVERSEER: 'heuristic-overseer',
  NETWORK: 'network',
} as const;

export type GameCommandCandidateSource = typeof GAME_COMMAND_CANDIDATE_SOURCES[keyof typeof GAME_COMMAND_CANDIDATE_SOURCES] | (string & {});

export interface GameCommandCandidate {
  commandType: string;
  payload?: unknown;
  source?: GameCommandCandidateSource;
  reason?: string;
}

export interface GameCommandCandidateValidationResult extends GameCommandValidationResult {
  candidate: GameCommandCandidate;
}

export function createGameCommandCandidate(
  commandType: string,
  payload?: unknown,
  source?: GameCommandCandidateSource,
  reason?: string,
): GameCommandCandidate {
  return { commandType, payload, source, reason };
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
