import type { GameCommandValidationContext, GameCommandValidationResult } from './GameCommandValidator';
import { validateGameCommandType } from './GameCommandValidator';
import type { GameDefinition } from './types';

export interface GameCommandCandidate {
  commandType: string;
  payload?: unknown;
  source?: string;
  reason?: string;
}

export interface GameCommandCandidateValidationResult extends GameCommandValidationResult {
  candidate: GameCommandCandidate;
}

export function createGameCommandCandidate(
  commandType: string,
  payload?: unknown,
  source?: string,
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
